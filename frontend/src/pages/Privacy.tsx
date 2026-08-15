import { useEffect, useState } from 'react';
import { Download, Trash2, PauseCircle, PlayCircle } from 'lucide-react';
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

  const handleClearLocation = async () => {
    if (window.confirm("Are you sure you want to delete today's raw location samples?")) {
      try {
        await privacyCenterApi.clear('today-location');
        alert("Today's location history has been cleared.");
      } catch (e) {
        console.error('Error clearing location:', e);
      }
    }
  };

  if (loading || !overview) {
    return <div className="loading-state">Loading Privacy Center...</div>;
  }

  const { categories } = overview;

  return (
    <div className="privacy-page">
      <div className="privacy-header">
        <div>
          <h2>Privacy Center</h2>
          <p className="subtitle">Complete transparency and total user control over your data</p>
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

      {/* Highlights Grid */}
      <div className="privacy-cards-grid">
        <div className="priv-category-card device">
          <div className="card-tag">Stays On Device Only</div>
          <h3>Local-First Sensors</h3>
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
        <h3>Privacy & Data Controls</h3>
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
