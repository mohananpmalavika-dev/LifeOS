import React from 'react';
import { ShieldCheck, CheckCircle2, BatteryCharging, Zap, X } from 'lucide-react';
import './ReliabilityModal.css';

interface ReliabilityModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ReliabilityModal: React.FC<ReliabilityModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="reliability-modal" onClick={e => e.stopPropagation()}>
        <div className="reliability-header">
          <div className="title-area">
            <div className="live-dot" />
            <h3>LifeOS System Reliability</h3>
          </div>
          <button className="close-btn" onClick={onClose}><X size={20} /></button>
        </div>

        <p className="reliability-subtitle">All ambient intelligence sensors and local privacy layers are operational.</p>

        <div className="status-cards-grid">
          <div className="status-card-item ok">
            <div className="card-top">
              <CheckCircle2 size={20} className="text-success" />
              <h4>Calendar Intelligence</h4>
            </div>
            <p>Schedule analyzer, conflict detector & travel engine active.</p>
            <span className="badge ok">Operational</span>
          </div>

          <div className="status-card-item ok">
            <div className="card-top">
              <CheckCircle2 size={20} className="text-success" />
              <h4>Location Intelligence</h4>
            </div>
            <p>Local-first place clustering & arrival/departure state machine running.</p>
            <span className="badge ok">Local-First</span>
          </div>

          <div className="status-card-item ok">
            <div className="card-top">
              <CheckCircle2 size={20} className="text-success" />
              <h4>Notification Filter</h4>
            </div>
            <p>Entity extraction & actionable insight classifier active.</p>
            <span className="badge ok">Active</span>
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
              <h4>Battery Optimization</h4>
            </div>
            <p>Adaptive sampling policy reduces GPS wakeups when stationary.</p>
            <span className="badge ok">Optimized</span>
          </div>

          <div className="status-card-item ok">
            <div className="card-top">
              <Zap size={20} className="text-success" />
              <h4>Context Fusion</h4>
            </div>
            <p>Multi-sensor validation reasoning engine generating recommendations.</p>
            <span className="badge ok">94% Confidence</span>
          </div>
        </div>

        <div className="reliability-footer">
          <button className="btn-primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};
export default ReliabilityModal;
