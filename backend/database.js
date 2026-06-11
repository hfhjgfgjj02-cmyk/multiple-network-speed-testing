const fs = require('fs');
const path = require('path');

let dbType = 'sqlite';
let dbInstance = null;
const JSON_DB_PATH = path.join(__dirname, 'tests_db.json');

const SEED_DATA = [
  { carrier: 'Verizon', network_type: '5G', download_speed: 284.5, upload_speed: 68.2, ping: 14.1, jitter: 1.5, latitude: 40.7128, longitude: -74.0060, location_name: 'New York, USA', device_info: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' },
  { carrier: 'Jio', network_type: '5G', download_speed: 195.2, upload_speed: 38.4, ping: 18.5, jitter: 2.1, latitude: 19.0760, longitude: 72.8777, location_name: 'Mumbai, India', device_info: 'Mozilla/5.0 (Linux; Android 14; SM-S918B)' },
  { carrier: 'Airtel', network_type: '4G', download_speed: 32.4, upload_speed: 9.1, ping: 29.2, jitter: 4.8, latitude: 28.6139, longitude: 77.2090, location_name: 'Delhi, India', device_info: 'Mozilla/5.0 (Linux; Android 13; OnePlus 11)' },
  { carrier: 'T-Mobile', network_type: '5G', download_speed: 215.1, upload_speed: 41.6, ping: 22.0, jitter: 3.2, latitude: 37.7749, longitude: -122.4194, location_name: 'San Francisco, USA', device_info: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
  { carrier: 'EE', network_type: '4G', download_speed: 48.7, upload_speed: 12.3, ping: 26.4, jitter: 3.9, latitude: 51.5074, longitude: -0.1278, location_name: 'London, UK', device_info: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
   { carrier: 'voda', network_type: '4G', download_speed: 190.2, upload_speed: 35.4, ping: 15.5, jitter: 2.1, latitude: 19.0760, longitude: 72.8777, location_name: 'kolkata, India', device_info: 'Mozilla/5.0 (Linux; Android 24; SM-S718B)' },
  { carrier: 'SoftBank', network_type: '5G', download_speed: 154.6, upload_speed: 31.2, ping: 16.8, jitter: 1.9, latitude: 35.6762, longitude: 139.6503, location_name: 'Tokyo, Japan', device_info: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X)' }
];

async function seedDataIfEmpty() {
  try {
    const history = await getHistory(1);
    if (history.length === 0) {
      console.log('Database is empty. Seeding realistic sample network speed reports...');
      for (const item of SEED_DATA) {
        await saveTest(item);
      }
      console.log('Successfully seeded database with 6 initial records.');
    }
  } catch (err) {
    console.error('Error seeding database:', err);
  }
}

// Helper to write JSON DB
function writeJsonDb(data) {
  fs.writeFileSync(JSON_DB_PATH, JSON.stringify(data, null, 2), 'utf8');
}

// Helper to read JSON DB
function readJsonDb() {
  if (!fs.existsSync(JSON_DB_PATH)) {
    writeJsonDb([]);
    return [];
  }
  try {
    const raw = fs.readFileSync(JSON_DB_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading JSON DB, resetting:', err);
    writeJsonDb([]);
    return [];
  }
}

// Initialize Database
function init() {
  return new Promise((resolve) => {
    try {
      const sqlite3 = require('sqlite3').verbose();
      const dbPath = path.join(__dirname, 'tests.sqlite');
      
      dbInstance = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          console.warn('Could not open SQLite database, falling back to JSON storage:', err.message);
          useJsonFallback(resolve);
        } else {
          dbInstance.run(`
            CREATE TABLE IF NOT EXISTS speed_tests (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              carrier TEXT NOT NULL,
              network_type TEXT NOT NULL,
              download_speed REAL NOT NULL,
              upload_speed REAL NOT NULL,
              ping REAL NOT NULL,
              jitter REAL NOT NULL,
              latitude REAL NOT NULL,
              longitude REAL NOT NULL,
              location_name TEXT,
              device_info TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
          `, (tableErr) => {
            if (tableErr) {
              console.warn('Error creating SQLite table, falling back to JSON:', tableErr.message);
              useJsonFallback(resolve);
            } else {
              console.log('SQLite database initialized successfully at:', dbPath);
              dbType = 'sqlite';
              seedDataIfEmpty().then(() => resolve(true));
            }
          });
        }
      });
    } catch (err) {
      console.warn('sqlite3 module not available or failed to load. Falling back to JSON storage.');
      useJsonFallback(resolve);
    }
  });
}

function useJsonFallback(resolve) {
  dbType = 'json';
  console.log('JSON File database initialized successfully at:', JSON_DB_PATH);
  // Ensure the file exists and is valid
  readJsonDb();
  seedDataIfEmpty().then(() => resolve(true));
}

// Save a new speed test
function saveTest(test) {
  return new Promise((resolve, reject) => {
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
    } = test;

    const createdAt = new Date().toISOString();

    if (dbType === 'sqlite') {
      const query = `
        INSERT INTO speed_tests (
          carrier, network_type, download_speed, upload_speed, ping, jitter, latitude, longitude, location_name, device_info, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      dbInstance.run(query, [
        carrier,
        network_type,
        download_speed,
        upload_speed,
        ping,
        jitter,
        latitude,
        longitude,
        location_name,
        device_info,
        createdAt
      ], function(err) {
        if (err) {
          return reject(err);
        }
        resolve({
          id: this.lastID,
          carrier,
          network_type,
          download_speed,
          upload_speed,
          ping,
          jitter,
          latitude,
          longitude,
          location_name,
          device_info,
          created_at: createdAt
        });
      });
    } else {
      // JSON storage fallback
      try {
        const tests = readJsonDb();
        const newId = tests.length > 0 ? Math.max(...tests.map(t => t.id || 0)) + 1 : 1;
        const newRecord = {
          id: newId,
          carrier,
          network_type,
          download_speed: parseFloat(download_speed),
          upload_speed: parseFloat(upload_speed),
          ping: parseFloat(ping),
          jitter: parseFloat(jitter),
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          location_name,
          device_info,
          created_at: createdAt
        };
        tests.push(newRecord);
        writeJsonDb(tests);
        resolve(newRecord);
      } catch (err) {
        reject(err);
      }
    }
  });
}

// Get recent history
function getHistory(limit = 50) {
  return new Promise((resolve, reject) => {
    if (dbType === 'sqlite') {
      const query = `SELECT * FROM speed_tests ORDER BY created_at DESC LIMIT ?`;
      dbInstance.all(query, [limit], (err, rows) => {
        if (err) {
          return reject(err);
        }
        resolve(rows);
      });
    } else {
      try {
        const tests = readJsonDb();
        // Sort DESC by created_at and limit
        const sorted = [...tests].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        resolve(sorted.slice(0, limit));
      } catch (err) {
        reject(err);
      }
    }
  });
}

// Get aggregated analytics
function getAnalytics() {
  return new Promise((resolve, reject) => {
    if (dbType === 'sqlite') {
      const carrierQuery = `
        SELECT 
          carrier,
          COUNT(*) as test_count,
          AVG(download_speed) as avg_download,
          AVG(upload_speed) as avg_upload,
          AVG(ping) as avg_ping
        FROM speed_tests
        GROUP BY carrier
        ORDER BY test_count DESC
      `;
      const techQuery = `
        SELECT 
          network_type,
          COUNT(*) as test_count,
          AVG(download_speed) as avg_download,
          AVG(upload_speed) as avg_upload
        FROM speed_tests
        GROUP BY network_type
      `;
      const statsQuery = `
        SELECT 
          COUNT(*) as total_tests,
          MAX(download_speed) as max_download,
          AVG(download_speed) as avg_download,
          AVG(upload_speed) as avg_upload,
          AVG(ping) as avg_ping
        FROM speed_tests
      `;

      dbInstance.all(statsQuery, [], (err, statsRows) => {
        if (err) return reject(err);
        dbInstance.all(carrierQuery, [], (err, carrierRows) => {
          if (err) return reject(err);
          dbInstance.all(techQuery, [], (err, techRows) => {
            if (err) return reject(err);
            resolve({
              summary: statsRows[0] || { total_tests: 0, max_download: 0, avg_download: 0, avg_upload: 0, avg_ping: 0 },
              carriers: carrierRows,
              technologies: techRows
            });
          });
        });
      });
    } else {
      try {
        const tests = readJsonDb();
        const total_tests = tests.length;
        if (total_tests === 0) {
          return resolve({
            summary: { total_tests: 0, max_download: 0, avg_download: 0, avg_upload: 0, avg_ping: 0 },
            carriers: [],
            technologies: []
          });
        }

        // Calculations for summary
        let max_download = 0;
        let sum_download = 0;
        let sum_upload = 0;
        let sum_ping = 0;

        // Group by carriers and technologies
        const carrierGroups = {};
        const techGroups = {};

        tests.forEach(t => {
          sum_download += t.download_speed;
          sum_upload += t.upload_speed;
          sum_ping += t.ping;
          if (t.download_speed > max_download) {
            max_download = t.download_speed;
          }

          // Carrier aggregation
          if (!carrierGroups[t.carrier]) {
            carrierGroups[t.carrier] = { count: 0, sum_down: 0, sum_up: 0, sum_ping: 0 };
          }
          carrierGroups[t.carrier].count++;
          carrierGroups[t.carrier].sum_down += t.download_speed;
          carrierGroups[t.carrier].sum_up += t.upload_speed;
          carrierGroups[t.carrier].sum_ping += t.ping;

          // Tech aggregation
          if (!techGroups[t.network_type]) {
            techGroups[t.network_type] = { count: 0, sum_down: 0, sum_up: 0 };
          }
          techGroups[t.network_type].count++;
          techGroups[t.network_type].sum_down += t.download_speed;
          techGroups[t.network_type].sum_up += t.upload_speed;
        });

        const carriersList = Object.keys(carrierGroups).map(c => ({
          carrier: c,
          test_count: carrierGroups[c].count,
          avg_download: carrierGroups[c].sum_down / carrierGroups[c].count,
          avg_upload: carrierGroups[c].sum_up / carrierGroups[c].count,
          avg_ping: carrierGroups[c].sum_ping / carrierGroups[c].count
        })).sort((a, b) => b.test_count - a.test_count);

        const techList = Object.keys(techGroups).map(tech => ({
          network_type: tech,
          test_count: techGroups[tech].count,
          avg_download: techGroups[tech].sum_down / techGroups[tech].count,
          avg_upload: techGroups[tech].sum_up / techGroups[tech].count
        }));

        resolve({
          summary: {
            total_tests,
            max_download,
            avg_download: sum_download / total_tests,
            avg_upload: sum_upload / total_tests,
            avg_ping: sum_ping / total_tests
          },
          carriers: carriersList,
          technologies: techList
        });
      } catch (err) {
        reject(err);
      }
    }
  });
}

module.exports = {
  init,
  saveTest,
  getHistory,
  getAnalytics
};
