# Three-Sensor Integration Demo

## The Power of Combined Intelligence

LifeOS now has three major Context Sensors working together:

1. **Notification Intelligence** - Understands what's happening from notifications
2. **Calendar Intelligence** - Understands scheduled commitments and time constraints
3. **Location Intelligence** - Understands where you are and what you're doing geographically

**The magic happens when they fuse together.**

---

## Demo Scenario: The Doctor Appointment

Let's walk through a real-world scenario showing how all three sensors combine to create a Passive Agent that truly understands your life.

### Timeline

#### **9:00 AM - At Home**

**Location Intelligence:**
```json
{
  "currentPlace": { "name": "Home", "type": "HOME" },
  "locationState": "DWELLING",
  "dwellTime": 487,
  "movementState": { "state": "STATIONARY" }
}
```

**Calendar Intelligence:**
```json
{
  "upcomingEvents": [
    {
      "title": "Doctor Appointment",
      "startTime": "10:00 AM",
      "location": "KIMS Hospital",
      "travelTimeMinutes": 35
    }
  ],
  "conflicts": []
}
```

**Notification Intelligence:**
```json
{
  "recentNotifications": [
    {
      "app": "Calendar",
      "title": "Doctor Appointment",
      "text": "Appointment in 1 hour at KIMS Hospital",
      "category": "APPOINTMENT_REMINDER",
      "priority": "HIGH"
    }
  ]
}
```

**Context Fusion Output:**
```json
{
  "contextType": "AT_HOME",
  "confidence": 0.94,
  "description": "At home - Doctor appointment in 1 hour",
  "key_signals": [
    "Location: Home (dwelling for 487 minutes)",
    "Calendar: Doctor Appointment at 10:00 AM",
    "Notification: Appointment reminder received",
    "Travel time needed: 35 minutes"
  ],
  "recommendations": [
    "Consider leaving soon for your appointment",
    "Traffic to KIMS Hospital: Check current conditions"
  ]
}
```

---

#### **9:20 AM - Movement Detected**

**Location Intelligence:**
```json
{
  "currentPlace": { "name": "Home", "type": "HOME" },
  "locationState": "POSSIBLE_DEPARTURE",
  "movementState": { "state": "WALKING", "speedKmh": 4 },
  "departureProbability": 0.73
}
```

**Context Fusion Output:**
```json
{
  "contextType": "AT_HOME",
  "confidence": 0.86,
  "description": "At home - preparing to leave for appointment",
  "key_signals": [
    "Movement detected at home boundary",
    "Doctor appointment in 40 minutes",
    "Departure probability: 73%"
  ]
}
```

---

#### **9:25 AM - Departure Confirmed**

**Location Intelligence:**
```json
{
  "previousPlace": { "name": "Home", "type": "HOME" },
  "locationState": "TRAVELING",
  "movementState": { "state": "DRIVING", "speedKmh": 35 },
  "travelMode": "CAR",
  "destination": { 
    "name": "KIMS Hospital", 
    "type": "HOSPITAL" 
  },
  "arrivalProbability": 0.89,
  "movementIntent": "GOING_TO_APPOINTMENT"
}
```

**Calendar Intelligence:**
```json
{
  "nextEvent": {
    "title": "Doctor Appointment",
    "startTime": "10:00 AM",
    "minutesUntil": 35,
    "status": "TRAVELING_TO"
  },
  "travelStatus": {
    "onTime": true,
    "estimatedArrival": "9:58 AM",
    "buffer": "2 minutes"
  }
}
```

**Context Fusion Output:**
```json
{
  "contextType": "TRAVELING_TO_MEETING",
  "confidence": 0.96,
  "description": "Traveling to Doctor Appointment (CAR)",
  "key_signals": [
    "Location Intelligence: Going to appointment",
    "Destination: KIMS Hospital (89% probability)",
    "Calendar: Doctor Appointment in 35 minutes",
    "Movement: Driving (35 km/h)",
    "Travel mode: CAR"
  ],
  "insights": {
    "eta": "9:58 AM",
    "onTime": true,
    "timeBuffer": "2 minutes"
  },
  "recommendations": [
    "You're on time for your appointment",
    "ETA: 9:58 AM (2 minutes before scheduled time)"
  ]
}
```

**LifeOS Understands:**
- You left home
- You're driving
- You're going to your doctor appointment
- You're on time
- ETA is 9:58 AM

**No user input required. Zero manual updates.**

---

#### **9:55 AM - Approaching Hospital**

**Location Intelligence:**
```json
{
  "locationState": "APPROACHING_DESTINATION",
  "destination": { "name": "KIMS Hospital", "type": "HOSPITAL" },
  "arrivalProbability": 0.97,
  "movementState": { "state": "DRIVING", "speedKmh": 15 },
  "distanceToDestination": 450
}
```

**Location Policy Engine:**
```json
{
  "samplingPolicy": "HIGH_ACCURACY",
  "intervalSeconds": 10,
  "accuracyMeters": 20
}
```

**Context Fusion Output:**
```json
{
  "contextType": "TRAVELING_TO_MEETING",
  "confidence": 0.98,
  "description": "Approaching KIMS Hospital - arriving on time",
  "key_signals": [
    "450m from destination",
    "Arrival probability: 97%",
    "Appointment starts in 5 minutes",
    "Currently slowing down (15 km/h)"
  ],
  "recommendations": [
    "You are approaching your destination",
    "Appointment starts in 5 minutes"
  ]
}
```

---

#### **10:02 AM - Arrived**

**Location Intelligence:**
```json
{
  "currentPlace": { "name": "KIMS Hospital", "type": "HOSPITAL" },
  "locationState": "ARRIVED",
  "movementState": { "state": "STATIONARY" },
  "dwellTime": 2
}
```

**Calendar Intelligence:**
```json
{
  "currentEvent": {
    "title": "Doctor Appointment",
    "status": "LIKELY_ATTENDING",
    "startTime": "10:00 AM",
    "location": "KIMS Hospital",
    "locationMatch": true
  }
}
```

**Context Fusion Output:**
```json
{
  "contextType": "IN_MEETING",
  "confidence": 0.94,
  "description": "At KIMS Hospital - Doctor Appointment in progress",
  "key_signals": [
    "Location: KIMS Hospital",
    "Calendar event: Doctor Appointment",
    "Location and calendar alignment: 94% match",
    "User stationary at appointment location"
  ],
  "insights": {
    "appointmentConfirmed": true,
    "method": "automatic_location_detection"
  }
}
```

**LifeOS Understands:**
- You arrived at the hospital
- You're at your appointment
- No check-in needed from you

---

#### **10:45 AM - Appointment Ending**

**Location Intelligence:**
```json
{
  "currentPlace": { "name": "KIMS Hospital", "type": "HOSPITAL" },
  "locationState": "DWELLING",
  "dwellTime": 43,
  "departureProbability": 0.12
}
```

**Calendar Intelligence:**
```json
{
  "currentEvent": {
    "title": "Doctor Appointment",
    "status": "ENDING_SOON",
    "endTime": "10:30 AM",
    "minutesOver": 15
  },
  "nextEvent": {
    "title": "Team Lunch",
    "startTime": "12:30 PM",
    "location": "Office"
  }
}
```

**Context Fusion Output:**
```json
{
  "contextType": "IN_MEETING",
  "confidence": 0.88,
  "description": "Doctor appointment running over - Team lunch at 12:30",
  "key_signals": [
    "Still at hospital (43 minutes)",
    "Appointment scheduled end: 10:30 AM",
    "Next event: Team Lunch at 12:30 PM",
    "Travel time to office: 40 minutes"
  ],
  "recommendations": [
    "Your appointment is running over schedule",
    "Team Lunch starts at 12:30 PM - plenty of time remaining"
  ]
}
```

---

#### **11:15 AM - Leaving Hospital**

**Location Intelligence:**
```json
{
  "previousPlace": { "name": "KIMS Hospital", "type": "HOSPITAL" },
  "locationState": "DEPARTED",
  "movementState": { "state": "WALKING", "speedKmh": 4 }
}
```

**Notification Intelligence:**
```json
{
  "recentNotifications": [
    {
      "app": "Pharmacy",
      "title": "Prescription Ready",
      "text": "Your prescription is ready for pickup",
      "category": "PHARMACY",
      "priority": "MEDIUM"
    }
  ]
}
```

**Context Fusion Output:**
```json
{
  "contextType": "UNKNOWN",
  "confidence": 0.72,
  "description": "Left hospital - pharmacy notification received",
  "key_signals": [
    "Departed from hospital",
    "Walking",
    "Prescription ready notification",
    "Next event: Team Lunch (12:30 PM)"
  ],
  "recommendations": [
    "Prescription ready for pickup",
    "You have time before lunch at 12:30 PM"
  ]
}
```

---

#### **11:20 AM - At Pharmacy**

**Location Intelligence:**
```json
{
  "currentPlace": { "name": "MedPlus Pharmacy", "type": "SHOP" },
  "locationState": "ARRIVED",
  "movementState": { "state": "STATIONARY" }
}
```

**Notification Intelligence:**
```json
{
  "contextMatch": {
    "notification": "Prescription Ready",
    "currentLocation": "Pharmacy",
    "matchConfidence": 0.93
  }
}
```

**Context Fusion Output:**
```json
{
  "contextType": "SHOPPING",
  "confidence": 0.91,
  "description": "At pharmacy - picking up prescription",
  "key_signals": [
    "Location: Pharmacy",
    "Recent notification: Prescription ready",
    "Location-notification alignment: 93%"
  ],
  "insights": {
    "taskLikelyCompleted": "prescription_pickup",
    "inferenceMethod": "location_notification_fusion"
  }
}
```

**LifeOS Understands:**
- You stopped at a pharmacy
- You received a prescription notification
- You're likely picking up the prescription
- This is an unscheduled but contextually logical stop

---

#### **11:35 AM - Heading to Office**

**Location Intelligence:**
```json
{
  "previousPlace": { "name": "MedPlus Pharmacy", "type": "SHOP" },
  "locationState": "TRAVELING",
  "destination": { "name": "Office", "type": "WORK" },
  "movementState": { "state": "DRIVING", "speedKmh": 42 },
  "travelMode": "CAR",
  "movementIntent": "COMMUTING_TO_WORK"
}
```

**Calendar Intelligence:**
```json
{
  "nextEvent": {
    "title": "Team Lunch",
    "startTime": "12:30 PM",
    "location": "Office",
    "minutesUntil": 55
  },
  "travelStatus": {
    "onTime": true,
    "estimatedArrival": "12:05 PM",
    "buffer": "25 minutes"
  }
}
```

**Context Fusion Output:**
```json
{
  "contextType": "COMMUTING",
  "confidence": 0.94,
  "description": "Driving to office for Team Lunch",
  "key_signals": [
    "Location Intelligence: Commuting to work",
    "Destination: Office",
    "Calendar: Team Lunch at 12:30 PM",
    "ETA: 12:05 PM (25 minutes early)"
  ],
  "recommendations": [
    "You'll arrive with plenty of time before lunch"
  ]
}
```

---

#### **12:08 PM - Arrived at Office**

**Location Intelligence:**
```json
{
  "currentPlace": { "name": "Office", "type": "WORK" },
  "locationState": "ARRIVED",
  "movementState": { "state": "STATIONARY" }
}
```

**Calendar Intelligence:**
```json
{
  "nextEvent": {
    "title": "Team Lunch",
    "status": "STARTING_SOON",
    "minutesUntil": 22,
    "location": "Office",
    "locationMatch": true
  }
}
```

**Context Fusion Output:**
```json
{
  "contextType": "AT_WORK",
  "confidence": 0.95,
  "description": "At office - Team Lunch starts in 22 minutes",
  "key_signals": [
    "Location: Office",
    "Calendar: Team Lunch in 22 minutes",
    "Arrived 25 minutes early"
  ]
}
```

---

## What Makes This Powerful

### 1. **Zero Manual Input**

The user never:
- Checked in to the doctor
- Updated their status
- Logged their trip
- Confirmed arrival
- Recorded the pharmacy stop

**Everything was automatic.**

### 2. **Multi-Signal Validation**

Each inference is validated by multiple sensors:

**"User is at doctor appointment"** confirmed by:
- Location: At KIMS Hospital
- Calendar: Doctor Appointment scheduled
- Notification: Appointment reminder sent
- Movement: Arrived and stationary

**Confidence: 94%**

### 3. **Contextual Understanding**

LifeOS understands:
- The appointment is the *reason* for the trip
- The pharmacy stop makes *sense* after a doctor visit
- The office is the *destination* because of the lunch event
- The user is *on time* or *running late*

**This is semantic understanding, not just data collection.**

### 4. **Predictive Intelligence**

LifeOS predicts:
- You're going to the hospital (before you arrive)
- You'll be on time (during travel)
- You're probably picking up a prescription (pharmacy + notification)
- You're heading to work (based on calendar + routine)

### 5. **Proactive Recommendations**

LifeOS can suggest:
- "Consider leaving soon" (before departure)
- "You're on time" (during travel)
- "Appointment running over" (during event)
- "Prescription ready" (contextual reminder)

---

## The Architecture of Intelligence

```
┌─────────────────────────────────────────────────────────┐
│                    USER'S LIFE                          │
│  (Appointments, Movement, Notifications, Routines)      │
└─────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ↓                   ↓                   ↓
   NOTIFICATION        CALENDAR            LOCATION
   INTELLIGENCE       INTELLIGENCE       INTELLIGENCE
        │                   │                   │
        │                   │                   │
   • Category          • Conflicts         • Places
   • Priority          • Travel time       • Movement
   • Entities          • Feasibility       • Destination
   • Action           • Clustering        • Routines
        │                   │                   │
        └───────────────────┼───────────────────┘
                            ↓
                    CONTEXT FUSION
                            │
                ┌───────────┼───────────┐
                ↓           ↓           ↓
            Validation  Enrichment  Inference
                │           │           │
                └───────────┼───────────┘
                            ↓
                    FUSED CONTEXT
                            │
            ┌───────────────┼───────────────┐
            ↓               ↓               ↓
        INSIGHTS    RECOMMENDATIONS    INTERVENTIONS
            │               │               │
            └───────────────┼───────────────┘
                            ↓
                    PASSIVE AGENT
                            │
                            ▼
                    USER EXPERIENCE
```

---

## Code Example: Full Integration

### Backend Integration

```typescript
// In your context service or API route
import { LocationContextEngine } from '../intelligence/location';
import { CalendarIntelligence } from '../intelligence/calendar';
import { NotificationIntelligence } from '../intelligence/notification';
import { ContextFusionEngine } from '../services/context-fusion';

// Initialize engines
const locationEngine = new LocationContextEngine({
  onContextUpdate: async (locationContext) => {
    // Get other intelligence data
    const calendarData = await CalendarIntelligence.getUpcomingEvents();
    const notifications = await NotificationIntelligence.getRecent();
    
    // Get recent life events
    const recentEvents = await getLifeEvents(userId, 60); // Last 60 minutes
    
    // Fuse with location context
    const fusedContext = await ContextFusionEngine.getCurrentContext(
      userId,
      recentEvents,
      locationContext  // NEW: Pass location context
    );
    
    // Store fused context
    await saveFusedContext(userId, fusedContext);
    
    // Generate interventions if needed
    if (fusedContext.recommendations?.length > 0) {
      await generateInterventions(userId, fusedContext);
    }
  },
});

// Start location engine
await locationEngine.start();
```

### API Endpoint for Full Context

```typescript
router.get('/api/context/current', async (req, res) => {
  const userId = req.user.id;
  
  // Get all intelligence sources
  const [locationContext, calendarContext, notifications] = await Promise.all([
    locationEngine.getCurrentContext(),
    calendarIntelligence.getCurrentContext(userId),
    notificationIntelligence.getRecentNotifications(userId),
  ]);
  
  // Get recent events
  const recentEvents = await getLifeEvents(userId, 60);
  
  // Fuse
  const fusedContext = await ContextFusionEngine.getCurrentContext(
    userId,
    recentEvents,
    locationContext
  );
  
  res.json({
    location: locationContext,
    calendar: calendarContext,
    notifications: notifications.slice(0, 5),
    fused: fusedContext,
    timestamp: new Date().toISOString(),
  });
});
```

### Frontend Display

```typescript
import React, { useState, useEffect } from 'react';

function FullContextView() {
  const [context, setContext] = useState(null);
  
  useEffect(() => {
    const loadContext = async () => {
      const response = await fetch('/api/context/current');
      const data = await response.json();
      setContext(data);
    };
    
    loadContext();
    const interval = setInterval(loadContext, 10000);
    return () => clearInterval(interval);
  }, []);
  
  if (!context) return <div>Loading...</div>;
  
  return (
    <div className="full-context">
      <h2>Current Life Context</h2>
      
      {/* Fused Context - The Main Display */}
      <div className="fused-context-card">
        <h3>{context.fused.contextType}</h3>
        <p className="description">{context.fused.insights.description}</p>
        <div className="confidence">
          {Math.round(context.fused.confidence * 100)}% confident
        </div>
        
        <div className="key-signals">
          <h4>Why we think this:</h4>
          <ul>
            {context.fused.insights.key_signals.map((signal, i) => (
              <li key={i}>{signal}</li>
            ))}
          </ul>
        </div>
        
        {context.fused.recommendations && (
          <div className="recommendations">
            <h4>Suggestions:</h4>
            <ul>
              {context.fused.recommendations.map((rec, i) => (
                <li key={i}>{rec}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
      
      {/* Individual Intelligence Sources */}
      <div className="intelligence-sources">
        <div className="location-source">
          <h4>Location</h4>
          <p>State: {context.location.locationState}</p>
          {context.location.currentPlace && (
            <p>Place: {context.location.currentPlace.name}</p>
          )}
          {context.location.destination && (
            <p>Going to: {context.location.destination.name}</p>
          )}
        </div>
        
        <div className="calendar-source">
          <h4>Calendar</h4>
          {context.calendar.nextEvent && (
            <>
              <p>{context.calendar.nextEvent.title}</p>
              <p>{context.calendar.nextEvent.startTime}</p>
            </>
          )}
        </div>
        
        <div className="notifications-source">
          <h4>Recent Notifications</h4>
          {context.notifications.map(notif => (
            <div key={notif.id} className="notif-item">
              <strong>{notif.app}</strong>: {notif.title}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

---

## Testing the Integration

### Test Script

```javascript
// Run this in your browser console or Node environment

async function testThreeSensorIntegration() {
  console.log('🧪 Testing Three-Sensor Integration\n');
  
  // 1. Get Location Context
  console.log('📍 Location Intelligence:');
  const location = await fetch('/api/location/context').then(r => r.json());
  console.log(`  State: ${location.locationState}`);
  console.log(`  Place: ${location.currentPlace?.name || 'Unknown'}`);
  console.log(`  Movement: ${location.movementState.state}`);
  console.log(`  Confidence: ${Math.round(location.confidence * 100)}%\n`);
  
  // 2. Get Calendar Context
  console.log('📅 Calendar Intelligence:');
  const calendar = await fetch('/api/calendar/context').then(r => r.json());
  console.log(`  Next Event: ${calendar.nextEvent?.title || 'None'}`);
  console.log(`  Conflicts: ${calendar.conflicts?.length || 0}`);
  console.log(`  Schedule Pressure: ${calendar.schedulePressure || 'None'}\n`);
  
  // 3. Get Notification Context
  console.log('🔔 Notification Intelligence:');
  const notifs = await fetch('/api/notification-intelligence/recent').then(r => r.json());
  console.log(`  Recent: ${notifs.notifications?.length || 0}`);
  console.log(`  High Priority: ${notifs.notifications?.filter(n => n.priority === 'HIGH').length || 0}\n`);
  
  // 4. Get Fused Context
  console.log('🔮 Context Fusion:');
  const fused = await fetch('/api/context/current').then(r => r.json());
  console.log(`  Context: ${fused.fused.contextType}`);
  console.log(`  Description: ${fused.fused.insights.description}`);
  console.log(`  Confidence: ${Math.round(fused.fused.confidence * 100)}%`);
  console.log(`  Key Signals:`);
  fused.fused.insights.key_signals.forEach(signal => {
    console.log(`    • ${signal}`);
  });
  
  if (fused.fused.recommendations) {
    console.log(`  Recommendations:`);
    fused.fused.recommendations.forEach(rec => {
      console.log(`    💡 ${rec}`);
    });
  }
  
  console.log('\n✅ Integration test complete!');
}

// Run the test
testThreeSensorIntegration();
```

---

## Success Metrics

The integration is successful when:

1. **Automatic Context Detection**
   - ✅ System detects "TRAVELING_TO_MEETING" without user input
   - ✅ Combines location + calendar + notification data
   - ✅ Confidence > 90%

2. **Cross-Validation**
   - ✅ Location confirms calendar attendance
   - ✅ Notifications align with current context
   - ✅ Multiple signals validate each inference

3. **Predictive Accuracy**
   - ✅ Destination prediction: 85%+ accuracy
   - ✅ ETA calculation: Within 5 minutes
   - ✅ Context transition: Smooth state changes

4. **User Experience**
   - ✅ No manual check-ins required
   - ✅ Contextual recommendations appear automatically
   - ✅ System understands user's day without explicit input

---

## What's Next

### Phase 1: Intervention Engine (Completed)
- ✅ Three intelligence sensors
- ✅ Context fusion
- ✅ Basic recommendations

### Phase 2: Proactive Interventions (Next)
- 🔄 Automatic intervention generation
- 🔄 Context-aware notification delivery
- 🔄 Smart reminders based on location

### Phase 3: Learning & Adaptation (Future)
- ⏳ User preference learning
- ⏳ Intervention effectiveness tracking
- ⏳ Adaptive recommendation engine

### Phase 4: Multi-User Context (Future)
- ⏳ Shared calendar understanding
- ⏳ Co-location detection
- ⏳ Group activity intelligence

---

**Congratulations!** You now have a fully integrated, three-sensor Passive Agent that understands your life through the fusion of location, calendar, and notification intelligence. 🎉
