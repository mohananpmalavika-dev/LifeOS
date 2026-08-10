# Calendar Intelligence Implementation

## Overview

Calendar Intelligence transforms calendar events from simple time slots into actionable intelligence about real-world situations. The system analyzes events to detect conflicts, estimate travel requirements, identify preparation needs, and calculate schedule feasibility.

## Architecture

```
CALENDAR EVENT
      ↓
Event Classification
      ↓
Person Resolution
      ↓
Place Resolution
      ↓
Travel Engine
      ↓
Preparation Analysis
      ↓
Document Analysis
      ↓
Conflict Detection
      ↓
Schedule Feasibility
      ↓
Context Fusion
      ↓
Interventions
```

## Core Components

### 1. Event Classifier (`EventClassifier.ts`)
- **Purpose**: Classifies calendar events into 20+ event types
- **Features**:
  - Keyword-based pattern matching
  - Heuristic analysis (corporate email, attendee count, duration)
  - Confidence scoring
  - Event type profiles with preparation/travel/document likelihoods

**Event Types**: Medical Appointment, Work Meeting, Flight, Train, Exam, Government, Legal, Restaurant, Family, Birthday, etc.

### 2. Person Resolver (`PersonResolver.ts`)
- **Purpose**: Resolves calendar attendees to known person entities
- **Resolution Methods**:
  - Exact email match (confidence: 0.97)
  - Exact phone match (confidence: 0.95)
  - Name matching (confidence: 0.75)
  - Fuzzy name matching (confidence: 0.65)
- **Features**:
  - Organization extraction from email domains
  - Interaction history tracking
  - Confidence scoring

### 3. Place Resolver (`PlaceResolver.ts`)
- **Purpose**: Resolves calendar locations to known place entities
- **Resolution Methods**:
  - Coordinate matching (confidence: 0.95)
  - Address matching (confidence: 0.90)
  - Semantic label matching (Home, Office, Gym - confidence: 0.92)
  - Name matching (confidence: 0.85)
  - Fuzzy name matching (confidence: 0.70)
- **Features**:
  - Place type inference (Hospital, Airport, Office, etc.)
  - Preparation profiles (buffer times, access times)
  - Visit frequency tracking

### 4. Travel Engine (`TravelEngine.ts`)
- **Purpose**: Calculates travel requirements between locations
- **Features**:
  - Haversine distance calculation
  - Transport mode inference (Walk, Bike, Car, Bus, Train, Flight)
  - Historical travel time tracking
  - Contextual adjustments:
    - Rush hour: +30% duration
    - Weekends: -10% duration
    - Day of week patterns
  - Place-specific buffer times:
    - Airport: 120 min
    - Hospital: 15 min
    - Office: 10 min
  - Travel feasibility checking

### 5. Conflict Engine (`ConflictEngine.ts`)
- **Purpose**: Detects multiple types of scheduling conflicts
- **Conflict Types**:
  1. **Temporal**: Direct time overlaps
  2. **Travel**: Insufficient time to travel between locations
  3. **Preparation**: Not enough time to prepare
  4. **Person**: Same person double-booked
  5. **Resource**: Shared resources (documents, devices)
- **Features**:
  - Schedule window calculation (includes prep + travel time)
  - Severity scoring (Low, Medium, High, Critical)
  - Resolution suggestions (move, cancel, remote attend, notify)

### 6. Preparation Engine (`PreparationEngine.ts`)
- **Purpose**: Analyzes event preparation requirements
- **Features**:
  - Event-specific task generation:
    - Medical: Bring medical records
    - Flight: Check-in 24h before, pack luggage
    - Exam: Gather study materials
    - Presentation: Prepare slides
  - Time estimation
  - Deadline calculation
  - Preparation tracking

### 7. Document Engine (`DocumentEngine.ts`)
- **Purpose**: Identifies required documents for events
- **Features**:
  - Event type-based recommendations
  - Text parsing (extracts "bring X" mentions)
  - Historical usage learning
  - Document availability checking
  - Expiry tracking
  - Confidence scoring based on:
    - Event type profile
    - Keyword presence
    - Historical patterns

### 8. Schedule Analyzer (`ScheduleAnalyzer.ts`)
- **Purpose**: Calculates daily/weekly schedule feasibility
- **Features**:
  - Feasibility scoring (0-1)
  - Warning generation:
    - Tight transitions (<15 min gaps)
    - Travel risks
    - Missing preparation
    - Insufficient buffer
  - Schedule metrics:
    - Total events
    - Travel time
    - Preparation time
    - Available buffer
  - Optimal meeting time finder

### 9. Calendar Context Bridge (`CalendarContextBridge.ts`)
- **Purpose**: Integrates calendar with LifeOS Context Fusion
- **Features**:
  - Converts calendar events to LifeEvents
  - Creates context links (person, place, organization, documents)
  - Generates interventions:
    - Schedule conflicts (high/critical priority)
    - Travel reminders (30 min before departure)
    - Missing documents (24h before event)
    - Incomplete preparation (12h before event)
  - Provides calendar context for time windows

## Data Models

### LifeCalendarEvent (Normalized)
```typescript
{
  id: string
  source: 'GOOGLE' | 'OUTLOOK' | 'APPLE' | 'ANDROID'
  title: string
  startTime: ISO8601
  endTime: ISO8601
  location: { name, address, lat, lon }
  organizer: { name, email }
  attendees: [{ name, email }]
  status: 'CONFIRMED' | 'TENTATIVE' | 'CANCELLED'
}
```

### EnrichedCalendarEvent
```typescript
{
  event: LifeCalendarEvent
  eventType: EventType
  people: ResolvedPerson[]
  place: ResolvedPlace
  travelRequirement: {
    required: boolean
    mode: 'CAR' | 'BUS' | 'WALK' | ...
    durationMin: number
    distanceKm: number
    requiredDepartureTime: ISO8601
  }
  preparation: {
    required: boolean
    estimatedMinutes: number
    items: [{ type, description, completed }]
  }
  requiredDocuments: [{
    type: string
    required: boolean
    available: boolean
  }]
  conflicts: [{
    type: ConflictType
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
    description: string
  }]
  importance: { score: 0-1 }
  flexibility: { score: 0-1 }
}
```

## API Endpoints

### Calendar Management
- `POST /api/calendar/events` - Create/update event
- `GET /api/calendar/events/:id` - Get enriched event
- `DELETE /api/calendar/events/:id` - Delete event
- `POST /api/calendar/sync` - Bulk sync events

### Schedule Analysis
- `GET /api/calendar/schedule?startDate=X&endDate=Y` - Get schedule analysis
- `GET /api/calendar/conflicts?startDate=X&endDate=Y` - Get conflicts
- `GET /api/calendar/feasibility/:date` - Get daily feasibility

### Context Integration
- `POST /api/v1/context/events/calendar-sync` - Sync to context system
- `GET /api/v1/context/calendar-context?startTime=X&endTime=Y` - Get calendar context

## Database Schema

### Tables
- `calendar_events` - Normalized calendar events
- `calendar_event_attendees` - Event attendees
- `travel_history` - Historical travel observations
- `documents` - Stored documents
- `document_tags` - Document categorization
- `document_usage_history` - Document usage patterns
- `calendar_event_enrichments` - Cached enrichment data
- `schedule_conflicts` - Detected conflicts

## Frontend UI

### Calendar Page Features
- **Date Navigation**: Previous/Next day, date picker
- **View Modes**: Day view, Week view
- **Feasibility Score**: Visual indicator (color-coded)
- **Schedule Metrics**: Events, travel time, buffer time, conflicts
- **Warnings**: Tight transitions, travel risks, missing prep
- **Event Cards**:
  - Event type badge
  - Importance/flexibility scores (progress bars)
  - Travel details (mode, duration, departure time)
  - Preparation tasks (checklist)
  - Required documents (available/missing)
  - Conflicts (with severity indicators)

## Example Use Case

### Input: Two Calendar Events
```
10:00 AM - Doctor appointment at KIMS Hospital
11:30 AM - Client meeting at Technopark Office
```

### Processing Flow

1. **Classification**
   - Event 1: MEDICAL_APPOINTMENT (confidence: 0.9)
   - Event 2: WORK_MEETING (confidence: 0.85)

2. **Place Resolution**
   - KIMS Hospital → coordinates (10.01°N, 76.36°E)
   - Technopark → coordinates (8.55°N, 76.88°E)

3. **Travel Analysis**
   - Distance: 18.2 km
   - Mode: CAR (confidence: 0.8)
   - Base duration: 35 min
   - Buffer: 10 min
   - Required departure: 10:45 AM

4. **Conflict Detection**
   - Type: TRAVEL_CONFLICT
   - Severity: HIGH
   - Reason: "Travel requires 45 min, only 30 min available"

5. **Output**
```json
{
  "conflict": {
    "type": "TRAVEL_CONFLICT",
    "severity": "HIGH",
    "description": "Insufficient time for travel",
    "reason": "Travel from KIMS Hospital to Technopark requires 45 minutes, but only 30 minutes available (15 minutes short)"
  },
  "resolution_options": [
    "Reschedule client meeting to 12:00 PM",
    "End doctor appointment earlier",
    "Attend client meeting remotely"
  ]
}
```

6. **Intervention Generated**
```
Title: "Schedule Conflict: Client meeting"
Priority: HIGH
Description: "Insufficient time for travel between events"
Action: "Consider rescheduling one event or adjusting departure time"
```

## Key Intelligence Features

### 1. Real-World Timeline Compatibility
Instead of just checking time overlap, calculates if user can physically attend both events including travel.

### 2. Contextual Travel Prediction
- Uses historical data for the specific route
- Adjusts for time of day (rush hour)
- Factors in day of week
- Considers weather/conditions
- Includes place-specific overhead (parking, security)

### 3. Preparation Intelligence
- Event-specific task generation
- Document requirement inference
- Historical pattern learning
- Deadline-aware reminders

### 4. Conflict Resolution Suggestions
- Ranks options by feasibility and impact
- Considers event importance and flexibility
- Suggests practical alternatives

### 5. Schedule Feasibility Scoring
- Holistic view of day's schedule
- Accounts for travel time, prep time, buffer
- Warns about tight transitions
- Identifies risks proactively

## Integration Points

### With Notification Intelligence
- Calendar events linked to appointment reminders
- Single entity: "Doctor Appointment" includes both calendar entry and notification

### With Location Intelligence
- Learns common places (Home, Office, Gym)
- Tracks actual travel times
- Predicts departure needs based on current location

### With Activity Intelligence
- Infers transport mode from activity patterns
- Learns typical travel methods

### With Document System
- Links required documents to events
- Tracks document availability
- Warns about missing/expiring documents

## Future Enhancements

1. **Machine Learning**
   - Learn event duration patterns
   - Predict no-show probability
   - Optimize schedule suggestions

2. **Predictive Rescheduling**
   - Suggest optimal meeting times
   - Auto-detect recurring conflicts
   - Propose schedule improvements

3. **External Integrations**
   - Live traffic data
   - Weather forecasts
   - Public transit schedules

4. **Collaborative Intelligence**
   - Multi-person schedule coordination
   - Meeting room availability
   - Resource booking

## Usage

### Android Integration
```kotlin
// Sync calendar to LifeOS
val calendarEvents = getDeviceCalendarEvents()
api.syncCalendarToContext(calendarEvents)

// Get enriched context
val context = api.getCalendarContext(startTime, endTime)

// Generate interventions
for (event in context.events) {
  if (event.conflicts.isNotEmpty()) {
    showConflictNotification(event)
  }
}
```

### Frontend Integration
```typescript
// Load schedule analysis
const analysis = await fetch('/api/calendar/schedule?startDate=X&endDate=Y')
const { events, dailyAnalysis, summary } = analysis.data

// Display feasibility
const feasibility = dailyAnalysis[0]
console.log(`Schedule feasibility: ${feasibility.score * 100}%`)

// Show conflicts
for (const event of events) {
  if (event.conflicts.length > 0) {
    showConflictWarning(event)
  }
}
```

## Performance Considerations

- Enrichment is asynchronous (doesn't block event ingestion)
- Conflict detection uses efficient windowing
- Historical data is indexed for fast queries
- Confidence scores allow graceful degradation
- Caching for repeated calculations

## Privacy

- All processing happens locally (on-device or self-hosted)
- No calendar data sent to third parties
- Historical patterns stored locally
- User controls all data

---

**Status**: ✅ Fully Implemented
**Version**: 1.0
**Last Updated**: 2026-08-11
