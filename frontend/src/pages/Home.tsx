import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Navigation, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  ThumbsUp, 
  ThumbsDown, 
  HelpCircle, 
  ArrowRight,
  ExternalLink
} from 'lucide-react';
import { briefingApi, interventionsApi, BriefingData } from '../services/api';
import './Home.css';

export function Home() {
  const navigate = useNavigate();
  const [briefing, setBriefing] = useState<BriefingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedbackGiven, setFeedbackGiven] = useState<Record<string, 'up' | 'down'>>({});
  const [showWhyModal, setShowWhyModal] = useState(false);
  const [docsChecked, setDocsChecked] = useState<Record<string, boolean>>({
    'Insurance Card': true,
    'Medical Records': true,
  });

  useEffect(() => {
    loadBriefing();
    const interval = setInterval(loadBriefing, 15000);
    return () => clearInterval(interval);
  }, []);

  const loadBriefing = async () => {
    try {
      const res = await briefingApi.getToday();
      if (res.data?.data) {
        setBriefing(res.data.data);
      }
    } catch (e) {
      console.error('Error loading briefing:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleFeedback = async (id: string, useful: boolean, reason?: string) => {
    try {
      await interventionsApi.feedback(id, useful, reason);
      setFeedbackGiven(prev => ({ ...prev, [id]: useful ? 'up' : 'down' }));
    } catch (e) {
      console.error('Error submitting feedback:', e);
    }
  };

  const toggleDoc = (name: string) => {
    setDocsChecked(prev => ({ ...prev, [name]: !prev[name] }));
  };

  if (loading || !briefing) {
    return (
      <div className="home-loading">
        <div className="loader-pulse" />
        <p>Connecting to LifeOS Ambient Intelligence...</p>
      </div>
    );
  }

  const { nowCard, nextCard, attentionItems, greeting, summaryText, feasibilityScore } = briefing;

  return (
    <div className="home-screen">
      {/* Daily Briefing Banner */}
      <section className="briefing-header-card">
        <div className="briefing-left">
          <h1>{greeting}</h1>
          <p className="briefing-summary">{summaryText}</p>
        </div>
        <div className="feasibility-badge" onClick={() => navigate('/calendar')} title="Click to view daily schedule feasibility">
          <div className="score-number">{feasibilityScore}%</div>
          <div className="score-label">Feasible Day</div>
        </div>
      </section>

      {/* NOW CARD: Primary Hero */}
      {nowCard && (
        <section className="hero-now-card">
          <div className="card-tag now">
            <span className="pulse-dot" /> NOW COMMITMENT
          </div>

          <div className="now-header">
            <div>
              <h2>{nowCard.title}</h2>
              <p className="event-location-text">
                📍 {nowCard.location?.name || 'City Specialty Hospital'} · {nowCard.location?.address || 'MG Road, Kochi'}
              </p>
            </div>
            <div className="departure-countdown-badge">
              <span className="leave-label">LEAVE BY</span>
              <span className="leave-time">{nowCard.leaveByTime}</span>
              <span className="time-remaining">({nowCard.minutesUntil > 0 ? `in ${Math.floor(nowCard.minutesUntil / 60)}h ${nowCard.minutesUntil % 60}m` : 'Immediate'})</span>
            </div>
          </div>

          {/* Details Bar */}
          <div className="now-details-strip">
            <div className="detail-item">
              <span className="label">Estimated Travel</span>
              <strong>🚗 {nowCard.travelMinutes} mins (from {nowCard.origin})</strong>
            </div>
            <div className="detail-item">
              <span className="label">Schedule Time</span>
              <strong>🕒 {new Date(nowCard.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {new Date(nowCard.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong>
            </div>
          </div>

          {/* Document Readiness Checklist */}
          <div className="prep-checklist-box">
            <div className="checklist-title">
              <FileText size={16} /> Required Preparation Documents
            </div>
            <div className="docs-pills-row">
              {nowCard.documents?.map(doc => (
                <div 
                  key={doc.name} 
                  className={`doc-pill ${docsChecked[doc.name] ? 'ready' : ''}`}
                  onClick={() => toggleDoc(doc.name)}
                >
                  {docsChecked[doc.name] ? <CheckCircle2 size={16} className="text-success" /> : <div className="doc-box" />}
                  <span>{doc.name}</span>
                  <span className="doc-status">{docsChecked[doc.name] ? 'Ready' : 'Pending'}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Action Row */}
          <div className="now-actions-row">
            <button 
              className="action-btn primary"
              onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(nowCard.location?.address || nowCard.location?.name || 'City Hospital')}`, '_blank')}
            >
              <Navigation size={16} /> Start Navigation <ExternalLink size={14} />
            </button>
            <button className="action-btn secondary" onClick={() => alert("Marked as on the way! LifeOS will track your arrival.")}>
              I'm on my way
            </button>
            <button className="action-btn ghost" onClick={() => setShowWhyModal(true)}>
              <HelpCircle size={15} /> Why am I seeing this?
            </button>
          </div>
        </section>
      )}

      {/* NEXT Card & Quick Schedule Preview */}
      {nextCard && (
        <section className="next-event-card">
          <div className="card-tag next">NEXT UP</div>
          <div className="next-body">
            <div>
              <h3>{nextCard.title}</h3>
              <p className="time-info">🕒 {new Date(nextCard.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {nextCard.location?.name || 'Office'} ({nextCard.travelMinutes} min travel)</p>
            </div>
            <button className="view-link-btn" onClick={() => navigate('/calendar')}>
              View Calendar <ArrowRight size={14} />
            </button>
          </div>
        </section>
      )}

      {/* NEEDS ATTENTION Card */}
      {attentionItems.length > 0 && (
        <section className="attention-section">
          <div className="section-title">
            <AlertTriangle size={18} className="text-warning" /> Needs Attention
          </div>

          <div className="attention-grid">
            {attentionItems.map(item => (
              <div key={item.id} className={`attention-card ${item.type.toLowerCase()}`}>
                <div className="card-header-bar">
                  <span className={`type-badge ${item.type.toLowerCase()}`}>{item.type}</span>
                  <span className="time-ago">Active Insight</span>
                </div>

                <h4>{item.title}</h4>
                <p className="summary-desc">{item.summary || item.recommendation || item.reason}</p>

                {/* Direct Action Surfaces */}
                <div className="card-footer-action">
                  {item.title.includes('Bill') || item.title.includes('Electricity') ? (
                    <div className="btn-group">
                      <button className="quick-action-btn primary" onClick={() => alert("Reminder added to your Tasks checklist.")}>
                        Add to Tasks
                      </button>
                      <button className="quick-action-btn outline" onClick={() => alert("Payment portal opened.")}>
                        Pay ₹2,431 Now
                      </button>
                    </div>
                  ) : item.type === 'CONFLICT' ? (
                    <button className="quick-action-btn primary" onClick={() => navigate('/calendar')}>
                      See Reschedule Options
                    </button>
                  ) : (
                    <button className="quick-action-btn primary" onClick={() => alert("Notification acknowledged.")}>
                      Acknowledge
                    </button>
                  )}

                  {/* Feedback Thumb Loop */}
                  <div className="feedback-thumbs">
                    <span className="feedback-label">Useful?</span>
                    <button 
                      className={`thumb-btn ${feedbackGiven[item.id] === 'up' ? 'active' : ''}`} 
                      onClick={() => handleFeedback(item.id, true)} 
                      title="Helpful"
                    >
                      <ThumbsUp size={14} />
                    </button>
                    <button 
                      className={`thumb-btn ${feedbackGiven[item.id] === 'down' ? 'active' : ''}`} 
                      onClick={() => handleFeedback(item.id, false, "Not relevant")} 
                      title="Not useful"
                    >
                      <ThumbsDown size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* WHY AM I SEEING THIS MODAL */}
      {showWhyModal && nowCard?.reasoning && (
        <div className="modal-overlay" onClick={() => setShowWhyModal(false)}>
          <div className="why-modal" onClick={e => e.stopPropagation()}>
            <h3>Why am I seeing this departure alert?</h3>
            <p className="why-subtitle">LifeOS fused multiple privacy-first digital signals to generate this recommendation:</p>

            <div className="reasoning-chain">
              <div className="chain-step">
                <div className="step-num">1</div>
                <div>
                  <strong>Calendar Schedule:</strong>
                  <p>You have a confirmed appointment <em>"{nowCard.title}"</em> scheduled for {new Date(nowCard.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.</p>
                </div>
              </div>

              <div className="chain-step">
                <div className="step-num">2</div>
                <div>
                  <strong>Location Intelligence:</strong>
                  <p>You are currently at <strong>{nowCard.reasoning.originPlace}</strong>. The destination is <strong>{nowCard.reasoning.destinationPlace}</strong>.</p>
                </div>
              </div>

              <div className="chain-step">
                <div className="step-num">3</div>
                <div>
                  <strong>Travel & Buffer Computation:</strong>
                  <p>{nowCard.reasoning.travelTimeText} + {nowCard.reasoning.prepBufferText}.</p>
                </div>
              </div>

              <div className="chain-step">
                <div className="step-num">4</div>
                <div>
                  <strong>Confidence & Readiness:</strong>
                  <p>Confidence score: <strong className="text-success">{nowCard.reasoning.confidence}%</strong>. Required documents were cross-referenced against your local memory.</p>
                </div>
              </div>
            </div>

            <div className="modal-actions-right">
              <button className="btn-primary" onClick={() => setShowWhyModal(false)}>Got it</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default Home;
