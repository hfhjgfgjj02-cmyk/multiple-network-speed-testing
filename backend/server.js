const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');
const db = require('./database');

const app = express();
const server = http.createServer(app);

// Enable CORS for frontend during development
app.use(cors({
  origin: '*', // Allow any origin for testing convenience
  methods: ['GET', 'POST']
}));

app.use(express.json());

// Pre-allocate a 10MB buffer of random bytes at startup for fast download speed testing
const BUFFER_SIZE = 10 * 1024 * 1024; // 10MB
console.log('Pre-allocating 10MB test buffer...');
const speedTestBuffer = crypto.randomBytes(BUFFER_SIZE);

// Socket.io configuration
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Serve frontend build static files in production
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// 1. Latency/Ping test endpoint
app.get('/api/speedtest/ping', (req, res) => {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    'Pragma': 'no-cache'
  });
  res.status(200).json({ status: 'ok', timestamp: Date.now() });
});

// 2. Download speed test endpoint (returns file of requested size up to 10MB)
app.get('/api/speedtest/download', (req, res) => {
  const size = parseInt(req.query.size) || 1024 * 1024; // Default 1MB
  const clampedSize = Math.max(1024, Math.min(size, BUFFER_SIZE)); // Clamp between 1KB and 10MB
  
  res.set({
    'Content-Type': 'application/octet-stream',
    'Content-Length': clampedSize,
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    'Pragma': 'no-cache'
  });
  
  res.send(speedTestBuffer.subarray(0, clampedSize));
});

// 3. Upload speed test endpoint (consumes streams and discards them instantly)
app.post('/api/speedtest/upload', (req, res) => {
  let bytesReceived = 0;
  
  req.on('data', (chunk) => {
    bytesReceived += chunk.length;
  });
  
  req.on('end', () => {
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma': 'no-cache'
    });
    res.status(200).json({ success: true, bytesReceived });
  });
  
  req.on('error', (err) => {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Upload interrupted' });
  });
});

// 4. Report speed test results
app.post('/api/speedtest/report', async (req, res) => {
  try {
    const {
      carrier,
      network_type,
      download_speed,
      upload_speed,
      ping,
      jitter,
      latitude,
      longitude,
      location_name,
      device_info
    } = req.body;

    if (!carrier || !network_type || download_speed === undefined || upload_speed === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const testRecord = await db.saveTest({
      carrier,
      network_type,
      download_speed,
      upload_speed,
      ping,
      jitter,
      latitude,
      longitude,
      location_name: location_name || 'Unknown Location',
      device_info: device_info || req.headers['user-agent']
    });

    // Broadcast the new speed test globally via Socket.io
    io.emit('new_speed_test', testRecord);

    // Broadcast updated analytics in real time
    const updatedAnalytics = await db.getAnalytics();
    io.emit('analytics_update', updatedAnalytics);

    res.status(201).json(testRecord);
  } catch (err) {
    console.error('Failed to save speed test:', err);
    res.status(500).json({ error: 'Database saving failed' });
  }
});

// 5. Get recent speed test logs
app.get('/api/speedtest/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const history = await db.getHistory(limit);
    res.json(history);
  } catch (err) {
    console.error('Failed to fetch speed test history:', err);
    res.status(500).json({ error: 'Database retrieval failed' });
  }
});

// 6. Get carrier analytics
app.get('/api/speedtest/analytics', async (req, res) => {
  try {
    const analytics = await db.getAnalytics();
    res.json(analytics);
  } catch (err) {
    console.error('Failed to fetch speed test analytics:', err);
    res.status(500).json({ error: 'Database analytics failed' });
  }
});

// Redirect any other GET requests to the React app in production
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

// WebSocket connection handler
io.on('connection', (socket) => {
  console.log('Client connected to real-time feed:', socket.id);
  socket.on('disconnect', () => {
    console.log('Client disconnected from real-time feed:', socket.id);
  });
});

// Start the database and backend server
const PORT = process.env.PORT || 5000;
db.init().then(() => {
  server.listen(PORT, () => {
    console.log(`Backend server running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Database initialization failed:', err);
  process.exit(1);
});
