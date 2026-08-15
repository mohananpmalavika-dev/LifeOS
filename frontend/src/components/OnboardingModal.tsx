import React, { useState } from 'react';
import { Sparkles, Calendar, Bell, MapPin, Activity, Shield, CheckCircle, ArrowRight, ArrowLeft } from 'lucide-react';
import './OnboardingModal.css';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onClose }) => {
  const [step, setStep] = useState(1);
  const [homeLocation, setHomeLocation] = useState('Riverside Apartments, Kochi');
  const [workLocation, setWorkLocation] = useState('Infopark Phase 2, Kakkanad');
  const [interruptionLevel, setInterruptionLevel] = useState<'important' | 'balanced' | 'all'>('balanced');

  if (!isOpen) return null;

  const handleFinish = () => {
    localStorage.setItem('lifeos_onboarding_completed', 'true');
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="onboarding-modal">
        <div className="onboarding-progress">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className={`step-bar ${i <= step ? 'active' : ''}`} />
          ))}
        </div>

        <div className="onboarding-content">
          {step === 1 && (
            <div className="step-panel animate-fade">
              <div className="step-icon"><Sparkles size={40} className="icon-glow" /></div>
              <h2>Welcome to LifeOS</h2>
              <p className="step-desc">
                LifeOS is a <strong>privacy-first passive assistant</strong> that understands your day, prepares you for commitments, and alerts you only when it truly matters.
              </p>
              <div className="feature-bullets">
                <div className="bullet-item">✨ <strong>Zero manual logging:</strong> Observes and learns routines silently.</div>
                <div className="bullet-item">🚗 <strong>Smart departures:</strong> Tells you exactly when to leave.</div>
                <div className="bullet-item">📄 <strong>Document preparation:</strong> Verifies needed items in advance.</div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="step-panel animate-fade">
              <div className="step-icon"><Activity size={40} /></div>
              <h2>What LifeOS Understands</h2>
              <p className="step-desc">Select the digital signals LifeOS should observe to assist you:</p>
              <div className="signals-grid">
                <div className="signal-card selected">
                  <Calendar size={24} />
                  <div>
                    <h4>Calendar Commitments</h4>
                    <p>Detects travel buffers, prep documents, and schedule feasibility.</p>
                  </div>
                </div>
                <div className="signal-card selected">
                  <Bell size={24} />
                  <div>
                    <h4>Notifications</h4>
                    <p>Extracts bills, appointments, and actionable insights.</p>
                  </div>
                </div>
                <div className="signal-card selected">
                  <MapPin size={24} />
                  <div>
                    <h4>Location Intelligence</h4>
                    <p>Understands semantic places (Home, Work) & travel modes.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="step-panel animate-fade">
              <div className="step-icon"><Shield size={40} /></div>
              <h2>Privacy in Plain Language</h2>
              <div className="privacy-box">
                <div className="priv-row">
                  <span className="priv-tag device">Stays on Device</span>
                  <p>Raw GPS coordinates, personal chat notifications, and private logs never leave your phone.</p>
                </div>
                <div className="priv-row">
                  <span className="priv-tag blocked">Strictly Blocked</span>
                  <p>Bank OTPs, authentication codes, passwords, and payment card details are permanently quarantined.</p>
                </div>
                <div className="priv-row">
                  <span className="priv-tag encrypted">Encrypted Memory</span>
                  <p>High-level semantic context is locally encrypted with AES-256 and auto-deleted after 14 days.</p>
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="step-panel animate-fade">
              <div className="step-icon"><MapPin size={40} /></div>
              <h2>Set Your Important Places</h2>
              <p className="step-desc">LifeOS uses these to calculate accurate departure times:</p>
              <div className="places-form">
                <div className="input-group">
                  <label>🏠 Home Address / Area</label>
                  <input 
                    type="text" 
                    value={homeLocation} 
                    onChange={e => setHomeLocation(e.target.value)} 
                    placeholder="e.g. Home, Kochi"
                  />
                </div>
                <div className="input-group">
                  <label>💼 Work / Office</label>
                  <input 
                    type="text" 
                    value={workLocation} 
                    onChange={e => setWorkLocation(e.target.value)} 
                    placeholder="e.g. Infopark, Kakkanad"
                  />
                </div>
                <small className="hint">Or let LifeOS learn them automatically from your routine.</small>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="step-panel animate-fade">
              <div className="step-icon"><Bell size={40} /></div>
              <h2>How should LifeOS interrupt you?</h2>
              <div className="pref-options">
                <label className={`pref-card ${interruptionLevel === 'important' ? 'selected' : ''}`}>
                  <input type="radio" name="pref" checked={interruptionLevel === 'important'} onChange={() => setInterruptionLevel('important')} />
                  <div>
                    <h4>🔴 Only Critical Things</h4>
                    <p>Urgent conflicts, departure countdowns, and expiring bills only.</p>
                  </div>
                </label>
                <label className={`pref-card ${interruptionLevel === 'balanced' ? 'selected' : ''}`}>
                  <input type="radio" name="pref" checked={interruptionLevel === 'balanced'} onChange={() => setInterruptionLevel('balanced')} />
                  <div>
                    <h4>🟡 Balanced (Recommended)</h4>
                    <p>Timely departure warnings, document prep checklists, and useful reminders.</p>
                  </div>
                </label>
                <label className={`pref-card ${interruptionLevel === 'all' ? 'selected' : ''}`}>
                  <input type="radio" name="pref" checked={interruptionLevel === 'all'} onChange={() => setInterruptionLevel('all')} />
                  <div>
                    <h4>🟢 Everything</h4>
                    <p>All extracted insights, proactive morning briefings, and evening reviews.</p>
                  </div>
                </label>
              </div>
            </div>
          )}

          {step === 6 && (
            <div className="step-panel animate-fade text-center">
              <div className="step-icon"><CheckCircle size={56} className="text-success" /></div>
              <h2>You're all set!</h2>
              <p className="step-desc">
                LifeOS is now observing your daily context. As you go about your day, it will learn your patterns and provide timely suggestions right when you need them.
              </p>
              <div className="ready-tip">
                💡 <strong>Tip:</strong> You can type any question into <em>"Ask LifeOS"</em> at the top of your screen anytime.
              </div>
            </div>
          )}
        </div>

        <div className="onboarding-footer">
          {step > 1 ? (
            <button className="btn-secondary" onClick={() => setStep(step - 1)}>
              <ArrowLeft size={16} /> Back
            </button>
          ) : <div />}

          {step < 6 ? (
            <button className="btn-primary" onClick={() => setStep(step + 1)}>
              Continue <ArrowRight size={16} />
            </button>
          ) : (
            <button className="btn-primary" onClick={handleFinish}>
              Start Using LifeOS <Sparkles size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
export default OnboardingModal;
