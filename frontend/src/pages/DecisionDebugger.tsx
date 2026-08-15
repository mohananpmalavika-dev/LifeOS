import { useState, useEffect } from 'react';
import { Cpu, Battery, Wifi, RefreshCw } from 'lucide-react';
import { decisionsApi, DecisionPayload } from '../services/api';
import './DecisionDebugger.css';

export function DecisionDebugger() {
  const [data, setData] = useState<DecisionPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDecision();
  }, []);

  const loadDecision = async () => {
    setLoading(true);
    try {
      const res = await decisionsApi.getDebugger();
      if (res.data?.data) {
        setData(res.data.data);
      }
    } catch (e) {
      console.error('Error loading debugger:', e);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !data) {
    return <div className="loading-state">Loading NextBestActionEngine State...</div>;
  }

  const { situation, candidates, bestAction, surface, explanation } = data;

  return (
    <div className="debugger-page">
      <div className="debugger-header">
        <div className="title-row">
          <Cpu size={28} className="text-primary" />
          <div>
            <h2>NextBestActionEngine Debugger</h2>
            <p>Real-time inspector of situational inputs, candidate ranking, policy surface selection, and evidence.</p>
          </div>
        </div>

        <button className="btn-secondary refresh-btn" onClick={loadDecision}>
          <RefreshCw size={15} /> Re-evaluate Engine
        </button>
      </div>

      {/* Grid: Situation + Selected Action */}
      <div className="debugger-grid">
        {/* Current Situation Box */}
        <div className="debug-card situation-card">
          <div className="card-badge">INPUT SNAPSHOT</div>
          <h3>Current Situation</h3>

          <div className="situation-details">
            <div className="sit-row">
              <span className="sit-label">📍 Location:</span>
              <strong>{situation.location.place || 'Unknown'} ({Math.round(situation.location.confidence * 100)}% conf)</strong>
            </div>
            <div className="sit-row">
              <span className="sit-label">🏃 Activity:</span>
              <strong>{situation.activity.type} ({Math.round(situation.activity.confidence * 100)}%)</strong>
            </div>
            <div className="sit-row">
              <span className="sit-label">🎯 Focus Mode:</span>
              <span className="focus-pill">{situation.activeFocusMode}</span>
            </div>
            <div className="sit-row">
              <span className="sit-label">📅 Next Event:</span>
              <strong>{situation.nextEvent?.title || 'None scheduled'}</strong>
            </div>
            <div className="sit-row">
              <span className="sit-label">📱 Device State:</span>
              <span><Wifi size={14} /> {situation.device.online ? 'Online' : 'Offline'} · <Battery size={14} /> {situation.device.batteryLevel}%</span>
            </div>
          </div>
        </div>

        {/* Selected Best Action Box */}
        <div className="debug-card selected-card">
          <div className="card-badge primary">DECISION OUTPUT</div>
          <h3>Selected Action: {bestAction.type}</h3>

          <div className="best-action-body">
            <h4>{bestAction.title}</h4>
            <p className="summary">{bestAction.summary}</p>

            <div className="decision-meta-row">
              <span className="meta-item">Rank Score: <strong>{bestAction.score}</strong></span>
              <span className="meta-item">Confidence: <strong>{Math.round(bestAction.confidence * 100)}%</strong></span>
              <span className="surface-pill">{surface}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Candidate Actions Ranked Table */}
      <div className="debug-card candidates-card">
        <div className="card-badge">CANDIDATE RANKING</div>
        <h3>Evaluated Candidate Actions ({candidates.length})</h3>

        <div className="table-wrapper">
          <table className="candidates-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Action Title</th>
                <th>Urgency</th>
                <th>Importance</th>
                <th>Confidence</th>
                <th>Composite Score</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((c, idx) => (
                <tr key={c.id} className={idx === 0 ? 'selected-row' : ''}>
                  <td>
                    <span className={`candidate-type-badge ${c.type.toLowerCase()}`}>{c.type}</span>
                  </td>
                  <td className="cand-title">{c.title}</td>
                  <td>{c.urgency}</td>
                  <td>{c.importance}</td>
                  <td>{c.confidence}</td>
                  <td className="score-cell"><strong>{c.score}</strong></td>
                  <td>{idx === 0 ? <span className="winner-pill">⭐ Selected</span> : <span className="unranked">Rank #{idx + 1}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Evidence Chain */}
      <div className="debug-card evidence-card">
        <div className="card-badge">EVIDENCE CHAIN</div>
        <h3>Why LifeOS Chose This Decision</h3>

        <div className="evidence-list">
          {explanation.evidenceList.map((ev, idx) => (
            <div key={idx} className="evidence-row">
              <div className="evidence-source-tag">{ev.source}</div>
              <div>
                <strong>{ev.title}</strong>
                <p>{ev.detail}</p>
              </div>
              <div className="evidence-conf">{Math.round(ev.confidence * 100)}%</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
export default DecisionDebugger;
