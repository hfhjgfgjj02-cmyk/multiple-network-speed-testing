import React from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { BarChart3, Database, Award, ArrowUpRight, Activity } from 'lucide-react';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

export default function Analytics({ analyticsData }) {
  if (!analyticsData || !analyticsData.summary) {
    return (
      <div className="loader-container glass-card" style={{ height: '250px' }}>
        <div className="spinner"></div>
        <p className="text-secondary">Loading network metrics...</p>
      </div>
    );
  }

  const { summary, carriers, technologies } = analyticsData;

  // 1. Setup Carrier Chart Data
  // Take top 6 carriers for clean bar chart representation
  const topCarriers = carriers.slice(0, 6);
  const carrierChartData = {
    labels: topCarriers.map(c => c.carrier),
    datasets: [
      {
        label: 'Avg Download Speed (Mbps)',
        data: topCarriers.map(c => Math.round(c.avg_download * 10) / 10),
        backgroundColor: 'rgba(0, 242, 254, 0.45)',
        borderColor: 'rgba(0, 242, 254, 1)',
        borderWidth: 2,
        borderRadius: 6,
        hoverBackgroundColor: 'rgba(0, 242, 254, 0.75)'
      },
      {
        label: 'Avg Upload Speed (Mbps)',
        data: topCarriers.map(c => Math.round(c.avg_upload * 10) / 10),
        backgroundColor: 'rgba(255, 0, 127, 0.45)',
        borderColor: 'rgba(255, 0, 127, 1)',
        borderWidth: 2,
        borderRadius: 6,
        hoverBackgroundColor: 'rgba(255, 0, 127, 0.75)'
      }
    ]
  };

  const carrierChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: '#f3f4f6',
          font: { family: 'Plus Jakarta Sans', size: 11 }
        }
      },
      tooltip: {
        backgroundColor: 'rgba(13, 19, 33, 0.95)',
        titleColor: '#fff',
        bodyColor: '#f3f4f6',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          color: '#9ca3af',
          font: { family: 'Space Grotesk', size: 11 }
        }
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.04)' },
        ticks: {
          color: '#9ca3af',
          font: { family: 'Space Grotesk', size: 10 }
        }
      }
    }
  };

  // 2. Setup Tech Doughnut Chart Data
  const techChartData = {
    labels: technologies.map(t => t.network_type),
    datasets: [
      {
        data: technologies.map(t => t.test_count),
        backgroundColor: [
          'rgba(16, 185, 129, 0.55)', // 5G
          'rgba(245, 158, 11, 0.55)',  // 4G
          'rgba(59, 130, 246, 0.55)',  // Wi-Fi
          'rgba(139, 92, 246, 0.55)',  // 3G/other
        ],
        borderColor: [
          '#10b981',
          '#f59e0b',
          '#3b82f6',
          '#8b5cf6',
        ],
        borderWidth: 1.5,
        hoverOffset: 6
      }
    ]
  };

  const techChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        labels: {
          color: '#f3f4f6',
          font: { family: 'Plus Jakarta Sans', size: 11 },
          boxWidth: 12
        }
      },
      tooltip: {
        backgroundColor: 'rgba(13, 19, 33, 0.95)',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>
      {/* 1. Summary Widgets Row */}
      <div className="analytics-summary-row">
        <div className="glass-card summary-widget glow-cyan">
          <div className="widget-title">
            <Database size={14} className="text-cyan" />
            Total Tests
          </div>
          <div className="widget-val">{summary.total_tests}</div>
          <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Global crowd sources</span>
        </div>

        <div className="glass-card summary-widget" style={{ borderColor: 'rgba(16, 185, 129, 0.2)' }}>
          <div className="widget-title">
            <Award size={14} className="text-green" />
            Max Download
          </div>
          <div className="widget-val text-green">{summary.max_download ? summary.max_download.toFixed(1) : '0.0'}</div>
          <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Mbps Peak speed</span>
        </div>

        <div className="glass-card summary-widget" style={{ borderColor: 'rgba(255, 0, 127, 0.2)' }}>
          <div className="widget-title">
            <ArrowUpRight size={14} className="text-magenta" />
            Avg Download
          </div>
          <div className="widget-val text-magenta">{summary.avg_download ? summary.avg_download.toFixed(1) : '0.0'}</div>
          <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Mbps average download</span>
        </div>

        <div className="glass-card summary-widget" style={{ borderColor: 'rgba(139, 92, 246, 0.2)' }}>
          <div className="widget-title">
            <Activity size={14} className="text-violet" />
            Avg Latency
          </div>
          <div className="widget-val text-violet">{summary.avg_ping ? Math.round(summary.avg_ping) : '0'} <span style={{ fontSize: '14px' }}>ms</span></div>
          <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Average ping response</span>
        </div>
      </div>

      {/* 2. Charts Section */}
      {summary.total_tests > 0 && (
        <div className="app-grid" style={{ gridTemplateColumns: '1.2fr 0.8fr', gap: '24px' }}>
          {/* Carrier speed Bar chart */}
          <div className="glass-card" style={{ padding: '24px' }}>
            <h3 className="section-title">
              <BarChart3 size={18} className="text-cyan" />
              Carrier Speed Performance (Mbps)
            </h3>
            <div style={{ height: '240px', position: 'relative' }}>
              <Bar data={carrierChartData} options={carrierChartOptions} />
            </div>
          </div>

          {/* Network type Distribution Doughnut */}
          <div className="glass-card" style={{ padding: '24px' }}>
            <h3 className="section-title">
              <Activity size={18} className="text-magenta" />
              Network Type Split
            </h3>
            <div style={{ height: '240px', position: 'relative' }}>
              <Doughnut data={techChartData} options={techChartOptions} />
            </div>
          </div>
        </div>
      )}

      {/* 3. Carrier Leaderboard Table */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <h3 className="section-title">
          <Award size={18} className="text-green" />
          Carrier Network Leaderboard
        </h3>
        
        {carriers.length === 0 ? (
          <div style={{ color: 'var(--color-text-muted)', padding: '20px 0', fontSize: '13px' }}>
            Run speed tests to rank carriers here.
          </div>
        ) : (
          <div className="carrier-table-container">
            <table className="carrier-table">
              <thead>
                <tr>
                  <th>Carrier</th>
                  <th>Tests Logged</th>
                  <th>Avg Download</th>
                  <th>Avg Upload</th>
                  <th>Avg Latency</th>
                </tr>
              </thead>
              <tbody>
                {carriers.map((c, index) => {
                  // Percentage bar calculation (max speed for comparison bar = 100Mbps)
                  const barPercent = Math.min(100, (c.avg_download / 100) * 100);
                  const barColor = c.avg_download >= 50 ? 'var(--color-green)' : c.avg_download >= 15 ? 'var(--color-orange)' : 'var(--color-red)';
                  
                  return (
                    <tr key={index}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', width: '16px' }}>#{index + 1}</span>
                          <strong style={{ color: 'white' }}>{c.carrier}</strong>
                        </div>
                      </td>
                      <td>{c.test_count} tests</td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ color: barColor, fontWeight: '700' }}>{c.avg_download.toFixed(2)} Mbps</span>
                          {/* visual progress bar */}
                          <div style={{ width: '120px', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{ width: `${barPercent}%`, height: '100%', background: barColor }} />
                          </div>
                        </div>
                      </td>
                      <td style={{ color: 'var(--color-magenta)' }}>{c.avg_upload.toFixed(2)} Mbps</td>
                      <td style={{ color: 'var(--color-violet)' }}>{c.avg_ping.toFixed(0)} ms</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
