import React, { useState, useEffect, useRef } from 'react';
import { runSpeedTest } from '../utils/speedtest';
import { Wifi, MapPin, Play, Square, Award, ArrowDown, ArrowUp, RefreshCw, Map } from 'lucide-react';
import { INDIA_LOCATIONS } from '../utils/india_locations';

export default function SpeedGauge({ apiBaseUrl, onTestComplete }) {
  const [carrier, setCarrier] = useState('');
  const [networkType, setNetworkType] = useState('5G');
  const [lat, setLat] = useState(null);
  const [lon, setLon] = useState(null);
  const [locationName, setLocationName] = useState('');
  
  // India State/District/Village location states
  const [locMode, setLocMode] = useState('india-list'); // 'india-list' or 'gps'
  const [selectedState, setSelectedState] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [villageName, setVillageName] = useState('');
  
  const [testState, setTestState] = useState('idle'); // idle, testing, finished, error
  const [currentPhase, setCurrentPhase] = useState(''); // ping, download, upload
  const [progress, setProgress] = useState(0);
  const [instantSpeed, setInstantSpeed] = useState(0);
  const [avgSpeed, setAvgSpeed] = useState(0);
  
  // Final results
  const [ping, setPing] = useState(0);
  const [jitter, setJitter] = useState(0);
  const [download, setDownload] = useState(0);
  const [upload, setUpload] = useState(0);
  
  const [errorMessage, setErrorMessage] = useState('');
  const abortControllerRef = useRef(null);

  // Auto detect network type if supported
  useEffect(() => {
    if (navigator.connection) {
      const type = navigator.connection.type;
      const effectiveType = navigator.connection.effectiveType;
      if (type === 'wifi') {
        setNetworkType('Wi-Fi');
      } else if (effectiveType) {
        setNetworkType(effectiveType.toUpperCase());
      }
    }
  }, []);

  // Fetch Location coordinates and reverse geocode
  const requestLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }
    
    setTestState('loading_location');
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        setLat(latitude);
        setLon(longitude);
        
        try {
          // Attempt reverse geocoding via OpenStreetMap Nominatim
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=12`, {
            headers: {
              'User-Agent': 'NetworkSpeedMonitorApp'
            }
          });
          const data = await res.json();
          const address = data.address || {};
          const city = address.city || address.town || address.village || address.suburb || address.county || '';
          const country = address.country || '';
          const resolvedName = city ? `${city}, ${country}` : country || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
          setLocationName(resolvedName);
        } catch (e) {
          console.warn('Geocoding failed, falling back to raw coordinates:', e);
          setLocationName(`GPS: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        }
        setTestState('idle');
      },
      (error) => {
        console.error('Location error:', error);
        alert('Could not determine location. Please allow location access or type it manually.');
        setTestState('idle');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const startTest = async () => {
    if (!carrier.trim()) {
      alert('Please enter your Carrier name (e.g. Jio, Airtel, T-Mobile, Verizon)');
      return;
    }

    let finalLat = lat;
    let finalLon = lon;
    let finalLocName = locationName;

    // Resolve India selection if in list mode
    if (locMode === 'india-list') {
      if (!selectedState) {
        alert('Please select an Indian State.');
        return;
      }
      if (!selectedDistrict) {
        alert('Please select a District.');
        return;
      }
      if (!villageName.trim()) {
        alert('Please enter a Village/Town name.');
        return;
      }

      setTestState('loading_location');
      try {
        const query = `${villageName.trim()}, ${selectedDistrict}, ${selectedState}, India`;
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
        
        const res = await fetch(url, {
          headers: { 'User-Agent': 'NetCrowdSpeedMonitor' }
        });
        const data = await res.json();
        
        if (data && data.length > 0) {
          finalLat = parseFloat(data[0].lat);
          finalLon = parseFloat(data[0].lon);
          finalLocName = `${villageName.trim()}, ${selectedDistrict}, ${selectedState}`;
          setLat(finalLat);
          setLon(finalLon);
          setLocationName(finalLocName);
        } else {
          // Fallback to District center
          console.warn('OSM Village coordinates not found. Querying district center...');
          const districtQuery = `${selectedDistrict}, ${selectedState}, India`;
          const distUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(districtQuery)}&format=json&limit=1`;
          const distRes = await fetch(distUrl, { headers: { 'User-Agent': 'NetCrowdSpeedMonitor' } });
          const distData = await distRes.json();
          
          if (distData && distData.length > 0) {
            finalLat = parseFloat(distData[0].lat);
            finalLon = parseFloat(distData[0].lon);
            finalLocName = `${villageName.trim()} (Est.), ${selectedDistrict}, ${selectedState}`;
            setLat(finalLat);
            setLon(finalLon);
            setLocationName(finalLocName);
          } else {
            throw new Error('District center coordinates not found');
          }
        }
      } catch (err) {
        console.error('Failed to resolve coordinates:', err);
        // Fallback center of India coordinates
        finalLat = 20.5937;
        finalLon = 78.9629;
        finalLocName = `${villageName.trim()}, ${selectedDistrict}, ${selectedState}`;
        setLat(finalLat);
        setLon(finalLon);
        setLocationName(finalLocName);
      }
      setTestState('idle'); // Reset loader state
    } else {
      // GPS mode validation
      if (finalLat === null || finalLon === null) {
        alert('Please click the Locate button to resolve your device GPS coordinates first.');
        return;
      }
    }

    setErrorMessage('');
    setTestState('testing');
    setProgress(0);
    setInstantSpeed(0);
    setAvgSpeed(0);
    setPing(0);
    setJitter(0);
    setDownload(0);
    setUpload(0);

    abortControllerRef.current = new AbortController();

    try {
      const results = await runSpeedTest(apiBaseUrl, {
        signal: abortControllerRef.current.signal,
        onProgress: (data) => {
          setCurrentPhase(data.phase);
          setProgress(data.percent);
          if (data.phase === 'ping') {
            setPing(data.ping);
            setJitter(data.jitter);
          } else {
            setInstantSpeed(data.instantSpeedMbps);
            setAvgSpeed(data.avgSpeedMbps);
          }
        }
      });

      // Populate final speeds
      setDownload(results.download);
      setUpload(results.upload);
      setTestState('finished');

      // Send report to backend
      const reportResponse = await fetch(`${apiBaseUrl}/api/speedtest/report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          carrier,
          network_type: networkType,
          download_speed: results.download,
          upload_speed: results.upload,
          ping: results.ping,
          jitter: results.jitter,
          latitude: finalLat,
          longitude: finalLon,
          location_name: finalLocName,
          device_info: navigator.userAgent
        })
      });

      if (reportResponse.ok && onTestComplete) {
        const savedTest = await reportResponse.json();
        onTestComplete(savedTest);
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        setTestState('idle');
      } else {
        console.error('Speed test error:', err);
        setErrorMessage(err.message || 'Speed test failed. Please try again.');
        setTestState('error');
      }
    }
  };

  const cancelTest = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  // SVG Gauge calculations
  // Radius of circle = 90. Circumference = 2 * PI * 90 = 565.48
  // We use 3/4 circle gauge (from 225 degrees to -45 degrees)
  const radius = 90;
  const circumference = 2 * Math.PI * radius;
  const arcLength = circumference * 0.75; // 3/4 circle
  
  // Decide max gauge range dynamically: 100, 500, or 1000 Mbps
  let maxDialSpeed = 100;
  if (instantSpeed > 500 || avgSpeed > 500) {
    maxDialSpeed = 1000;
  } else if (instantSpeed > 100 || avgSpeed > 100) {
    maxDialSpeed = 500;
  }

  const speedToDisplay = currentPhase === 'download' || currentPhase === 'upload' ? instantSpeed : 0;
  const ratio = Math.min(1, speedToDisplay / maxDialSpeed);
  const strokeDashoffset = circumference - (ratio * arcLength);

  return (
    <div className="glass-card glow-cyan" style={{ padding: '24px' }}>
      <h3 className="section-title">
        <Wifi size={20} className="text-cyan" />
        Network Speed Tester
      </h3>

      {testState === 'loading_location' && (
        <div className="loader-container">
          <div className="spinner"></div>
          <p className="text-secondary">Acquiring GPS location & geocoding...</p>
        </div>
      )}

      {(testState === 'idle' || testState === 'error') && (
        <div className="setup-form">
          {errorMessage && (
            <div style={{ color: 'var(--color-red)', fontSize: '13px', background: 'rgba(239, 68, 68, 0.1)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              {errorMessage}
            </div>
          )}

          <div className="input-group">
            <label>1. Mobile Network / Carrier (SIM)</label>
            <input
              type="text"
              className="input-control"
              placeholder="e.g. Jio, Airtel, T-Mobile, Verizon"
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
            />
          </div>

          <div className="input-group">
            <label>2. Connection Type</label>
            <select
              className="input-control"
              value={networkType}
              onChange={(e) => setNetworkType(e.target.value)}
            >
              <option value="5G">5G Network</option>
              <option value="4G">4G / LTE</option>
              <option value="3G">3G</option>
              <option value="Wi-Fi">Wi-Fi Broadband</option>
            </select>
          </div>

          <div className="input-group">
            <label>3. Location Mode</label>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
              <button
                type="button"
                className="input-control"
                style={{
                  flex: 1,
                  background: locMode === 'india-list' ? 'rgba(0, 242, 254, 0.12)' : 'rgba(255,255,255,0.02)',
                  borderColor: locMode === 'india-list' ? 'var(--color-cyan)' : 'var(--border-color)',
                  color: locMode === 'india-list' ? 'white' : 'var(--color-text-secondary)',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
                onClick={() => setLocMode('india-list')}
              >
                India Directory
              </button>
              <button
                type="button"
                className="input-control"
                style={{
                  flex: 1,
                  background: locMode === 'gps' ? 'rgba(0, 242, 254, 0.12)' : 'rgba(255,255,255,0.02)',
                  borderColor: locMode === 'gps' ? 'var(--color-cyan)' : 'var(--border-color)',
                  color: locMode === 'gps' ? 'white' : 'var(--color-text-secondary)',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
                onClick={() => setLocMode('gps')}
              >
                Device GPS
              </button>
            </div>
          </div>

          {locMode === 'india-list' ? (
            <>
              <div className="input-group">
                <label>Select State</label>
                <select
                  className="input-control"
                  value={selectedState}
                  onChange={(e) => {
                    setSelectedState(e.target.value);
                    setSelectedDistrict('');
                  }}
                >
                  <option value="">-- Choose State --</option>
                  {Object.keys(INDIA_LOCATIONS).sort().map(state => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
              </div>

              {selectedState && (
                <div className="input-group">
                  <label>Select District</label>
                  <select
                    className="input-control"
                    value={selectedDistrict}
                    onChange={(e) => setSelectedDistrict(e.target.value)}
                  >
                    <option value="">-- Choose District --</option>
                    {INDIA_LOCATIONS[selectedState].sort().map(dist => (
                      <option key={dist} value={dist}>{dist}</option>
                    ))}
                  </select>
                </div>
              )}

              {selectedDistrict && (
                <div className="input-group" style={{ animation: 'slide-in 0.3s ease-out' }}>
                  <label>Village / Town Name</label>
                  <input
                    type="text"
                    className="input-control"
                    placeholder="Type Village/Town name (e.g. Shirdi, Vagator)"
                    value={villageName}
                    onChange={(e) => setVillageName(e.target.value)}
                  />
                </div>
              )}
            </>
          ) : (
            <div className="input-group">
              <label>Device GPS Coordinates</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  className="input-control"
                  placeholder="Click Locate button"
                  value={locationName}
                  readOnly
                />
                <button
                  type="button"
                  className="btn-primary"
                  onClick={requestLocation}
                  style={{ padding: '0 16px', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid var(--border-color)', boxShadow: 'none' }}
                >
                  <MapPin size={16} />
                </button>
              </div>
              {lat !== null && (
                <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                  Coordinates: {lat.toFixed(5)}, {lon.toFixed(5)}
                </span>
              )}
            </div>
          )}

          <button
            className="btn-primary"
            onClick={startTest}
            disabled={
              !carrier.trim() || 
              (locMode === 'gps' && lat === null) || 
              (locMode === 'india-list' && (!selectedState || !selectedDistrict || !villageName.trim()))
            }
            style={{ marginTop: '12px' }}
          >
            <Play size={18} /> Run speed test
          </button>
        </div>
      )}

      {testState === 'testing' && (
        <div className="gauge-container">
          <div className="gauge-svg-wrapper">
            <svg width="280" height="280" viewBox="0 0 200 200" style={{ transform: 'rotate(135deg)' }}>
              {/* Background Arc */}
              <circle
                cx="100"
                cy="100"
                r={radius}
                className="gauge-bg-circle"
                strokeDasharray={`${arcLength} ${circumference}`}
              />
              {/* Live Glowing Colored Progress Arc */}
              <circle
                cx="100"
                cy="100"
                r={radius}
                className="gauge-progress-circle"
                style={{
                  color: currentPhase === 'download' ? 'var(--color-green)' : 'var(--color-magenta)'
                }}
                stroke={currentPhase === 'download' ? 'var(--color-green)' : 'var(--color-magenta)'}
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
              />
            </svg>

            {/* Glowing Text overlay */}
            <div className="gauge-text">
              <span className="gauge-val">
                {currentPhase === 'ping' ? '...' : instantSpeed.toFixed(1)}
              </span>
              <span className="gauge-unit">
                {currentPhase === 'ping' ? 'PINGING' : 'Mbps'}
              </span>
              <span className="gauge-label" style={{ color: currentPhase === 'download' ? 'var(--color-green)' : 'var(--color-magenta)' }}>
                {currentPhase === 'ping' && 'Latency Phase'}
                {currentPhase === 'download' && 'Downloading...'}
                {currentPhase === 'upload' && 'Uploading...'}
              </span>
              <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                Avg: {avgSpeed.toFixed(1)} Mbps
              </span>
            </div>
          </div>

          {/* Sub progress line */}
          <div style={{ width: '100%', marginTop: '16px' }}>
            <div className="flex-between" style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
              <span>Phase Progress</span>
              <span>{progress}%</span>
            </div>
            <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
              <div 
                style={{ 
                  height: '100%', 
                  width: `${progress}%`, 
                  background: currentPhase === 'download' ? 'var(--color-green)' : currentPhase === 'upload' ? 'var(--color-magenta)' : 'var(--color-cyan)',
                  transition: 'width 0.2s' 
                }} 
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px', marginTop: '24px', width: '100%' }}>
            <div className="result-stat-card ping" style={{ flex: 1, padding: '10px' }}>
              <span className="stat-label">Ping</span>
              <span className="stat-value" style={{ fontSize: '18px' }}>{ping > 0 ? `${Math.round(ping)} ms` : '--'}</span>
            </div>
            <div className="result-stat-card jitter" style={{ flex: 1, padding: '10px' }}>
              <span className="stat-label">Jitter</span>
              <span className="stat-value" style={{ fontSize: '18px' }}>{jitter > 0 ? `${Math.round(jitter)} ms` : '--'}</span>
            </div>
          </div>

          <button className="btn-danger" onClick={cancelTest} style={{ width: '100%', marginTop: '20px' }}>
            <Square size={16} /> Cancel Test
          </button>
        </div>
      )}

      {testState === 'finished' && (
        <div>
          <div style={{ textAlign: 'center', padding: '12px 0 24px 0' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--color-green)', display: 'inline-flex', alignItems: 'center', justifyCenter: 'center', justifyContent: 'center', color: 'var(--color-green)', marginBottom: '12px' }}>
              <Award size={28} />
            </div>
            <h4 style={{ fontSize: '18px', fontWeight: '700', color: 'white' }}>Test Completed</h4>
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>Results submitted successfully for {carrier} ({networkType})</p>
          </div>

          <div className="results-grid">
            <div className="result-stat-card download">
              <span className="stat-label">
                <ArrowDown size={12} className="text-green" /> Download
              </span>
              <span className="stat-value text-green">{download.toFixed(2)} <span style={{ fontSize: '12px', fontWeight: '500' }}>Mbps</span></span>
            </div>
            <div className="result-stat-card upload">
              <span className="stat-label">
                <ArrowUp size={12} className="text-magenta" /> Upload
              </span>
              <span className="stat-value text-magenta">{upload.toFixed(2)} <span style={{ fontSize: '12px', fontWeight: '500' }}>Mbps</span></span>
            </div>
            <div className="result-stat-card ping">
              <span className="stat-label">Ping</span>
              <span className="stat-value">{ping.toFixed(1)} <span style={{ fontSize: '12px', fontWeight: '500' }}>ms</span></span>
            </div>
            <div className="result-stat-card jitter">
              <span className="stat-label">Jitter</span>
              <span className="stat-value">{jitter.toFixed(1)} <span style={{ fontSize: '12px', fontWeight: '500' }}>ms</span></span>
            </div>
          </div>

          <button className="btn-primary" onClick={() => setTestState('idle')} style={{ width: '100%', marginTop: '24px' }}>
            <RefreshCw size={16} /> Test Again
          </button>
        </div>
      )}
    </div>
  );
}
