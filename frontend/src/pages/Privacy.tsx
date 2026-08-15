import { useEffect, useState } from 'react';
import { Download, Trash2, PauseCircle, PlayCircle, ShieldCheck, HardDrive } from 'lucide-react';
import { privacyCenterApi } from '../services/api';
import './Privacy.css';

export function Privacy() {
  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    loadOverview();
  }, []);

  const loadOverview = async () => {
    try {
      setLoading(true);
      const res = await privacyCenterApi.getOverview();
      if (res.data?.data) {
        setOverview(res.data.data);
        setIsPaused(res.data.data.isPaused);
      }
    } catch (e) {
      console.error('Error loading privacy overview:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePause = async () => {
    try {
      const res = await privacyCenterApi.pause(!isPaused);
      setIsPaused(res.data.isPaused);
    } catch (e) {
      console.error('Error toggling pause:', e);
    }
  };

  const handleExportData = () => {
    window.open('/api/privacy-center/export', '_blank');
  };

  const handleClearCategory = async (catKey: string, catName: string) => {
    if (window.confirm(`Are you sure you want to delete all stored data for "${catName}"?`)) {
      try {
        await privacyCenterApi.clearCategory(catKey);
        alert(`${catName} data cleared.`);
        loadOverview();
      } catch (e) {
        console.error('Error clearing category:', e);
      }
    }
  };

  const handleClearLocation = async () => {
    if (window.confirm("Are you sure you want to delete today's raw location samples?")) {
      try {
        await privacyCenterApi.clear('today-location');
        alert("Today's location history has been cleared.");
        loadOverview();
      } catch (e) {
        console.error('Error clearing location:', e);
      }
    }
  };

  if (loading || !overview) {
    return <div className="loading-state">Loading Privacy Center...</div>;
  }

  const { categories, inventory, dataSizeKb, retentionPolicy, encryptionStatus } = overview;

  const inventoryRows = [
    { key: 'calendar', name: '📅 Calendar Schedule', count: inventory?.calendar?.count || 0, desc: 'Understood events and travel buffers' },
    { key: 'places', name: '📍 Learned Places', count: inventory?.places?.count || 0, desc: 'Clustered locations (Home, Work, Hospital)' },
    { key: 'people', name: '👥 Recognized People', count: inventory?.people?.count || 0, desc: 'Frequent contacts & meeting organizers' },
    { key: 'documents', name: '📄 Remembered Documents', count: inventory?.documents?.count || 0, desc: 'Insurance cards & test reports' },
    { key: 'routines', name: '🔁 Learned Routines', count: inventory?.routines?.count || 0, desc: 'Commute timings & habit patterns' },
    { key: 'notifications', name: '🔔 Processed Notifications', count: inventory?.notifications?.count || 0, desc: 'Extracted bills & appointment notices' },
  ];

  return (
    <div className="privacy-page">
      <div className="privacy-header">
        <div>
          <h2>Privacy Center</h2>
          <p className="subtitle">Complete transparency and total control over what LifeOS understands</p>
        </div>

        <div className="privacy-top-actions">
          <button 
            className={`pause-toggle-btn ${isPaused ? 'paused' : 'active'}`}
            onClick={handleTogglePause}
          >
            {isPaused ? <PlayCircle size={16} /> : <PauseCircle size={16} />}
            {isPaused ? "Resume LifeOS Sensing" : "Pause LifeOS Sensing"}
          </button>
        </div>
      </div>

      {/* Real Disk & Encryption Stats Banner */}
      <div className="privacy-meta-banner">
        <div className="meta-pill">
          <HardDrive size={16} className="text-primary" />
          <span>Local Storage on Device: <strong>{dataSizeKb} KB</strong></span>
        </div>
        <div className="meta-pill">
          <ShieldCheck size={16} className="text-success" />
          <span>Encryption: <strong>{encryptionStatus}</strong></span>
        </div>
        <div className="meta-pill">
          <span>Retention: <strong>{retentionPolicy}</strong></span>
        </div>
      </div>

      {/* "What LifeOS Knows About Me" Inventory Audit Table */}
      <section className="inventory-section">
        <h3>What LifeOS Knows About Me</h3>
        <p className="section-subtitle">Real-time inventory of all stored contextual records on this device.</p>

        <div className="inventory-table-wrapper">
          <table className="inventory-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Records Understood</th>
                <th>Description</th>
                <th>User Actions</th>
              </tr>
            </thead>
            <tbody>
              {inventoryRows.map(row => (
                <tr key={row.key}>
                  <td className="cat-name">{row.name}</td>
                  <td>
                    <span className="count-badge">{row.count} items</span>
                  </td>
                  <td className="cat-desc">{row.desc}</td>
                  <td>
                    <div className="row-actions">
                      <button className="table-action-btn delete" onClick={() => handleClearCategory(row.key, row.name)}>
                        <Trash2 size={13} /> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Highlights Grid */}
      <div className="privacy-cards-grid">
        <div className="priv-category-card device">
          <div className="card-tag">Stays On Device Only</div>
          <h3>Local-First Architecture</h3>
          <ul>
            {categories.onDeviceOnly.map((c: any, idx: number) => (
              <li key={idx}>
                <strong>{c.title}:</strong> {c.description}
              </li>
            ))}
          </ul>
        </div>

        <div className="priv-category-card blocked">
          <div className="card-tag blocked">Strictly Blocked</div>
          <h3>Quarantined Content</h3>
          <ul>
            {categories.strictlyBlocked.map((c: any, idx: number) => (
              <li key={idx}>
                <strong>{c.title}:</strong> {c.description}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Control Actions */}
      <div className="privacy-actions-section">
        <h3>Data Management</h3>
        <div className="actions-grid">
          <div className="action-control-card">
            <div>
              <h4>Export Your LifeOS Data</h4>
              <p>Download a clean JSON archive of all learned places, entities, tasks, and context.</p>
            </div>
            <button className="btn-secondary" onClick={handleExportData}>
              <Download size={16} /> Download JSON
            </button>
          </div>

          <div className="action-control-card">
            <div>
              <h4>Clear Today's Location Trail</h4>
              <p>Immediately purges all raw GPS coordinates logged today.</p>
            </div>
            <button className="btn-danger" onClick={handleClearLocation}>
              <Trash2 size={16} /> Clear Location
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
export default Privacy;
