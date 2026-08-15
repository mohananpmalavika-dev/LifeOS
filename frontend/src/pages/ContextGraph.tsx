import { useState } from 'react';
import { Sparkles, Calendar, MapPin, Bell, Navigation, ArrowRight, CheckCircle2, Shield } from 'lucide-react';
import './ContextGraph.css';

export function ContextGraph() {
  const [activeTrace, setActiveTrace] = useState<string>('doctor_appointment');

  const traces = [
    {
      id: 'doctor_appointment',
      title: 'Doctor Appointment Departure & Prep',
      confidence: 94,
      steps: [
        {
          stage: '1. Raw Signal',
          icon: <Calendar size={18} className="text-primary" />,
          title: 'Calendar & Reminder Ingestion',
          detail: 'Detected event "Doctor Appointment — Dr. Priya Nair" at 04:00 PM.',
        },
        {
          stage: '2. Place & Entity Resolution',
          icon: <MapPin size={18} className="text-warning" />,
          title: 'Location & Document Association',
          detail: 'Resolved destination: City Specialty Hospital. Queried local memory for associated medical requirements: Health Insurance Card (Star Health) + Blood test reports.',
        },
        {
          stage: '3. Context Fusion',
          icon: <Navigation size={18} className="text-primary" />,
          title: 'Current State & Commute Estimation',
          detail: 'Current location is Home. Driving distance to hospital is 14.2 km (~35 min). Added 10 min prep buffer for parking and OPD check-in.',
        },
        {
          stage: '4. Decision & Actionable Output',
          icon: <CheckCircle2 size={18} className="text-success" />,
          title: 'Timely Intervention',
          detail: 'Recommended departure time: 03:15 PM. Verified documents marked ready offline.',
        }
      ]
    },
    {
      id: 'electricity_bill',
      title: 'KSEB Electricity Bill Due Date Alert',
      confidence: 96,
      steps: [
        {
          stage: '1. Raw Signal',
          icon: <Bell size={18} className="text-warning" />,
          title: 'Passive Notification Extraction',
          detail: 'Observed SMS from "KSEB QuickPay" regarding Consumer #104928 bill of ₹2,431.',
        },
        {
          stage: '2. Privacy & Entity Classifier',
          icon: <Shield size={18} className="text-success" />,
          title: 'Sensitive Data Filter',
          detail: 'Verified no banking OTPs or PINs. Extracted due date: Friday. Classified as actionable financial commitment.',
        },
        {
          stage: '3. Context Fusion',
          icon: <Calendar size={18} className="text-primary" />,
          title: 'Calendar Cross-Reference',
          detail: 'Cross-referenced against work commitments on Friday to present reminder 3 days in advance.',
        },
        {
          stage: '4. Decision & Actionable Output',
          icon: <CheckCircle2 size={18} className="text-success" />,
          title: 'Action Card Generated',
          detail: 'Added reminder to Contextual Tasks and prepared one-click payment portal action.',
        }
      ]
    }
  ];

  const current = traces.find(t => t.id === activeTrace) || traces[0];

  return (
    <div className="reasoning-explorer-page">
      <div className="reasoning-header">
        <div className="title-row">
          <Sparkles size={28} className="text-primary" />
          <div>
            <h2>Why LifeOS Knows This</h2>
            <p>Interactive causal reasoning engine showing how sensor signals turn into intelligence.</p>
          </div>
        </div>

        <div className="trace-selector-tabs">
          {traces.map(t => (
            <button 
              key={t.id}
              className={`trace-tab-btn ${activeTrace === t.id ? 'active' : ''}`}
              onClick={() => setActiveTrace(t.id)}
            >
              {t.title}
            </button>
          ))}
        </div>
      </div>

      {/* Causal Chain Visualization */}
      <div className="causal-chain-card">
        <div className="chain-header">
          <h3>{current.title}</h3>
          <span className="confidence-pill">Confidence: {current.confidence}%</span>
        </div>

        <div className="steps-flow">
          {current.steps.map((step, idx) => (
            <div key={idx} className="flow-step-container">
              <div className="flow-step-box">
                <div className="step-badge">{step.stage}</div>
                <div className="step-icon-title">
                  {step.icon}
                  <strong>{step.title}</strong>
                </div>
                <p>{step.detail}</p>
              </div>
              {idx < current.steps.length - 1 && (
                <div className="flow-arrow">
                  <ArrowRight size={20} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
export default ContextGraph;
