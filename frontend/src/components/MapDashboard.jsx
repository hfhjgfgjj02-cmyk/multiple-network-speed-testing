import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Map, Zap, ArrowDown, ArrowUp, Clock } from 'lucide-react';

// CSS for Leaflet styling import (leaflet.css must be imported)
import 'leaflet/dist/leaflet.css';

// Component to dynamically pan/zoom map when a new test arrives
function MapController({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, 9, { animate: true, duration: 1 });
    }
  }, [center, map]);
  return null;
}

// Custom Leaflet DivIcon factory that draws speed badges directly on map
const createSpeedIcon = (downloadSpeed, networkType) => {
  let color = 'var(--color-red)';
  let glow = 'rgba(239, 68, 68, 0.4)';
  
  if (downloadSpeed >= 50) {
    color = 'var(--color-green)';
    glow = 'rgba(16, 185, 129, 0.4)';
  } else if (downloadSpeed >= 15) {
    color = 'var(--color-orange)';
    glow = 'rgba(245, 158, 11, 0.4)';
  }

  const badgeText = downloadSpeed >= 100 ? Math.round(downloadSpeed) : downloadSpeed.toFixed(1);

  return L.divIcon({
    className: 'custom-leaflet-speed-pin',
    html: `
      <div style="
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: ${color};
        color: #080c14;
        border: 2px solid white;
        border-radius: 50%;
        width: 38px;
        height: 38px;
        font-family: 'Space Grotesk', sans-serif;
        font-size: 11px;
        font-weight: 700;
        box-shadow: 0 0 15px ${glow};
        transition: transform 0.2s;
      ">
        <span>${badgeText}</span>
        <span style="font-size: 6px; font-weight: 600; margin-top: -2px; text-transform: uppercase;">${networkType}</span>
      </div>
    `,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    popupAnchor: [0, -19]
  });
};

export default function MapDashboard({ testLogs, activeCenter }) {
  const defaultCenter = [20.5937, 78.9629]; // Default centered in India, handles global coordinates cleanly

  // Determine center coordinates
  const mapCenter = activeCenter && activeCenter.latitude && activeCenter.longitude
    ? [activeCenter.latitude, activeCenter.longitude]
    : testLogs.length > 0
      ? [testLogs[0].latitude, testLogs[0].longitude]
      : defaultCenter;

  return (
    <div className="glass-card" style={{ padding: '24px' }}>
      <h3 className="section-title">
        <Map size={20} className="text-cyan" />
        Global Network Quality Map
      </h3>
      <div className="map-wrapper">
        <MapContainer
          center={mapCenter}
          zoom={testLogs.length > 0 ? 6 : 4}
          scrollWheelZoom={true}
          className="map-container"
        >
          {/* Using CartoDB Dark Matter tiles which look incredibly premium and match our dark theme */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          
          {testLogs.map((test) => {
            if (!test.latitude || !test.longitude) return null;
            return (
              <Marker
                key={test.id}
                position={[test.latitude, test.longitude]}
                icon={createSpeedIcon(test.download_speed, test.network_type)}
              >
                <Popup>
                  <div style={{ fontFamily: 'var(--font-body)', width: '220px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '6px' }}>
                      <strong style={{ fontSize: '14px', color: 'white' }}>{test.carrier}</strong>
                      <span className={`tech-badge ${test.network_type === 'Wi-Fi' ? 'wifi' : test.network_type === '5G' ? 'g5' : 'g4'}`}>
                        {test.network_type}
                      </span>
                    </div>

                    <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={12} /> {new Date(test.created_at).toLocaleString()}
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <ArrowDown size={12} className="text-green" /> Download:
                        </span>
                        <strong className="text-green">{test.download_speed.toFixed(2)} Mbps</strong>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <ArrowUp size={12} className="text-magenta" /> Upload:
                        </span>
                        <strong className="text-magenta">{test.upload_speed.toFixed(2)} Mbps</strong>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '4px', marginTop: '4px' }}>
                        <span style={{ color: 'var(--color-text-secondary)' }}>Latency / Jitter:</span>
                        <span style={{ color: 'white' }}>{test.ping.toFixed(0)} / {test.jitter.toFixed(0)} ms</span>
                      </div>

                      <div style={{ color: 'var(--color-text-muted)', fontSize: '10px', marginTop: '4px', wordBreak: 'break-all' }}>
                        Location: {test.location_name}
                      </div>
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}

          <MapController center={mapCenter} />
        </MapContainer>
      </div>
      <div style={{ display: 'flex', gap: '16px', marginTop: '12px', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--color-green)' }}></span>
          <span>Fast (50+ Mbps)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--color-orange)' }}></span>
          <span>Moderate (15-50 Mbps)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--color-red)' }}></span>
          <span>Slow (&lt;15 Mbps)</span>
        </div>
      </div>
    </div>
  );
}
