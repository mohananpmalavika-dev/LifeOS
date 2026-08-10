# LifeOS Android Passive Agent (v0.3)

The **sensory layer** of LifeOS - continuously observes context from Android device and feeds it to LifeOS Core for reasoning and intervention.

## Architecture

```
REAL HUMAN LIFE
       │
       ▼
┌────────────────────────┐
│ LIFEOS ANDROID AGENT   │
│                        │
│ Notification ────────┐ │
│ Calendar      ───────┤ │
│ Location      ───────┤ │
│ Activity      ───────┘ │
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│ LOCAL PIPELINE         │
│                        │
│ Normalize              │
│ Privacy Filter         │
│ Local Storage (SQLite) │
│ Offline Queue          │
└───────────┬────────────┘
            │
      encrypted events
            │
            ▼
┌────────────────────────┐
│ LIFEOS CORE (Backend)  │
│                        │
│ Event Normalization    │
│ Deduplication          │
│ Context Fusion         │
│ Reasoning Engine       │
│ Decision Engine        │
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│ INTERVENTION           │
│                        │
│ Meeting reminders      │
│ Departure suggestions  │
│ Context-aware alerts   │
└────────────────────────┘
```

## Core Components

### 1. Collectors (Sensory Layer)

#### NotificationCollector
- Monitors Android notifications
- **Privacy-first**: Filters OTPs, banking, healthcare
- Redacts sensitive content before sync
- Categories: MESSAGING, EMAIL, FINANCIAL, AUTHENTICATION

```typescript
// Privacy classification example
OTP detected → CRITICAL → Never leaves device
Banking → SENSITIVE → Category only, no content
WhatsApp → PRIVATE → User-configurable
System → PUBLIC → Safe to sync
```

#### CalendarCollector
- Syncs upcoming calendar events (configurable look-ahead)
- Detects meetings, appointments
- Provides **future context** (what user has planned)
- Checks every 30 minutes by default

#### LocationCollector
- Smart sampling (battery-aware)
- Place detection: HOME, WORK, GYM, etc.
- Semantic transitions: LEFT_HOME, ARRIVED_AT_WORK
- Haversine distance calculations

#### ActivityCollector
- Uses device accelerometer
- Detects: STILL, WALKING, RUNNING, DRIVING, IN_VEHICLE
- Confidence-based classification
- 10-second rolling window analysis

### 2. Local Pipeline

#### EventDatabase (SQLite)
- Stores events before sync
- Tracks sync status: PENDING, SYNCING, SYNCED, FAILED
- Retry logic with exponential backoff
- Auto-cleanup of old synced events

#### SyncManager
- Batch uploads (50-100 events at a time)
- Network-aware (wifi-only option)
- Offline queue (works without internet)
- Automatic retry with delays: 5s → 30s → 2m → 10m

#### PrivacyFilter
- Classifies notification sensitivity
- Detects OTP patterns: `/\b\d{4,8}\b/`
- Redacts content based on classification
- User-configurable privacy settings

### 3. Context & Interventions

#### ContextService
- Fetches fused contexts from backend
- Endpoints: `/current`, `/analyze`, `/timeline`
- Real-time context updates

#### InterventionEngine
- **THE KEY FEATURE**: Passive interventions
- Monitors context every 2 minutes
- First intervention: **Meeting Departure Reminder**

```typescript
// Meeting intervention logic
30 min before → "Consider checking traffic"
15 min before → "Time to leave soon"
5 min before → "Join now or leave immediately"

Factors:
- Meeting start time
- Current location
- User activity (still vs moving)
- Meeting location
```

### 4. UI Screens

#### Now Screen
- Real-time life context display
- Shows: What's happening, detected signals, suggestions
- Refreshes every 30 seconds
- Context emoji indicators

#### Interventions Screen
- List of passive suggestions
- Priority levels: URGENT, HIGH, MEDIUM, LOW
- Acknowledgment tracking
- Context information for each intervention

## Installation

```bash
cd lifeos-android
npm install

# iOS
npm run ios

# Android
npm run android
```

## Configuration

Edit `App.tsx` to configure:

```typescript
const CONFIG = {
  userId: 'your_user_id',
  deviceId: 'your_device_id',
  apiBaseUrl: 'http://your-backend-url:3001',
  
  collectors: {
    notification: {
      enabled: true,
      userPrivacySettings: {
        shareMessaging: false,   // WhatsApp, Telegram
        shareEmail: false,       // Gmail, Outlook
        shareFinancial: false,   // Banking apps
      },
    },
    calendar: {
      enabled: true,
      lookAheadHours: 48,        // Look 2 days ahead
    },
    location: {
      enabled: true,
      knownPlaces: [             // Define your places
        {
          id: 'home',
          type: 'HOME',
          latitude: 8.8932,
          longitude: 76.6141,
          radiusMeters: 100,
        },
      ],
    },
    activity: {
      enabled: true,
      confidenceThreshold: 0.6,   // 60% confidence minimum
    },
  },
  
  sync: {
    enabled: true,
    batchSize: 50,
    syncIntervalMs: 300000,       // 5 minutes
    wifiOnly: false,
  },
};
```

## Permissions Required

- **Notifications**: `expo-notifications`
- **Calendar**: `expo-calendar`
- **Location**: `expo-location` (foreground)
- **Motion**: `expo-sensors` (no permission needed)

## Key Features

### Privacy-First Design

1. **Local Processing**: OTPs and critical data never leave device
2. **User Control**: Granular privacy settings per category
3. **Redaction**: Sensitive content redacted before sync
4. **Encryption**: Local database encrypted
5. **Retention**: Auto-delete old events

### Battery Optimization

1. **Smart Sampling**: Location updates only on significant movement
2. **Batch Sync**: Upload 50+ events at once
3. **Wifi-Only Option**: Wait for wifi to sync
4. **Interval-Based**: No continuous polling

### Offline Support

1. **Local Queue**: Events stored in SQLite
2. **Sync on Connect**: Automatic upload when online
3. **Retry Logic**: Exponential backoff for failed uploads
4. **No Data Loss**: Events persist until synced

## Event Flow Example

```
User gets notification → NotificationCollector
                      ↓
             Privacy classification
                      ↓
        "WhatsApp from John" → PRIVATE
                      ↓
              EventFactory creates LifeEvent
                      ↓
              Store in local SQLite
                      ↓
              Queue for sync (PENDING)
                      ↓
              SyncManager batches 50 events
                      ↓
              POST /api/v1/context/events/batch
                      ↓
              Backend normalizes & deduplicates
                      ↓
              Mark as SYNCED in local DB
                      ↓
              Context Fusion Engine analyzes
                      ↓
              Detects: UPCOMING_MEETING
                      ↓
              InterventionEngine triggers
                      ↓
              "Meeting starts in 15 minutes"
```

## Testing

### Test Notification Collector
```typescript
// Send a test notification
await Notifications.scheduleNotificationAsync({
  content: {
    title: 'Test Meeting',
    body: 'Meeting at 3 PM',
  },
  trigger: null,
});
```

### Test Context Fusion
```typescript
// Check current context
const context = await contextService.getCurrentContext();
console.log(context.contextType);
console.log(context.insights.description);
```

### Test Interventions
```typescript
// View recent interventions
const interventions = interventionEngine.getInterventions();
console.log(interventions);
```

## Backend Integration

Ensure backend is running:

```bash
cd ../
npm install
npm run dev
```

Backend endpoints used:
- `POST /api/v1/devices/register` - Device registration
- `POST /api/v1/context/events/batch` - Event upload
- `GET /api/v1/life-context/current` - Current context
- `GET /api/v1/life-context/analyze` - Context analysis

## Future Enhancements (v0.4+)

- [ ] Contacts collector
- [ ] App usage collector
- [ ] Bluetooth proximity detection
- [ ] Voice/microphone collector
- [ ] Camera/visual context
- [ ] More sophisticated ML models for activity recognition
- [ ] Multi-device context fusion
- [ ] Background execution optimization
- [ ] More intervention types

## Architecture Principles

1. **Android = Sensory Layer, Not Brain**
   - Don't do reasoning on device
   - Send observations to backend
   - Let LifeOS Core interpret

2. **Privacy is Non-Negotiable**
   - Filter first, sync later
   - User controls everything
   - Transparent data handling

3. **Work Offline, Sync When Possible**
   - Local-first architecture
   - Queue everything
   - Resilient to network issues

4. **Battery Matters**
   - Smart sampling
   - Batch operations
   - Configurable intervals

## License

Part of LifeOS - Your Life, Understood.
