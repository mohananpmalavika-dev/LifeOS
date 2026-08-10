# Location Intelligence Implementation Summary

## Overview

Location Intelligence has been implemented as the **third major Context Sensor** for LifeOS, alongside Notification Intelligence and Calendar Intelligence. It transforms raw GPS coordinates into meaningful life context by understanding places, movement patterns, routines, and destinations.

**Key Philosophy:** GPS tells LifeOS where the phone is. Location Intelligence tells LifeOS what the user is doing geographically.

---

## Architecture

### High-Level System Flow

```
                    LOCATION SIGNALS
                         │
          ┌──────────────┼──────────────┐
          ↓              ↓              ↓
       GPS/GNSS       Activity       Wi-Fi/
                      Recognition     Bluetooth
          │              │              │
          └──────────────┼──────────────┘
                         ↓
                 Location Engine
                         │
              ┌──────────┼──────────┐
              ↓          ↓          ↓
           Place      Movement     Routine
          Engine       Engine      Engine
              │          │          │
              └──────────┼──────────┘
                         ↓
                  LocationContext
                         │
                         ▼
                  Context Fusion
                         │
                         ▼
                   LifeOS Graph
```

---

## Core Components

### 1. **LocationContextEngine** (Main Orchestrator)

The central coordination point that combines all engines to produce comprehensive `LocationContext`.

**Features:**
- Orchestrates all sub-engines
- Produces unified LocationContext
- Manages update intervals based on policy
- Emits location events for LifeOS consumption

**Key Methods:**
- `start()` / `stop()` - Control the intelligence engine
- `updateContext()` - Main processing loop
- `getCurrentContext()` - Get current state
- `recordPlaceVisit()` - Manual training input

**Example Usage:**
```typescript
const engine = new LocationContextEngine({
  onContextUpdate: (context) => {
    console.log('Location context:', context);
  },
  onLocationEvent: (event) => {
    console.log('Location event:', event.type);
  },
});

await engine.start();
```

---

### 2. **PlaceEngine** (Place Detection & Clustering)

Answers: "What real-world place does this coordinate represent for this user?"

**Features:**
- **Automatic place clustering** - Groups nearby coordinates into places
- **Home/Work detection** - Learns from overnight dwell and weekday patterns
- **Geofence management** - Creates dynamic geofences for efficiency
- **Place learning** - Improves with each visit

**Place Types:**
- HOME, WORK, SCHOOL, GYM, HOSPITAL, RESTAURANT, SHOP, AIRPORT, etc.

**Key Algorithms:**
```
Position
 ↓
Distance check to known places
 ↓
Within radius? → Return place
Outside all? → Cluster or create new place
```

**Learning Process:**
```
New location
 ↓
Visit 1: Create place, low confidence
Visit 2-3: Expand radius, increase confidence
Visit 5+: Analyze patterns (time, day)
Pattern match: Infer type (HOME/WORK/GYM)
```

**Example:**
```typescript
const place = await placeEngine.identifyPlace(position);
// Returns: { placeId, name, type, confidence }

placeEngine.setPlaceType(placeId, PlaceType.HOME);
```

---

### 3. **MovementEngine** (Travel Mode Detection)

Analyzes movement to determine state and travel mode.

**Movement States:**
- STATIONARY, WALKING, RUNNING, CYCLING, DRIVING, IN_VEHICLE, TRANSIT

**Travel Mode Inference:**
```
Activity Recognition
+
Speed analysis
+
Bluetooth (car device detection)
+
Stop pattern analysis
→
CAR / BUS / TRAIN / CYCLING / WALKING
```

**Features:**
- Cross-validates activity with speed
- Detects frequent stops (bus vs car)
- Tracks movement consistency
- Calculates average speed

---

### 4. **LocationStateMachine** (Arrival/Departure Detection)

Manages state transitions with **hysteresis** to prevent GPS bouncing.

**States:**
```
STATIONARY_AT_PLACE
        ↓ movement detected
POSSIBLE_DEPARTURE
        ↓ confirmed leaving
DEPARTED
        ↓
TRAVELING
        ↓ approaching destination
APPROACHING_DESTINATION
        ↓ stopped
POSSIBLE_ARRIVAL
        ↓ stable position
ARRIVED
        ↓
DWELLING
```

**Hysteresis Configuration:**
- **Arrival stability:** 120 seconds stationary before confirming
- **Departure stability:** 90 seconds movement before confirming

**Probability Calculations:**
- `arrivalProbability` - Based on destination proximity, speed, state
- `departureProbability` - Based on movement, place distance, state

---

### 5. **RoutineEngine** (Pattern Learning)

Learns user routines from historical location data.

**Routine Types:**
- WORKDAY_COMMUTE
- MORNING_ROUTINE
- EVENING_ROUTINE
- WEEKEND_ACTIVITY
- WEEKLY_APPOINTMENT

**Learning Process:**
```
Historical transitions
 ↓
Group by: from-place, to-place, day-type, time-block
 ↓
Calculate: time window, day pattern, typical duration
 ↓
Infer: routine type, probability
```

**Example Routine:**
```javascript
{
  name: "Morning Commute",
  type: "WORKDAY_COMMUTE",
  fromPlace: "HOME",
  toPlace: "WORK",
  dayPattern: { daysOfWeek: [1,2,3,4,5] }, // Mon-Fri
  timeWindow: { startHour: 8, startMinute: 30, flexibilityMinutes: 30 },
  probability: 0.91,
  occurrences: 47
}
```

---

### 6. **DestinationEngine** (Destination Prediction)

Predicts where the user is going based on multiple signals.

**Prediction Sources:**
1. **Calendar** - Upcoming appointments
2. **Routine** - Learned patterns
3. **Heading** - Current direction of travel
4. **Recent behavior** - Historical patterns

**Destination Candidates:**
```javascript
[
  {
    place: { placeId: "work_123", name: "Office", type: "WORK" },
    probability: 0.94,
    reason: "Calendar appointment + routine match + heading alignment",
    sources: ["CALENDAR", "ROUTINE", "HEADING"]
  },
  {
    place: { placeId: "gym_456", name: "Gym", type: "GYM" },
    probability: 0.15,
    reason: "Heading toward place",
    sources: ["HEADING"]
  }
]
```

**Scoring:**
- Time until calendar event (closer = higher)
- Routine probability
- Heading alignment (within 45° = strong)
- Distance reasonableness

---

### 7. **LocationPolicyEngine** (Adaptive Sampling)

Dynamically controls GPS sampling to balance **battery efficiency** with **context accuracy**.

**Policies:**

| Policy | Interval | Accuracy | Use Case |
|--------|----------|----------|----------|
| GEOFENCE_ONLY | 5 min | 100m | Dwelling at known place |
| LOW_POWER | 2 min | 100m | Stationary at place |
| NORMAL | 30 sec | 50m | Traveling |
| HIGH_ACCURACY | 10 sec | 20m | Approaching destination |

**Automatic Switching:**
```
Dwelling at home
→ GEOFENCE_ONLY (battery saver)

Movement detected
→ NORMAL

Approaching destination
→ HIGH_ACCURACY

Arrived
→ LOW_POWER
```

---

### 8. **LocationStorage** (Privacy-First Storage)

Implements retention policies and semantic-first storage.

**Storage Layers:**

1. **Raw GPS samples** - Short retention (7 days default)
   ```sql
   location_samples (timestamp, lat, lon, accuracy, ...)
   ```

2. **Learned places** - Long retention
   ```sql
   places (id, name, type, center, radius, visit_count, ...)
   ```

3. **Place visits** - Historical record
   ```sql
   place_visits (visit_id, place_id, arrival, departure, duration, ...)
   ```

4. **Place transitions** - Movement history
   ```sql
   place_transitions (from_place, to_place, duration, travel_mode, ...)
   ```

5. **Routine patterns** - Learned behaviors
   ```sql
   routine_patterns (pattern_id, name, type, day_pattern, time_window, ...)
   ```

6. **Location contexts** - Semantic snapshots
   ```sql
   location_contexts (timestamp, current_place, destination, movement_state, ...)
   ```

**Privacy Modes:**
- **PRIVATE** - Local only, 1-day raw retention
- **BALANCED** - Selected samples, 7-day retention
- **ADVANCED** - Full sync, 30-day retention

---

## Data Model

### LocationContext (The Core Output)

```typescript
{
  timestamp: Date,
  
  // Places
  currentPlace?: {
    placeId: string,
    name?: string,
    type: PlaceType,
    latitude: number,
    longitude: number,
    confidence: number
  },
  previousPlace?: PlaceContext,
  destination?: PlaceContext,
  
  // Movement
  travelMode: TravelMode,           // CAR, BUS, WALKING, etc.
  movementState: {
    state: MovementType,            // STATIONARY, DRIVING, etc.
    speedKmh?: number,
    heading?: number,
    confidence: number
  },
  locationState: LocationState,     // State machine state
  
  // Timing
  dwellTime?: number,                // Minutes at current place
  arrivalProbability: number,        // 0.0 - 1.0
  departureProbability: number,      // 0.0 - 1.0
  
  // Patterns
  routinePattern?: RoutinePattern,
  movementIntent?: MovementIntent,   // COMMUTING_TO_WORK, GOING_HOME, etc.
  
  confidence: number                 // Overall confidence
}
```

---

## Context Fusion Integration

Location Intelligence is integrated into the Context Fusion Engine to provide the most comprehensive contextual understanding.

### Example Fusion Scenarios

#### Scenario 1: Morning Commute

**Inputs:**
- **Location Context:**
  - Current: HOME
  - Movement: DRIVING
  - Destination: WORK (94% probability)
  - Routine: "Morning Commute" (91% match)
  - Intent: COMMUTING_TO_WORK

- **Calendar:**
  - 9:30 AM Office Meeting

- **Notifications:**
  - Meeting reminder received

**Fused Output:**
```javascript
{
  contextType: "COMMUTING",
  confidence: 0.96,
  description: "Commuting to work (CAR) - Office meeting at 9:30",
  key_signals: [
    "Location Intelligence: Commuting to work detected",
    "Routine: Morning Commute (91% match)",
    "Calendar: 9:30 AM Office Meeting",
    "Movement: DRIVING",
    "Destination: WORK (94% probability)"
  ],
  recommendations: [
    "On route to Office meeting"
  ]
}
```

#### Scenario 2: Doctor Appointment

**Inputs:**
- **Location Context:**
  - Current: HOME
  - Movement: DRIVING
  - Destination: HOSPITAL (89% probability)
  - Intent: GOING_TO_APPOINTMENT

- **Calendar:**
  - 10:00 AM Doctor Appointment at KIMS

**Fused Output:**
```javascript
{
  contextType: "TRAVELING_TO_MEETING",
  confidence: 0.93,
  description: "Traveling to appointment: Doctor Appointment",
  key_signals: [
    "Location Intelligence: Going to appointment",
    "Calendar: Doctor Appointment",
    "Destination: KIMS Hospital",
    "Arrival probability: 89%"
  ],
  recommendations: [
    "On route to Doctor Appointment"
  ]
}
```

#### Scenario 3: Dwelling at Work

**Inputs:**
- **Location Context:**
  - Current: WORK
  - Movement: STATIONARY
  - State: DWELLING
  - Dwell time: 125 minutes

- **Calendar:**
  - 11:30 AM Lunch with team (in 30 minutes)

**Fused Output:**
```javascript
{
  contextType: "AT_WORK",
  confidence: 0.94,
  description: "At work",
  key_signals: [
    "Location: Office",
    "Dwelling for 125 minutes",
    "Location state: DWELLING",
    "Upcoming: Lunch with team in 30 minutes"
  ]
}
```

---

## API Endpoints

### GET `/api/location/context`
Get current location context

**Response:**
```javascript
{
  timestamp: "2024-03-15T10:30:00Z",
  currentPlace: { ... },
  destination: { ... },
  travelMode: "CAR",
  movementState: { state: "DRIVING", speedKmh: 45 },
  locationState: "TRAVELING",
  arrivalProbability: 0.87,
  movementIntent: "COMMUTING_TO_WORK",
  confidence: 0.91
}
```

### GET `/api/location/places`
Get all learned places

### GET `/api/location/places/:placeId`
Get specific place with visit history

### PUT `/api/location/places/:placeId`
Update place (name, type, privacy)

### GET `/api/location/routines`
Get learned routine patterns

### GET `/api/location/transitions`
Get place transitions (trips)

### GET `/api/location/timeline`
Get location timeline (contextual sequence)

### POST `/api/location/learn`
Trigger routine learning from historical data

### GET `/api/location/stats`
Get location intelligence statistics

---

## Frontend Features

### Location Intelligence Page (`/location`)

**Tabs:**

1. **Current Context** - Real-time location intelligence
   - Location state visualization
   - Current place, movement, destination
   - Arrival/departure probabilities
   - Detected routine
   - Movement intent

2. **Places** - Learned places management
   - Grid view of all places
   - Visit counts, dwell times, confidence
   - Edit names and types
   - Private place marking
   - Automatic HOME/WORK detection status

3. **Routines** - Learned patterns
   - List of routine patterns
   - Day and time patterns
   - Typical duration and travel mode
   - Occurrence count and probability
   - "Learn from History" trigger

4. **Statistics** - Overview dashboard
   - Total places (identified vs unknown)
   - HOME and WORK identification status
   - Total visits and dwell time
   - Learned routines count
   - Top 5 most visited places

---

## Key Algorithms

### 1. Place Clustering

```javascript
function clusterPlace(position, existingPlaces, radius) {
  for (place of existingPlaces) {
    distance = haversineDistance(position, place.center);
    if (distance <= radius) {
      // Expand existing place
      place.center = weightedAverage(place.center, position, place.visitCount);
      place.radius = max(place.radius, distance + position.accuracy);
      return place;
    }
  }
  // Create new place
  return createPlace(position, radius);
}
```

### 2. Home Detection

```javascript
function inferHomePlace(place) {
  nighttimeVisitRatio = place.timeDistribution.night / place.visitCount;
  avgDwellHours = place.totalDwellMinutes / place.visitCount / 60;
  
  if (nighttimeVisitRatio > 0.6 && avgDwellHours > 6) {
    return PlaceType.HOME;
  }
}
```

### 3. Work Detection

```javascript
function inferWorkPlace(place) {
  weekdayRatio = place.dayDistribution.weekday / place.visitCount;
  daytimeRatio = (place.timeDistribution.morning + place.timeDistribution.afternoon) 
                  / place.visitCount;
  avgDwellHours = place.totalDwellMinutes / place.visitCount / 60;
  
  if (weekdayRatio > 0.7 && daytimeRatio > 0.7 && avgDwellHours > 4) {
    return PlaceType.WORK;
  }
}
```

### 4. Destination Probability

```javascript
function calculateDestinationProbability(
  position, 
  candidate, 
  calendarEvents, 
  routine
) {
  let probability = 0.0;
  
  // Calendar-based
  if (hasUpcomingEventAt(candidate, calendarEvents)) {
    probability += 0.7;
  }
  
  // Routine-based
  if (routine && routine.toPlace === candidate.placeId) {
    probability += routine.probability * 0.7;
  }
  
  // Heading-based
  bearing = calculateBearing(position, candidate);
  headingAlignment = 1 - abs(position.heading - bearing) / 90;
  probability += headingAlignment * 0.3;
  
  return min(probability, 1.0);
}
```

---

## Example Contextual Sequences

### Sequence 1: Morning Commute

```
08:30 - DWELLING at HOME (125 min)
  ↓
08:45 - POSSIBLE_DEPARTURE (movement detected)
  ↓
08:47 - DEPARTED (confirmed leaving)
  ↓
08:49 - TRAVELING (CAR, 45 km/h)
        Destination: WORK (94%)
        Routine: Morning Commute (91%)
        Intent: COMMUTING_TO_WORK
  ↓
09:16 - APPROACHING_DESTINATION (within 1km)
  ↓
09:20 - POSSIBLE_ARRIVAL (stopped)
  ↓
09:22 - ARRIVED at WORK
  ↓
09:25 - DWELLING at WORK
```

### Sequence 2: Doctor Appointment

```
09:55 - DWELLING at HOME
  ↓
10:00 - DEPARTURE detected
  ↓
10:02 - TRAVELING to HOSPITAL
        Calendar: 10:30 Doctor
        Probability: 89%
  ↓
10:25 - APPROACHING HOSPITAL
  ↓
10:28 - ARRIVED at HOSPITAL
  ↓
10:35 - DWELLING (in appointment)
  ↓
11:20 - DEPARTURE from HOSPITAL
  ↓
11:25 - TRAVELING HOME
```

---

## Privacy Features

### 1. Local-First Processing

All semantic processing happens on-device. Only high-level contexts are sent to server (optional).

### 2. Raw Location Retention

- **Default:** 7 days
- **Private mode:** 1 day
- **Advanced mode:** 30 days

Raw GPS coordinates are purged automatically.

### 3. Place Privacy

Users can mark places as "private" to:
- Prevent sharing with server
- Exclude from statistics
- Hide from timeline views

### 4. Semantic-First Storage

Instead of storing:
```
08:00 - (8.521, 76.934)
08:05 - (8.522, 76.935)
08:10 - (8.521, 76.934)
...
```

Store:
```
08:00 - DWELLING at HOME
08:45 - DEPARTED from HOME
08:49 - TRAVELING to WORK (CAR)
09:20 - ARRIVED at WORK
```

This is:
- More private (no raw coordinates)
- More useful (semantic meaning)
- More efficient (compressed)

---

## Performance Optimizations

### 1. Adaptive Sampling

Battery consumption scales with context:
- **Dwelling at home:** 5-minute intervals
- **Traveling:** 30-second intervals
- **Approaching destination:** 10-second intervals

### 2. Geofencing

Use OS-level geofences for known places instead of continuous GPS polling.

### 3. Clustering

Group coordinates within 100m radius to avoid place explosion.

### 4. Retention Policies

Automatic cleanup of old raw samples while preserving semantic data.

---

## Integration Points

### 1. Calendar Intelligence

Location Intelligence provides:
- Destination predictions for calendar events
- Travel time estimates
- Arrival confirmations
- Schedule feasibility checks

Calendar Intelligence provides:
- Destination candidates
- Expected travel times
- Appointment context

### 2. Notification Intelligence

Location Intelligence provides:
- Context for notification delivery decisions
- "Arriving home" triggers for reminders
- "At work" context for work notifications

Notification Intelligence provides:
- Appointment reminders
- Location-tagged notifications

### 3. Context Fusion

Location Intelligence is the **primary input** for context fusion, providing the most comprehensive understanding of user state.

---

## Future Enhancements

### 1. Multi-Device Coordination

Track location from multiple devices (phone, watch, car) and fuse into single context.

### 2. Transportation Mode Details

- Detect specific bus/train routes
- Identify personal vehicle vs rideshare
- Track parking locations

### 3. Indoor Positioning

- Wi-Fi fingerprinting for building-level accuracy
- Beacon-based positioning
- Floor detection

### 4. Social Context

- Detect co-location with contacts
- Identify recurring social patterns
- Group activity detection

### 5. Environmental Context

- Weather correlation
- Traffic pattern learning
- Seasonal behavior adaptation

---

## Testing Scenarios

### Manual Testing Checklist

1. **Place Learning**
   - [ ] Visit new location 5+ times
   - [ ] Verify place gets created and clustered
   - [ ] Check confidence increases with visits
   - [ ] Confirm HOME detection after overnight dwells
   - [ ] Confirm WORK detection after weekday patterns

2. **Movement Detection**
   - [ ] Walk and verify WALKING state
   - [ ] Drive and verify DRIVING state
   - [ ] Check speed calculations
   - [ ] Verify travel mode inference

3. **Arrival/Departure**
   - [ ] Leave home and verify DEPARTURE event
   - [ ] Arrive at work and verify ARRIVAL event
   - [ ] Check probability transitions
   - [ ] Verify hysteresis prevents bouncing

4. **Routine Learning**
   - [ ] Perform same trip 5+ times
   - [ ] Trigger routine learning
   - [ ] Verify routine pattern created
   - [ ] Check time window flexibility
   - [ ] Confirm day pattern detection

5. **Destination Prediction**
   - [ ] Add calendar event with location
   - [ ] Start traveling toward location
   - [ ] Verify destination prediction
   - [ ] Check probability increases as approaching

6. **Context Fusion**
   - [ ] Travel to calendar appointment
   - [ ] Verify "TRAVELING_TO_MEETING" context
   - [ ] Arrive and verify "AT_LOCATION" context
   - [ ] Check confidence scores

---

## Success Metrics

Location Intelligence is successful when it can answer:

1. **Where is the user?**
   - Not coordinates, but semantic place
   - "At home" not "(8.521, 76.934)"

2. **What are they doing?**
   - "Commuting to work"
   - "At doctor appointment"
   - "Exercising at gym"

3. **Where are they going?**
   - Predict destination before arrival
   - 80%+ accuracy for routine trips
   - Calendar integration for appointments

4. **What patterns exist?**
   - Learn commute routines
   - Detect weekly appointments
   - Identify home/work automatically

5. **How confident are we?**
   - Provide explicit confidence scores
   - Track confidence factors
   - Handle uncertainty gracefully

---

## Conclusion

Location Intelligence transforms LifeOS from a passive data collector into an active, contextually-aware Passive Agent. By understanding not just where the user is, but what they're doing geographically, LifeOS can:

- Provide timely, contextual interventions
- Understand life patterns without manual input
- Predict user needs before they articulate them
- Respect privacy through semantic-first architecture

**The key insight:** A sequence like "Home → Leaving → Driving → Hospital" is infinitely more valuable than 1,000 GPS coordinates. That's what Location Intelligence delivers.
