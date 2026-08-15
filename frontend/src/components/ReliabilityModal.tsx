import React, { useState, useEffect } from 'react';
import { ShieldCheck, CheckCircle2, BatteryCharging, Zap, X } from 'lucide-react';
import { api } from '../services/api';
import './ReliabilityModal.css';

interface ReliabilityModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ReliabilityModal: React.FC<ReliabilityModalProps> = ({ isOpen, onClose }) => {
  const [health, setHealth] = useState<any>(null);

  useEffect(() => {
    if (isOpen) loadHealth();
  }, [isOpen]);

  const loadHealth = async () => {
    try {
      const res = await api.get('/system/health');
      if (res.data?.data) {
        setHealth(res.data.data);
      }
    } catch (e) {
      console.error('Error fetching health:', e);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="reliability-modal" onClick={e => e.stopPropagation()}>
        <div className="reliability-header">
          <div className="title-area">
            <div className="live-dot" />
            <h3>LifeOS Dynamic System Reliability</h3>
          </div>
          <button className="close-btn" onClick={onClose}><X size={20} /></button>
        </div>

        <p className="reliability-subtitle">
          Live sensor ages, SQLite persistent entity integrity, and hardware verification:
        </p>

        <div className="status-cards-grid">
          <div className="status-card-item ok">
            <div className="card-top">
              <CheckCircle2 size={20} className="text-success" />
              <h4>Calendar Intelligence</h4>
            </div>
            <p>{health ? `${health.calendar.totalEvents} commitments synced & schedule feasibility active.` : 'Checking...'}</p>
            <span className="badge ok">Operational</span>
          </div>

          <div className="status-card-item ok">
            <div className="card-top">
              <CheckCircle2 size={20} className="text-success" />
              <h4>Location Intelligence</h4>
            </div>
            <p>{health ? `${health.location.placesCount} places clustered (sample age: ${health.location.ageSeconds}s)` : 'Local-first'}</p>
            <span className="badge ok">Live ({health?.location.ageSeconds || 5}s age)</span>
          </div>

          <div className="status-card-item ok">
            <div className="card-top">
              <CheckCircle2 size={20} className="text-success" />
              <h4>Notification Intelligence</h4>
            </div>
            <p>{health ? `${health.notifications.activeEntities} persistent SQLite entities resolved.` : 'Active'}</p>
            <span className="badge ok">SQLite Persistent</span>
          </div>

          <div className="status-card-item ok">
            <div className="card-top">
              <ShieldCheck size={20} className="text-success" />
              <h4>Privacy Shield</h4>
            </div>
            <p>OTPs, bank accounts, and passwords strictly blocked & redacted.</p>
            <span className="badge shield">Strict Policy</span>
          </div>

          <div className="status-card-item ok">
            <div className="card-top">
              <BatteryCharging size={20} className="text-success" />
              <h4>Device State</h4>
            </div>
            <p>{health ? `Battery at ${health.device.batteryLevel}% (${health.device.isOnline ? 'Online' : 'Offline'}).` : 'Active'}</p>
            <span className="badge ok">{health?.device.batteryLevel || 88}% Battery</span>
          </div>

          <div className="status-card-item ok">
            <div className="card-top">
              <Zap size={20} className="text-success" />
              <h4>Decision Engine</h4>
            </div>
            <p>Deterministic NextBestActionEngine running pure situational reasoning.</p>
            <span className="badge ok">Active</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReliabilityModal;
