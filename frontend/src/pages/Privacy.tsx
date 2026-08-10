import { Shield, Lock, Database, Eye, Download, Trash2, Check } from 'lucide-react';
import './Privacy.css';

function Privacy() {
  return (
    <div className="privacy-page">
      <div className="privacy-header">
        <div>
          <h1>Privacy Center</h1>
          <p className="subtitle">Complete transparency and control over your data</p>
        </div>
      </div>

      <div className="privacy-content">
        {/* Privacy Overview */}
        <div className="privacy-card highlight">
          <div className="card-icon">
            <Shield size={32} />
          </div>
          <div className="card-content">
            <h2>Privacy-First Design</h2>
            <p>
              LifeOS is built with privacy as a core principle. All data processing happens 
              locally on your device. No data is sent to external servers without your explicit consent.
            </p>
          </div>
        </div>

        {/* Data Storage */}
        <div className="section-card">
          <h3><Database size={20} /> Data Storage</h3>
          <div className="storage-grid">
            <div className="storage-item">
              <div className="storage-header">
                <Lock size={20} />
                <h4>Local Storage</h4>
              </div>
              <div className="storage-details">
                <div className="storage-row">
                  <span className="storage-label">Location:</span>
                  <span className="storage-value">Device SQLite Database</span>
                </div>
                <div className="storage-row">
                  <span className="storage-label">Encryption:</span>
                  <span className="storage-value status-success">
                    <Check size={14} /> At-rest encryption
                  </span>
                </div>
                <div className="storage-row">
                  <span className="storage-label">Data Types:</span>
                  <span className="storage-value">
                    Events, entities, relations, interventions
                  </span>
                </div>
              </div>
            </div>

            <div className="storage-item">
              <div className="storage-header">
                <Eye size={20} />
                <h4>Cloud Storage</h4>
              </div>
              <div className="storage-details">
                <div className="storage-row">
                  <span className="storage-label">Status:</span>
                  <span className="storage-value status-disabled">Disabled</span>
                </div>
                <div className="storage-row">
                  <span className="storage-label">Sync:</span>
                  <span className="storage-value">Not configured</span>
                </div>
                <div className="storage-row">
                  <span className="storage-label">Note:</span>
                  <span className="storage-value">
                    Cloud sync can be enabled in settings
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* What We Collect */}
        <div className="section-card">
          <h3>What We Collect</h3>
          <div className="collection-list">
            <div className="collection-item">
              <div className="collection-icon">
                <Check size={16} />
              </div>
              <div className="collection-content">
                <h4>Context Events</h4>
                <p>Notifications, calendar events, location updates, sensor data</p>
              </div>
            </div>
            <div className="collection-item">
              <div className="collection-icon">
                <Check size={16} />
              </div>
              <div className="collection-content">
                <h4>Derived Entities</h4>
                <p>People, places, tasks, documents extracted from events</p>
              </div>
            </div>
            <div className="collection-item">
              <div className="collection-icon">
                <Check size={16} />
              </div>
              <div className="collection-content">
                <h4>Relationships</h4>
                <p>Connections between entities based on context</p>
              </div>
            </div>
            <div className="collection-item">
              <div className="collection-icon">
                <Check size={16} />
              </div>
              <div className="collection-content">
                <h4>Interventions</h4>
                <p>Generated alerts and their confidence scores</p>
              </div>
            </div>
          </div>
        </div>

        {/* What We DON'T Collect */}
        <div className="section-card">
          <h3>What We DON'T Collect</h3>
          <div className="no-collection-list">
            <div className="no-collection-item">
              <span>✗ Personal conversations or message content</span>
            </div>
            <div className="no-collection-item">
              <span>✗ Precise GPS coordinates (only place labels)</span>
            </div>
            <div className="no-collection-item">
              <span>✗ Photos or media files</span>
            </div>
            <div className="no-collection-item">
              <span>✗ Browsing history or app usage</span>
            </div>
            <div className="no-collection-item">
              <span>✗ Biometric data</span>
            </div>
            <div className="no-collection-item">
              <span>✗ Financial information</span>
            </div>
          </div>
        </div>

        {/* Data Controls */}
        <div className="section-card">
          <h3>Your Data Controls</h3>
          <div className="controls-grid">
            <button className="control-btn">
              <Download size={20} />
              <div>
                <div className="control-title">Export Data</div>
                <div className="control-description">Download all your data in JSON format</div>
              </div>
            </button>

            <button className="control-btn danger">
              <Trash2 size={20} />
              <div>
                <div className="control-title">Delete All Data</div>
                <div className="control-description">Permanently remove all stored data</div>
              </div>
            </button>
          </div>
        </div>

        {/* Transparency Metrics */}
        <div className="section-card">
          <h3>Transparency Metrics</h3>
          <div className="metrics-grid">
            <div className="metric-box">
              <div className="metric-value">0</div>
              <div className="metric-label">Third-party trackers</div>
            </div>
            <div className="metric-box">
              <div className="metric-value">0</div>
              <div className="metric-label">Data shared externally</div>
            </div>
            <div className="metric-box">
              <div className="metric-value">100%</div>
              <div className="metric-label">Local processing</div>
            </div>
            <div className="metric-box">
              <div className="metric-value">Full</div>
              <div className="metric-label">User control</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Privacy;
