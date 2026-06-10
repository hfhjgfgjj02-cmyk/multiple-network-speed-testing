import React from 'react';
import { Activity, MapPin, ArrowDown, ArrowUp, Zap, HelpCircle } from 'lucide-react';

export default function HistoryFeed({ testLogs, onSelectTest }) {
  
  // Format relative time (e.g. "Just Now", "5m ago")
  const formatRelativeTime = (isoString) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHr / 24);

    if (diffSec < 5) return 'Just Now';
    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDays === 1) return 'Yesterday';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const getTechBadgeClass = (tech) => {
    const t = tech ? tech.toUpperCase() : '';
    if (t.includes('WI-FI') || t.includes('WIFI')) return 'tech-badge wifi';
    if (t.includes('5G')) return 'tech-badge g5';
    if (t.includes('4G') || t.includes('LTE')) return 'tech-badge g4';
    return 'tech-badge';
  };

  return (
    <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="flex-between" style={{ marginBottom: '16px' }}>
        <h3 className="section-title" style={{ margin: 0 }}>
          <Activity size={20} className="text-magenta animate-pulse" />
          Live Quality Stream
        </h3>
        <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span className="pulse-red-dot"></span>
          REAL-TIME FEED
        </span>
      </div>

      {testLogs.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', minHeight: '200px', gap: '12px' }}>
          <HelpCircle size={36} style={{ strokeWidth: 1.5 }} />
          <p style={{ fontSize: '13px' }}>No speed tests reported yet.</p>
          <p style={{ fontSize: '11px', textAlign: 'center', maxWidth: '200px' }}>Run a speed test to add the very first entry!</p>
        </div>
      ) : (
        <div className="history-container" style={{ flex: 1 }}>
          {testLogs.map((test) => (
            <div key={test.id} className="history-item">
              <div className="feed-left">
                <div className="carrier-badge-row">
                  <span className="carrier-name">{test.carrier}</span>
                  <span className={getTechBadgeClass(test.network_type)}>
                    {test.network_type}
                  </span>
                </div>
                
                <div className="feed-location">
                  <MapPin size={11} className="text-cyan" />
                  <span style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {test.location_name || 'Unknown Location'}
                  </span>
                </div>
                
                <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                  {formatRelativeTime(test.created_at)}
                </span>
              </div>

              <div className="feed-right">
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div className="feed-speed-box">
                    <span className="feed-speed-label">
                      <ArrowDown size={10} style={{ display: 'inline', marginRight: '2px' }} /> Down
                    </span>
                    <span className="feed-speed-val down">
                      {test.download_speed.toFixed(1)} <span style={{ fontSize: '10px', fontWeight: '500' }}>Mb</span>
                    </span>
                  </div>
                  
                  <div className="feed-speed-box">
                    <span className="feed-speed-label">
                      <ArrowUp size={10} style={{ display: 'inline', marginRight: '2px' }} /> Up
                    </span>
                    <span className="feed-speed-val up">
                      {test.upload_speed.toFixed(1)} <span style={{ fontSize: '10px', fontWeight: '500' }}>Mb</span>
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => onSelectTest(test)}
                  style={{
                    background: 'rgba(0, 242, 254, 0.1)',
                    border: '1px solid rgba(0, 242, 254, 0.2)',
                    color: 'var(--color-cyan)',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-heading)',
                    fontWeight: '600',
                    transition: 'var(--transition-smooth)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--color-cyan)';
                    e.currentTarget.style.color = '#080c14';
                    e.currentTarget.style.boxShadow = 'var(--shadow-neon-cyan)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(0, 242, 254, 0.1)';
                    e.currentTarget.style.color = 'var(--color-cyan)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  Locate
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
