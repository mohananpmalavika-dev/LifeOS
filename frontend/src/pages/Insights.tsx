import { useEffect, useState } from 'react';
import { insightsApi, type Insights as InsightsType } from '../services/api';
import { Activity, Database, TrendingUp, Target, AlertCircle, CheckCircle } from 'lucide-react';
import './Insights.css';

function Insights() {
  const [insights, setInsights] = useState<InsightsType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInsights();
  }, []);

  const loadInsights = async () => {
    try {
      setLoading(true);
      const response = await insightsApi.getAll();
      setInsights(response.data.data);
    } catch (error) {
      console.error('Error loading insights:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatPercentage = (value: number) => {
    return `${Math.round(value * 100)}%`;
  };

  if (loading) {
    return (
      <div className="insights-page">
        <div className="insights-header">
          <div className="skeleton" style={{ width: '200px', height: '40px' }}></div>
        </div>
        <div className="insights-content">
          <div className="skeleton" style={{ width: '100%', height: '400px' }}></div>
        </div>
      </div>
    );
  }

  if (!insights) {
    return (
      <div className="insights-page">
        <div className="insights-header">
          <h1>Insights</h1>
        </div>
        <div className="empty-state">
          <p>No insights data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="insights-page">
      <div className="insights-header">
        <div>
          <h1>Insights</h1>
          <p className="subtitle">Engine performance metrics and analytics</p>
        </div>
      </div>

      <div className="insights-content">
        {/* Key Metrics */}
        <div className="metrics-grid">
          <div className="metric-card primary">
            <div className="metric-icon">
              <Target size={24} />
            </div>
            <div className="metric-content">
              <div className="metric-label">Context Accuracy</div>
              <div className="metric-value">{formatPercentage(insights.metrics.contextAccuracy)}</div>
              <div className="metric-description">Overall system accuracy</div>
            </div>
          </div>

          <div className="metric-card success">
            <div className="metric-icon">
              <CheckCircle size={24} />
            </div>
            <div className="metric-content">
              <div className="metric-label">Precision</div>
              <div className="metric-value">{formatPercentage(insights.metrics.precision)}</div>
              <div className="metric-description">True positives / All positives</div>
            </div>
          </div>

          <div className="metric-card warning">
            <div className="metric-icon">
              <TrendingUp size={24} />
            </div>
            <div className="metric-content">
              <div className="metric-label">Recall</div>
              <div className="metric-value">{formatPercentage(insights.metrics.recall)}</div>
              <div className="metric-description">True positives / All relevant</div>
            </div>
          </div>

          <div className="metric-card info">
            <div className="metric-icon">
              <Activity size={24} />
            </div>
            <div className="metric-content">
              <div className="metric-label">F1 Score</div>
              <div className="metric-value">{formatPercentage(insights.metrics.f1Score)}</div>
              <div className="metric-description">Harmonic mean of precision and recall</div>
            </div>
          </div>
        </div>

        {/* System Counts */}
        <div className="section-card">
          <h2>System Overview</h2>
          <div className="stats-grid">
            <div className="stat-item">
              <div className="stat-icon">
                <Database size={20} />
              </div>
              <div className="stat-content">
                <div className="stat-value">{insights.counts.totalEntities}</div>
                <div className="stat-label">Total Entities</div>
              </div>
            </div>

            <div className="stat-item">
              <div className="stat-icon">
                <Activity size={20} />
              </div>
              <div className="stat-content">
                <div className="stat-value">{insights.counts.totalRelations}</div>
                <div className="stat-label">Total Relations</div>
              </div>
            </div>

            <div className="stat-item">
              <div className="stat-icon">
                <AlertCircle size={20} />
              </div>
              <div className="stat-content">
                <div className="stat-value">{insights.counts.totalInterventions}</div>
                <div className="stat-label">Interventions</div>
              </div>
            </div>

            <div className="stat-item">
              <div className="stat-icon">
                <CheckCircle size={20} />
              </div>
              <div className="stat-content">
                <div className="stat-value">{insights.counts.highPriorityInterventions}</div>
                <div className="stat-label">High Priority</div>
              </div>
            </div>

            <div className="stat-item">
              <div className="stat-icon">
                <TrendingUp size={20} />
              </div>
              <div className="stat-content">
                <div className="stat-value">{insights.counts.recentEvents}</div>
                <div className="stat-label">Recent Events (24h)</div>
              </div>
            </div>

            <div className="stat-item">
              <div className="stat-icon">
                <Target size={20} />
              </div>
              <div className="stat-content">
                <div className="stat-value">{insights.metrics.falsePositives}</div>
                <div className="stat-label">False Positives</div>
              </div>
            </div>
          </div>
        </div>

        {/* Intervention Analytics */}
        <div className="section-card">
          <h2>Intervention Analytics</h2>
          <div className="intervention-analytics">
            <div className="analytics-stat">
              <div className="analytics-label">Average Score</div>
              <div className="analytics-value">{formatPercentage(insights.interventionAnalytics.avgScore)}</div>
            </div>
            <div className="analytics-distribution">
              <div className="distribution-item">
                <div className="distribution-bar high" 
                  style={{ width: `${(insights.interventionAnalytics.scoreDistribution.high / insights.counts.totalInterventions) * 100}%` }}
                ></div>
                <div className="distribution-label">
                  <span className="label-text">High</span>
                  <span className="label-count">{insights.interventionAnalytics.scoreDistribution.high}</span>
                </div>
              </div>
              <div className="distribution-item">
                <div className="distribution-bar medium" 
                  style={{ width: `${(insights.interventionAnalytics.scoreDistribution.medium / insights.counts.totalInterventions) * 100}%` }}
                ></div>
                <div className="distribution-label">
                  <span className="label-text">Medium</span>
                  <span className="label-count">{insights.interventionAnalytics.scoreDistribution.medium}</span>
                </div>
              </div>
              <div className="distribution-item">
                <div className="distribution-bar low" 
                  style={{ width: `${(insights.interventionAnalytics.scoreDistribution.low / insights.counts.totalInterventions) * 100}%` }}
                ></div>
                <div className="distribution-label">
                  <span className="label-text">Low</span>
                  <span className="label-count">{insights.interventionAnalytics.scoreDistribution.low}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Entity Type Distribution */}
        <div className="section-card">
          <h2>Entity Type Distribution</h2>
          <div className="distribution-list">
            {Object.entries(insights.distributions.entityTypes).map(([type, count]) => (
              <div key={type} className="distribution-row">
                <div className="distribution-type">{type}</div>
                <div className="distribution-bar-container">
                  <div 
                    className="distribution-bar-fill"
                    style={{ width: `${(count / insights.counts.totalEntities) * 100}%` }}
                  ></div>
                </div>
                <div className="distribution-count">{count}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Relation Type Distribution */}
        <div className="section-card">
          <h2>Relation Type Distribution</h2>
          <div className="distribution-list">
            {Object.entries(insights.distributions.relationTypes).map(([type, count]) => (
              <div key={type} className="distribution-row">
                <div className="distribution-type">{type.replace(/_/g, ' ')}</div>
                <div className="distribution-bar-container">
                  <div 
                    className="distribution-bar-fill"
                    style={{ width: `${(count / insights.counts.totalRelations) * 100}%` }}
                  ></div>
                </div>
                <div className="distribution-count">{count}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Insights;
