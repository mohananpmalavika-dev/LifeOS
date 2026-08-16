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
  Moon,
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
  const [feedbackImpact, setFeedbackImpact] = useState<string | null>(null);
  const [docsChecked, setDocsChecked] = useState<Record<string, boolean>>({});
  const [showWhyModal, setShowWhyModal] = useState(false);

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

  const handleFeedback = async (id: string, useful: boolean, reason?: string, category?: string) => {
    try {
      const res = await interventionsApi.feedback(id, useful, reason, category);
      setFeedbackGiven(prev => ({ ...prev, [id]: useful ? 'up' : 'down' }));
      if (res.data?.message) {
        setFeedbackImpact(res.data.message);
        setTimeout(() => setFeedbackImpact(null), 6000);
      }
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

  const { nowCard, nextCard, attentionItems, eveningReview, greeting, summaryText, feasibilityScore } = briefing;

  return (
    <div className="home-screen">
      {/* Dynamic Feedback Learning Notification */}
      {feedbackImpact && (
        <div className="learning-impact-banner animate-fade">
          ✨ {feedbackImpact}
        </div>
      )}

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

      {/* Evening Review Card (if evening or requested) */}
      {eveningReview && eveningReview.isEvening && (
        <section className="evening-review-card">
          <div className="card-tag next"><Moon size={13} /> EVENING REVIEW</div>
          <div className="evening-body">
            <div>
              <h3>Daily Reflection & Tomorrow Preview</h3>
              <p className="evening-desc">{eveningReview.completedSummary} · {eveningReview.learnedInsight}</p>
            </div>
            <button className="view-link-btn" onClick={() => navigate('/tasks')}>
              View Tasks <ArrowRight size={14} />
            </button>
          </div>
        </section>
      )}

      {/* NOW CARD: Primary Hero */}
      {nowCard && (
        <section className="hero-now-card">
          <div className="card-tag now">
            <span className="pulse-dot" /> NOW COMMITMENT
          </div>

          <div className="now-header">
            <div>
              <h2>{nowCard.title}</h2>
              {nowCard.location?.name && (
                <p className="event-location-text">
                  📍 {nowCard.location.name} {nowCard.location.address ? `· ${nowCard.location.address}` : ''}
                </p>
              )}
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
              <strong>🚗 {nowCard.travelMinutes} mins {nowCard.origin ? `(from ${nowCard.origin})` : ''}</strong>
            </div>
            <div className="detail-item">
              <span className="label">Preparation Buffer</span>
              <strong>⏱️ {nowCard.prepBufferMinutes || 5} mins {nowCard.learnedBufferOffset ? `(Learned: ${nowCard.learnedBufferOffset > 0 ? '+' : ''}${nowCard.learnedBufferOffset}m)` : ''}</strong>
            </div>
          </div>

          {/* Document Readiness Checklist */}
          {nowCard.documents && nowCard.documents.length > 0 && (
            <div className="prep-checklist-box">
              <div className="checklist-title">
                <FileText size={16} /> Required Preparation Documents
              </div>
              <div className="docs-pills-row">
                {nowCard.documents.map(doc => (
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
          )}

          {/* Action Row */}
          <div className="now-actions-row">
            <button 
              className="action-btn primary"
              onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(nowCard.location?.address || nowCard.location?.name || 'Destination')}`, '_blank')}
            >
              <Navigation size={16} /> Start Navigation <ExternalLink size={14} />
            </button>
            <button className="action-btn secondary" onClick={() => alert("Marked on the way! LifeOS is monitoring arrival.")}>
              I'm on my way
            </button>
            <button className="action-btn ghost" onClick={() => setShowWhyModal(true)}>
              <HelpCircle size={15} /> Why am I seeing this?
            </button>
          </div>
        </section>
      )}

      {/* NEXT Card */}
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
                      <button className="quick-action-btn primary" onClick={() => alert("Reminder added to Tasks.")}>
                        Add to Tasks
                      </button>
                      <button className="quick-action-btn outline" onClick={() => alert("Opening KSEB payment portal.")}>
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
                      onClick={() => handleFeedback(item.id, true, "On time", "COMMUTE")} 
                      title="Helpful"
                    >
                      <ThumbsUp size={14} />
                    </button>
                    <button 
                      className={`thumb-btn ${feedbackGiven[item.id] === 'down' ? 'active' : ''}`} 
                      onClick={() => handleFeedback(item.id, false, "Too early", "COMMUTE")} 
                      title="Alert came too early"
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
            <p className="why-subtitle">LifeOS fused multiple privacy-first digital signals to calculate this timing:</p>

            <div className="reasoning-chain">
              <div className="chain-step">
                <div className="step-num">1</div>
                <div>
                  <strong>Calendar Schedule:</strong>
                  <p>You have a confirmed appointment <em>"{nowCard.title}"</em> at {new Date(nowCard.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.</p>
                </div>
              </div>

              <div className="chain-step">
                <div className="step-num">2</div>
                <div>
                  <strong>Location Intelligence:</strong>
                  <p>Current location: <strong>{nowCard.reasoning.originPlace}</strong>. Destination: <strong>{nowCard.reasoning.destinationPlace}</strong>.</p>
                </div>
              </div>

              <div className="chain-step">
                <div className="step-num">3</div>
                <div>
                  <strong>Travel & Adaptive Buffer:</strong>
                  <p>{nowCard.reasoning.travelTimeText} + {nowCard.reasoning.prepBufferText}.</p>
                </div>
              </div>

              <div className="chain-step">
                <div className="step-num">4</div>
                <div>
                  <strong>Confidence & Readiness:</strong>
                  <p>Confidence score: <strong className="text-success">{nowCard.reasoning.confidence}%</strong>. Required documents verified in local memory.</p>
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
