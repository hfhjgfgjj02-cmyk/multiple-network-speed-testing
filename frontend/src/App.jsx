import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import SpeedGauge from './components/SpeedGauge';
import MapDashboard from './components/MapDashboard';
import HistoryFeed from './components/HistoryFeed';
import Analytics from './components/Analytics';
import { Activity, Wifi, ShieldCheck, HeartPulse } from 'lucide-react';
import './App.css';

// Dynamically determine the backend URL
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:5000'
  : window.location.origin;

export default function App() {
  const [testLogs, setTestLogs] = useState([]);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [activeCenter, setActiveCenter] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  // Initial data loading from the backend APIs
  useEffect(() => {
    async function fetchInitialData() {
      try {
        const historyRes = await fetch(`${API_BASE_URL}/api/speedtest/history?limit=50`);
        const historyData = await historyRes.json();
        setTestLogs(historyData);

        const analyticsRes = await fetch(`${API_BASE_URL}/api/speedtest/analytics`);
        const analyticsData = await analyticsRes.json();
        setAnalyticsData(analyticsData);
      } catch (err) {
        console.error('Failed to load initial speed monitor data:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchInitialData();
  }, []);

  // Connect WebSockets for real-time updates
  useEffect(() => {
    const socket = io(API_BASE_URL);

    socket.on('connect', () => {
      console.log('Real-time Socket.io connected to:', API_BASE_URL);
      setSocketConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('Real-time Socket.io disconnected');
      setSocketConnected(false);
    });

    // Listen for new speed tests reported by users anywhere
    socket.on('new_speed_test', (newTest) => {
      setTestLogs((prevLogs) => {
        // Prevent duplicate logs
        if (prevLogs.find((t) => t.id === newTest.id)) return prevLogs;
        return [newTest, ...prevLogs];
      });
      // Optionally slide map viewpoint to this new test
      setActiveCenter({ latitude: newTest.latitude, longitude: newTest.longitude });
    });

    // Listen for aggregate analytics recalculations
    socket.on('analytics_update', (updatedAnalytics) => {
      setAnalyticsData(updatedAnalytics);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleTestComplete = (savedRecord) => {
    // Manually add to log list (socket will also broadcast but this ensures immediate UI response)
    setTestLogs((prevLogs) => {
      if (prevLogs.find((t) => t.id === savedRecord.id)) return prevLogs;
      return [savedRecord, ...prevLogs];
    });
    // Center map on the completed test location
    setActiveCenter({ latitude: savedRecord.latitude, longitude: savedRecord.longitude });
  };

  const handleSelectTest = (test) => {
    setActiveCenter({ latitude: test.latitude, longitude: test.longitude });
    
    // Smooth scroll user to the map on small screens
    const mapElement = document.querySelector('.map-wrapper');
    if (mapElement) {
      mapElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return (
    <div className="app-container">
      {/* Premium Header */}
      <header className="app-header glass-card">
        <div className="brand">
          <div className="brand-icon">
            <Wifi size={24} />
          </div>
          <div>
            <h1 className="brand-title">NetCrowd</h1>
            <p style={{ fontSize: '10px', color: 'var(--color-text-secondary)', letterSpacing: '0.05em' }}>
              REAL-TIME SIM & NETWORK CROWDSOURCING
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255, 255, 255, 0.03)', padding: '6px 12px', borderRadius: '20px', border: '1px solid var(--border-color)', fontSize: '12px' }}>
            <span style={{ 
              width: '8px', 
              height: '8px', 
              borderRadius: '50%', 
              backgroundColor: socketConnected ? 'var(--color-green)' : 'var(--color-red)',
              boxShadow: socketConnected ? '0 0 8px var(--color-green)' : '0 0 8px var(--color-red)'
            }} />
            <span style={{ color: socketConnected ? 'var(--color-text-primary)' : 'var(--color-text-muted)', fontWeight: '600' }}>
              {socketConnected ? 'Live Feed Connected' : 'Connecting Stream...'}
            </span>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="loader-container glass-card" style={{ height: '400px' }}>
          <div className="spinner"></div>
          <p className="text-secondary" style={{ fontFamily: 'var(--font-heading)' }}>INITIALIZING CROWD MONITOR CONTROL PANEL...</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Top Level Summary Statistics */}
          <Analytics analyticsData={analyticsData} />

          {/* Core App Grid Layout */}
          <div className="app-grid">
            {/* Left Column: Tester and Recent logs */}
            <div className="column">
              <SpeedGauge apiBaseUrl={API_BASE_URL} onTestComplete={handleTestComplete} />
              <HistoryFeed testLogs={testLogs} onSelectTest={handleSelectTest} />
            </div>

            {/* Right Column: Leaflet Map Dashboard */}
            <div className="column">
              <MapDashboard testLogs={testLogs} activeCenter={activeCenter} />
            </div>
          </div>
        </div>
      )}

      {/* Footer copyright */}
      <footer style={{ marginTop: '40px', paddingBottom: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--color-text-muted)' }}>
        <span>&copy; {new Date().getFullYear()} NetCrowd speed monitor. All rights reserved.</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <ShieldCheck size={12} className="text-cyan" /> Secure crowdsourced measurements.
        </span>
      </footer>
    </div>
  );
}
