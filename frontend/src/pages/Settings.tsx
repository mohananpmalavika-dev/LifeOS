import { useState } from 'react';
import { Settings as SettingsIcon, Bell, Smartphone, Moon, Sliders, Save } from 'lucide-react';
import './Settings.css';

function Settings() {
  const [settings, setSettings] = useState({
    // Interruption Settings
    focusMode: false,
    quietHours: { enabled: false, start: '22:00', end: '07:00' },
    highPriorityOnly: false,
    
    // Sensor Settings
    locationTracking: true,
    motionSensing: true,
    batteryMonitoring: true,
    ambientSound: false,
    
    // Threshold Settings
    interventionThreshold: 0.65,
    contextAccuracy: 0.8,
    
    // Display Settings
    darkMode: true,
    compactView: false,
    showConfidence: true,
  });

  const handleSave = () => {
    console.log('Settings saved:', settings);
    // In real implementation, this would call the API
  };

  return (
    <div className="settings-page">
      <div className="settings-header">
        <div>
          <h1>Settings</h1>
          <p className="subtitle">Configure sensors, thresholds, and preferences</p>
        </div>

        <button className="save-btn" onClick={handleSave}>
          <Save size={18} />
          Save Changes
        </button>
      </div>

      <div className="settings-content">
        {/* Interruption Settings */}
        <div className="settings-section">
          <div className="section-header">
            <Bell size={20} />
            <h2>Interruption Settings</h2>
          </div>

          <div className="settings-group">
            <div className="setting-item">
              <div className="setting-info">
                <div className="setting-label">Focus Mode</div>
                <div className="setting-description">
                  Minimize interruptions during focused work
                </div>
              </div>
              <label className="toggle">
                <input 
                  type="checkbox"
                  checked={settings.focusMode}
                  onChange={(e) => setSettings({...settings, focusMode: e.target.checked})}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <div className="setting-item">
              <div className="setting-info">
                <div className="setting-label">Quiet Hours</div>
                <div className="setting-description">
                  Suppress non-urgent interventions during specific hours
                </div>
              </div>
              <label className="toggle">
                <input 
                  type="checkbox"
                  checked={settings.quietHours.enabled}
                  onChange={(e) => setSettings({
                    ...settings, 
                    quietHours: {...settings.quietHours, enabled: e.target.checked}
                  })}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            {settings.quietHours.enabled && (
              <div className="setting-item nested">
                <div className="time-range">
                  <div className="time-input">
                    <label>Start</label>
                    <input 
                      type="time"
                      value={settings.quietHours.start}
                      onChange={(e) => setSettings({
                        ...settings,
                        quietHours: {...settings.quietHours, start: e.target.value}
                      })}
                    />
                  </div>
                  <div className="time-input">
                    <label>End</label>
                    <input 
                      type="time"
                      value={settings.quietHours.end}
                      onChange={(e) => setSettings({
                        ...settings,
                        quietHours: {...settings.quietHours, end: e.target.value}
                      })}
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="setting-item">
              <div className="setting-info">
                <div className="setting-label">High Priority Only</div>
                <div className="setting-description">
                  Only show interventions with confidence ≥ 80%
                </div>
              </div>
              <label className="toggle">
                <input 
                  type="checkbox"
                  checked={settings.highPriorityOnly}
                  onChange={(e) => setSettings({...settings, highPriorityOnly: e.target.checked})}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>
        </div>

        {/* Sensor Settings */}
        <div className="settings-section">
          <div className="section-header">
            <Smartphone size={20} />
            <h2>Sensor Configuration</h2>
          </div>

          <div className="settings-group">
            <div className="setting-item">
              <div className="setting-info">
                <div className="setting-label">Location Tracking</div>
                <div className="setting-description">
                  Monitor location for context-aware interventions
                </div>
              </div>
              <label className="toggle">
                <input 
                  type="checkbox"
                  checked={settings.locationTracking}
                  onChange={(e) => setSettings({...settings, locationTracking: e.target.checked})}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <div className="setting-item">
              <div className="setting-info">
                <div className="setting-label">Motion Sensing</div>
                <div className="setting-description">
                  Detect walking, driving, and stationary states
                </div>
              </div>
              <label className="toggle">
                <input 
                  type="checkbox"
                  checked={settings.motionSensing}
                  onChange={(e) => setSettings({...settings, motionSensing: e.target.checked})}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <div className="setting-item">
              <div className="setting-info">
                <div className="setting-label">Battery Monitoring</div>
                <div className="setting-description">
                  Track battery level for intervention timing
                </div>
              </div>
              <label className="toggle">
                <input 
                  type="checkbox"
                  checked={settings.batteryMonitoring}
                  onChange={(e) => setSettings({...settings, batteryMonitoring: e.target.checked})}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <div className="setting-item">
              <div className="setting-info">
                <div className="setting-label">Ambient Sound Level</div>
                <div className="setting-description">
                  Monitor ambient noise for focus state detection
                </div>
              </div>
              <label className="toggle">
                <input 
                  type="checkbox"
                  checked={settings.ambientSound}
                  onChange={(e) => setSettings({...settings, ambientSound: e.target.checked})}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>
        </div>

        {/* Threshold Settings */}
        <div className="settings-section">
          <div className="section-header">
            <Sliders size={20} />
            <h2>Threshold Configuration</h2>
          </div>

          <div className="settings-group">
            <div className="setting-item slider">
              <div className="setting-info">
                <div className="setting-label">
                  Intervention Threshold
                  <span className="setting-value">{Math.round(settings.interventionThreshold * 100)}%</span>
                </div>
                <div className="setting-description">
                  Minimum confidence score to trigger interventions (currently: {settings.interventionThreshold})
                </div>
              </div>
              <input 
                type="range"
                min="0.5"
                max="1.0"
                step="0.05"
                value={settings.interventionThreshold}
                onChange={(e) => setSettings({...settings, interventionThreshold: parseFloat(e.target.value)})}
                className="range-slider"
              />
            </div>

            <div className="setting-item slider">
              <div className="setting-info">
                <div className="setting-label">
                  Context Accuracy Target
                  <span className="setting-value">{Math.round(settings.contextAccuracy * 100)}%</span>
                </div>
                <div className="setting-description">
                  Minimum confidence for context entity extraction
                </div>
              </div>
              <input 
                type="range"
                min="0.5"
                max="1.0"
                step="0.05"
                value={settings.contextAccuracy}
                onChange={(e) => setSettings({...settings, contextAccuracy: parseFloat(e.target.value)})}
                className="range-slider"
              />
            </div>
          </div>
        </div>

        {/* Display Settings */}
        <div className="settings-section">
          <div className="section-header">
            <Moon size={20} />
            <h2>Display Preferences</h2>
          </div>

          <div className="settings-group">
            <div className="setting-item">
              <div className="setting-info">
                <div className="setting-label">Dark Mode</div>
                <div className="setting-description">
                  Use dark theme throughout the app
                </div>
              </div>
              <label className="toggle">
                <input 
                  type="checkbox"
                  checked={settings.darkMode}
                  onChange={(e) => setSettings({...settings, darkMode: e.target.checked})}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <div className="setting-item">
              <div className="setting-info">
                <div className="setting-label">Compact View</div>
                <div className="setting-description">
                  Show more items with less spacing
                </div>
              </div>
              <label className="toggle">
                <input 
                  type="checkbox"
                  checked={settings.compactView}
                  onChange={(e) => setSettings({...settings, compactView: e.target.checked})}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <div className="setting-item">
              <div className="setting-info">
                <div className="setting-label">Show Confidence Scores</div>
                <div className="setting-description">
                  Display confidence percentages on interventions
                </div>
              </div>
              <label className="toggle">
                <input 
                  type="checkbox"
                  checked={settings.showConfidence}
                  onChange={(e) => setSettings({...settings, showConfidence: e.target.checked})}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Settings;
