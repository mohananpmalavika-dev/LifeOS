# Location Intelligence Quick Start Guide

## What is Location Intelligence?

Location Intelligence is LifeOS's third major Context Sensor that transforms raw GPS coordinates into meaningful life context. Instead of just knowing *where* you are, LifeOS understands *what you're doing* geographically.

**Example transformation:**
```
Before: (8.521, 76.934) → (8.522, 76.935) → (8.523, 76.936)...

After:  HOME → Leaving → Driving → Approaching Work → Arrived at WORK
```

---

## Quick Demo Scenario

### The Morning Commute

**What happens automatically:**

1. **8:30 AM** - You're at home, stationary
   - Location Intelligence: "DWELLING at HOME"
   - Confidence: 95%

2. **8:45 AM** - You start moving
   - State Machine: "POSSIBLE_DEPARTURE"
   - Movement Engine: "DRIVING detected"
   - Policy Engine: Increases GPS sampling to NORMAL

3. **8:49 AM** - You're on the road
   - State Machine: "TRAVELING"
   - Destination Engine: "WORK (94% probability)"
   - Routine Engine: "Matches Morning Commute routine"
   - Movement Intent: "COMMUTING_TO_WORK"
   
4. **9:15 AM** - You're close to work
   - State Machine: "APPROACHING_DESTINATION"
   - Policy Engine: Increases to HIGH_ACCURACY
   - Arrival Probability: 91%

5. **9:20 AM** - You arrive and park
   - State Machine: "ARRIVED at WORK"
   - Place Engine: Records visit
   - Policy Engine: Reduces to LOW_POWER

6. **Context Fusion combines this with:**
   - Calendar: "9:30 AM Office Meeting"
   - Notification: "Meeting reminder"
   
   **Result:** "Commuting to work - Office meeting at 9:30"

---

## Installation & Setup

### 1. Backend Setup

The Location Intelligence system is already integrated into the backend. No additional installation needed.

### 2. Start the Server

```bash
cd c:\LifeOS
npm start
```

### 3. Access the Location Intelligence Page

Navigate to: `http://localhost:5173/location`

---

## First-Time Usage

### Step 1: Start Location Engine

Make an API call to start the location intelligence engine:

```bash
curl -X POST http://localhost:3001/api/location/start
```

Or use the browser console:
```javascript
fetch('http://localhost:3001/api/location/start', { method: 'POST' })
  .then(r => r.json())
  .then(console.log);
```

### Step 2: Simulate or Provide Location Data

Since this is a browser-based demo, you'll need to enable location permissions when prompted.

**For Testing with Simulated Data:**

```javascript
// Simulate being at home
const homePosition = {
  latitude: 8.5241,
  longitude: 76.9366,
  accuracy: 20,
  timestamp: new Date()
};

// The LocationCollector will automatically use browser geolocation
// For testing, you can manually trigger context updates through the API
```

### Step 3: Let it Learn

The system learns automatically as you:
- Visit places multiple times
- Follow regular patterns (commute, appointments)
- Spend time at locations

**What gets learned:**
- After 3+ visits: Place gets created
- After 5+ visits: Place gets confidence boost
- After 5+ nighttime dwells: HOME detection
- After 5+ weekday daytime visits: WORK detection
- After 5+ similar trips: Routine pattern created

### Step 4: View Your Context

Navigate to `/location` and explore:
- **Current Context** tab - Real-time location intelligence
- **Places** tab - Your learned places
- **Routines** tab - Detected patterns
- **Statistics** tab - Overview dashboard

---

## Manual Place Configuration

### Set a Place as Home

1. Go to the **Places** tab
2. Find the place (probably your most-visited with nighttime presence)
3. Click **Edit**
4. Set name: "Home"
5. Set type: "HOME"

Or via API:
```bash
curl -X PUT http://localhost:3001/api/location/places/PLACE_ID \
  -H "Content-Type: application/json" \
  -d '{"name": "Home", "type": "HOME"}'
```

### Set a Place as Work

Same process, but with:
- Name: "Office" (or your workplace name)
- Type: "WORK"

---

## Trigger Routine Learning

After you've accumulated some location history (transitions between places):

1. Go to the **Routines** tab
2. Click **"Learn from History"** button

Or via API:
```bash
curl -X POST http://localhost:3001/api/location/learn
```

This analyzes your place transitions and creates routine patterns.

---

## API Examples

### Get Current Context

```bash
curl http://localhost:3001/api/location/context
```

**Response:**
```json
{
  "timestamp": "2024-03-15T10:30:00Z",
  "currentPlace": {
    "placeId": "place_home_123",
    "name": "Home",
    "type": "HOME",
    "confidence": 0.96
  },
  "movementState": {
    "state": "STATIONARY",
    "speedKmh": 0,
    "confidence": 0.95
  },
  "locationState": "DWELLING",
  "dwellTime": 125,
  "confidence": 0.94
}
```

### Get All Places

```bash
curl http://localhost:3001/api/location/places
```

### Get Statistics

```bash
curl http://localhost:3001/api/location/stats
```

**Response:**
```json
{
  "totalPlaces": 12,
  "identifiedPlaces": 4,
  "unknownPlaces": 8,
  "homeIdentified": true,
  "workIdentified": true,
  "totalVisits": 247,
  "totalDwellHours": 1840,
  "learnedRoutines": 3,
  "topPlaces": [
    {
      "name": "Home",
      "type": "HOME",
      "visits": 89,
      "avgDwellMinutes": 480
    },
    {
      "name": "Office",
      "type": "WORK",
      "visits": 67,
      "avgDwellMinutes": 385
    }
  ]
}
```

---

## Testing the System

### Test 1: Place Detection

1. Stay at the same location for 10+ minutes
2. Check `/api/location/context`
3. You should see a place created or identified
4. Check `/api/location/places` to see the place

### Test 2: Movement Detection

1. Start moving (walking or driving)
2. Check context API
3. `movementState.state` should change to WALKING or DRIVING
4. `locationState` should transition through the state machine

### Test 3: Arrival/Departure

1. Leave a known place
2. Watch `locationState` go: STATIONARY_AT_PLACE → POSSIBLE_DEPARTURE → DEPARTED
3. Arrive at another place
4. Watch: TRAVELING → POSSIBLE_ARRIVAL → ARRIVED

### Test 4: Destination Prediction

1. Add a calendar event with a location
2. Start traveling toward that location
3. Check context API
4. `destination` should be populated with the predicted destination

### Test 5: Routine Learning

1. Make the same trip (e.g., home to work) multiple times at similar times
2. Trigger routine learning: `POST /api/location/learn`
3. Check `/api/location/routines`
4. You should see a routine pattern detected

---

## Understanding the UI

### Current Context Tab

Shows real-time location intelligence:

- **Location State Badge** - Current state machine state
- **Current Place** - Where you are (with name, type, confidence)
- **Dwell Time** - How long you've been there
- **Movement Info** - Movement state, speed, travel mode
- **Destination** - Where you're predicted to be going
- **Detected Routine** - Matching routine pattern
- **Intent** - High-level semantic intent

### Places Tab

Grid of all learned places:

- **Place Cards** - Show name, type, visit count, avg dwell time, confidence
- **Edit Button** - Set name and type
- **Private Places** - Marked with border
- **Sorting** - By visit count (most visited first)

**Color Codes:**
- Blue badge = Place type
- Green badge = Confidence percentage
- Orange border = Private place

### Routines Tab

List of learned routine patterns:

- **Routine Cards** - Show name, type, days, time window
- **Details** - Typical duration, travel mode, occurrences
- **Probability Badge** - Confidence in the routine
- **Learn Button** - Trigger routine learning

### Statistics Tab

Dashboard overview:

- **Total Places** - With identified vs unknown breakdown
- **Key Places** - HOME and WORK identification status
- **Activity Metrics** - Total visits and dwell time
- **Routines Count** - Number of learned patterns
- **Top 5 Places** - Most visited places with stats

---

## Integration with Other Systems

### Calendar Integration

Location Intelligence automatically considers calendar events when predicting destinations.

**Example:**
```
Current: HOME
Calendar: 10:00 AM Doctor at KIMS Hospital
Movement: DRIVING
→ Destination: KIMS Hospital (89% probability)
```

### Notification Intelligence Integration

Location context enhances notification intelligence decisions.

**Example:**
```
Location: AT_WORK
Notification: "Don't forget to buy milk"
→ Delivery Decision: Delay until TRAVELING_HOME
```

### Context Fusion

Location Intelligence is the primary input to Context Fusion:

```
Location: COMMUTING_TO_WORK
Calendar: 9:30 Office Meeting
Notification: Meeting reminder
→ Fused Context: "Commuting to work - Office meeting at 9:30"
→ Confidence: 96%
```

---

## Privacy Controls

### Privacy Modes

**Private Mode (Default):**
- Raw GPS: Local only
- Retention: 1 day
- Server: Semantic context only

**Balanced Mode:**
- Raw GPS: Selected samples
- Retention: 7 days
- Server: Limited sharing

**Advanced Mode:**
- Raw GPS: Full sync
- Retention: 30 days
- Server: Full sharing

### Change Privacy Mode

```bash
curl -X POST http://localhost:3001/api/location/privacy \
  -H "Content-Type: application/json" \
  -d '{"mode": "PRIVATE"}'
```

### Mark Places as Private

1. Go to Places tab
2. Edit place
3. Set "Private" checkbox

Or via API:
```bash
curl -X PUT http://localhost:3001/api/location/places/PLACE_ID \
  -H "Content-Type: application/json" \
  -d '{"isPrivate": true}'
```

Private places:
- Not shared with server
- Excluded from public statistics
- Hidden from timeline views

---

## Troubleshooting

### Issue: "No location context available"

**Solution:**
1. Check if location engine is started: `POST /api/location/start`
2. Enable browser location permissions
3. Wait a few minutes for initial data collection

### Issue: "Places not being detected"

**Solution:**
1. Stay at locations for 10+ minutes
2. Visit places multiple times (3+)
3. Check clustering radius configuration (default: 100m)

### Issue: "HOME/WORK not auto-detected"

**Solution:**
1. **HOME**: Need 5+ overnight dwells (22:00-06:00)
2. **WORK**: Need 5+ weekday daytime visits (09:00-17:00)
3. Manual override: Edit place and set type

### Issue: "Routines not learning"

**Solution:**
1. Need 5+ similar trips (same from-to-time pattern)
2. Trigger learning manually: `POST /api/location/learn`
3. Check transitions exist: `GET /api/location/transitions`

### Issue: "Destination prediction not working"

**Solution:**
1. Add calendar events with locations
2. Establish routine patterns first
3. Need movement with consistent heading

### Issue: "Battery draining too fast"

**Solution:**
1. Check current policy: Should be LOW_POWER when dwelling
2. Verify geofences are being used (check logs)
3. Adjust retention policy to more aggressive cleanup

---

## Advanced Configuration

### Adjust Clustering Radius

Default is 100m. To change:

```typescript
const engine = new LocationContextEngine({
  config: {
    placeClusteringRadiusMeters: 150, // Larger radius
  }
});
```

### Adjust Routine Learning Threshold

Default is 5 occurrences. To change:

```typescript
config: {
  minimumOccurrencesForRoutine: 3, // More sensitive
}
```

### Adjust State Machine Hysteresis

Default: 120s arrival, 90s departure. To change:

```typescript
config: {
  arrivalStabilitySeconds: 60,  // Faster arrival detection
  departureStabilitySeconds: 45, // Faster departure detection
}
```

---

## Performance Tips

### 1. Let Geofences Work

Once places are established, the system uses geofences instead of continuous GPS. This saves battery significantly.

**Check if working:**
- Look for GEOFENCE_ONLY policy when dwelling
- GPS sampling should drop to 5-minute intervals

### 2. Clean Up Old Data

Raw location samples accumulate. Clean them up:

```bash
curl -X POST http://localhost:3001/api/location/cleanup \
  -H "Content-Type: application/json" \
  -d '{"retentionDays": 7}'
```

### 3. Monitor Sampling Policy

Current policy adapts to context:
- Dwelling: GEOFENCE_ONLY or LOW_POWER
- Traveling: NORMAL
- Approaching: HIGH_ACCURACY

Check current policy in the context response.

---

## Next Steps

### 1. Integration with Interventions

Use location context for smart interventions:

```typescript
if (context.locationState === 'TRAVELING_HOME') {
  // Remind about grocery shopping
  // Surface dinner planning
  // Prepare "welcome home" actions
}
```

### 2. Integration with Tasks

Location-aware task management:

```typescript
if (context.currentPlace?.type === 'SHOP') {
  // Surface shopping list tasks
}
```

### 3. Integration with Insights

Generate location-based insights:
- "You spend 8.5 hours/day at work"
- "Your commute is typically 42 minutes"
- "You visit the gym 3x/week on average"

---

## Sample Code

### Get and Display Context

```typescript
async function displayLocationContext() {
  const response = await fetch('http://localhost:3001/api/location/context');
  const context = await response.json();
  
  console.log('Current Location Context:');
  console.log('------------------------');
  console.log(`State: ${context.locationState}`);
  console.log(`Place: ${context.currentPlace?.name || 'Unknown'}`);
  console.log(`Movement: ${context.movementState.state}`);
  console.log(`Travel Mode: ${context.travelMode}`);
  
  if (context.destination) {
    console.log(`Destination: ${context.destination.name}`);
    console.log(`Arrival Probability: ${Math.round(context.arrivalProbability * 100)}%`);
  }
  
  if (context.movementIntent) {
    console.log(`Intent: ${context.movementIntent}`);
  }
  
  console.log(`Overall Confidence: ${Math.round(context.confidence * 100)}%`);
}
```

### React Component Example

```typescript
import { useState, useEffect } from 'react';
import { api } from './services/api';

function LocationStatus() {
  const [context, setContext] = useState(null);
  
  useEffect(() => {
    const loadContext = async () => {
      const response = await api.get('/location/context');
      setContext(response.data);
    };
    
    loadContext();
    const interval = setInterval(loadContext, 10000); // Every 10s
    
    return () => clearInterval(interval);
  }, []);
  
  if (!context) return <div>Loading location context...</div>;
  
  return (
    <div className="location-status">
      <h3>Current Location</h3>
      <div className="status-badge">{context.locationState}</div>
      
      {context.currentPlace && (
        <div className="place-info">
          <strong>{context.currentPlace.name || context.currentPlace.type}</strong>
          <span>{context.dwellTime}m</span>
        </div>
      )}
      
      {context.destination && (
        <div className="destination-info">
          Going to: {context.destination.name}
          ({Math.round(context.arrivalProbability * 100)}% arrival)
        </div>
      )}
    </div>
  );
}
```

---

## Resources

- **Full Implementation Guide**: `LOCATION_INTELLIGENCE_IMPLEMENTATION.md`
- **API Documentation**: See backend routes in `src/api/routes/location.ts`
- **Type Definitions**: `src/intelligence/location/types.ts`
- **Context Fusion**: `src/api/services/context-fusion.ts`

---

## Support & Debugging

### Enable Debug Logging

Add to your code:

```typescript
const engine = new LocationContextEngine({
  config: { /* ... */ },
  onContextUpdate: (context) => {
    console.log('Context Update:', JSON.stringify(context, null, 2));
  },
  onLocationEvent: (event) => {
    console.log('Location Event:', event.type, event.data);
  },
});
```

### Check State Machine Transitions

```typescript
stateMachine.addListener((transition) => {
  console.log(
    `State: ${transition.fromState} → ${transition.toState}`,
    `Reason: ${transition.reason}`,
    `Confidence: ${transition.confidence}`
  );
});
```

### Inspect Database

```bash
sqlite3 lifeos.db
```

```sql
-- Check places
SELECT id, name, type, visit_count, confidence FROM places;

-- Check recent visits
SELECT * FROM place_visits ORDER BY arrival_time DESC LIMIT 10;

-- Check routines
SELECT name, type, probability, occurrences FROM routine_patterns;

-- Check transitions
SELECT * FROM place_transitions ORDER BY departure_time DESC LIMIT 10;
```

---

## Success Checklist

- [ ] Location engine started
- [ ] Browser location permission granted
- [ ] At least 3 places learned
- [ ] HOME identified or manually set
- [ ] WORK identified or manually set
- [ ] At least one routine pattern learned
- [ ] Destination prediction working
- [ ] Context fusion showing combined intelligence
- [ ] Privacy settings configured
- [ ] Frontend showing real-time updates

---

**You're all set!** Location Intelligence is now transforming raw GPS into meaningful life context for your LifeOS Passive Agent.
