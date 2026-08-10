# LifeOS Android Passive Agent - Integration Guide

## Overview

This guide explains how to integrate the LifeOS Android Passive Agent (v0.3) with the LifeOS backend and demonstrates the complete end-to-end flow.

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────┐
│                    COMPLETE LIFEOS v0.3                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Android Device                    Backend Server          │
│  ┌─────────────────┐              ┌──────────────────┐    │
│  │  Collectors     │──events──▶   │  Event Ingestion │    │
│  │  - Notification │              │  /api/v1/context │    │
│  │  - Calendar     │              └────────┬─────────┘    │
│  │  - Location     │                       │              │
│  │  - Activity     │              ┌────────▼─────────┐    │
│  └────────┬────────┘              │  Normalization   │    │
│           │                       │  Deduplication   │    │
│  ┌────────▼────────┐              │  Enrichment      │    │
│  │  Privacy Filter │              └────────┬─────────┘    │
│  │  - OTP Block    │                       │              │
│  │  - Redaction    │              ┌────────▼─────────┐    │
│  └────────┬────────┘              │  Context Fusion  │    │
│           │                       │  - Meeting       │    │
│  ┌────────▼────────┐              │  - Commuting     │    │
│  │  Local Storage  │              │  - Location      │    │
│  │  (SQLite)       │              └────────┬─────────┘    │
│  └────────┬────────┘                       │              │
│           │                       ┌────────▼─────────┐    │
│  ┌────────▼────────┐              │  Life Context    │    │
│  │  Sync Manager   │◀──context──  │  API             │    │
│  │  (Batch Upload) │              │  /life-context   │    │
│  └────────┬────────┘              └──────────────────┘    │
│           │                                                │
│  ┌────────▼────────┐                                      │
│  │  Intervention   │                                      │
│  │  Engine         │                                      │
│  │  - Meeting      │                                      │
│  │    Reminder     │                                      │
│  └─────────────────┘                                      │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

## Prerequisites

1. **Backend Server Running**
   ```bash
   cd c:\LifeOS
   npm install
   npm run dev
   ```
   Server should be running on `http://localhost:3001`

2. **Node.js and npm** installed
3. **Expo CLI** (for React Native development)
   ```bash
   npm install -g expo-cli
   ```

## Step 1: Start the Backend

```bash
cd c:\LifeOS
npm run dev
```

Verify backend is running:
```bash
curl http://localhost:3001/api/health
```

Should return:
```json
{
  "status": "ok",
  "timestamp": "2026-08-10T...",
  "service": "LifeOS API"
}
```

## Step 2: Install Android Dependencies

```bash
cd c:\LifeOS\lifeos-android
npm install
```

## Step 3: Configure the Android App

Edit `lifeos-android/App.tsx`:

```typescript
const CONFIG = {
  userId: 'user_001',                    // Your user ID
  deviceId: 'device_android_001',        // Unique device ID
  apiBaseUrl: 'http://10.0.2.2:3001',   // Android emulator localhost
  // OR
  apiBaseUrl: 'http://192.168.1.100:3001', // Real device (use your IP)
  
  // ... rest of config
};
```

**Important**: 
- Android Emulator: Use `http://10.0.2.2:3001` (maps to host's localhost)
- Real Device: Use your computer's local IP address

## Step 4: Run the Android App

```bash
npm run android
```

Or for iOS:
```bash
npm run ios
```

## Step 5: Test the Complete Flow

### Test 1: Device Registration

The app automatically registers the device on startup.

Verify in backend logs:
```
📱 Device registered: device_android_001 for user user_001 (Android)
```

Check registered devices:
```bash
curl "http://localhost:3001/api/v1/devices/list?userId=user_001"
```

### Test 2: Event Collection

#### Simulate a Calendar Event

1. Add an event to your device calendar
2. Set it to start in 30 minutes
3. Wait 30 seconds for the CalendarCollector to sync

Check backend logs:
```
📊 Event received: CALENDAR_EVENT from device_android_001
```

Verify events:
```bash
curl "http://localhost:3001/api/v1/context/events?userId=user_001&limit=10"
```

#### Simulate a Notification

Send a test notification in the app or externally.

Check backend logs:
```
📊 Event received: NOTIFICATION from device_android_001
```

#### Simulate Location Change

Move around (or simulate location in emulator).

Check backend logs:
```
📊 Event received: LOCATION_UPDATE from device_android_001
```

#### Simulate Activity Change

Shake the device or move it.

Check backend logs:
```
📊 Event received: ACTIVITY_CHANGE from device_android_001
```

### Test 3: Context Fusion

After collecting several events, check the fused context:

```bash
curl "http://localhost:3001/api/v1/life-context/current?userId=user_001"
```

Expected response:
```json
{
  "success": true,
  "data": {
    "context": {
      "contextType": "UPCOMING_MEETING",
      "confidence": 0.85,
      "startTime": "2026-08-10T14:30:00Z",
      "insights": {
        "description": "Meeting \"Team Standup\" scheduled in 28 minutes",
        "key_signals": [
          "Calendar event in 28 minutes",
          "Location: Office Building",
          "User is stationary"
        ],
        "confidence_factors": [
          "Meeting location specified"
        ]
      },
      "recommendations": [
        "Consider checking traffic to Office Building"
      ],
      "metadata": {
        "meetingTitle": "Team Standup",
        "minutesUntil": 28,
        "meetingLocation": "Office Building"
      }
    },
    "eventsAnalyzed": 47
  }
}
```

### Test 4: Passive Intervention

The InterventionEngine monitors context every 2 minutes.

When a meeting is detected within 30 minutes, you should receive a notification:

```
📅 Upcoming Meeting
Meeting "Team Standup" starts in 28 minutes. Consider checking traffic to Office Building.
```

Check app's Interventions screen to see the full list.

## Complete Test Scenario

### Scenario: Morning Commute to Meeting

1. **07:45 - User wakes up**
   - Activity: STILL
   - Location: HOME
   - Context: AT_HOME

2. **08:00 - User leaves home**
   - Activity: WALKING → DRIVING
   - Location transition: HOME → TRAVELING
   - Context: COMMUTING

3. **08:15 - Calendar event detected**
   - Event: "Client Meeting" at 09:00
   - Location: "Downtown Office"
   - Context: UPCOMING_MEETING

4. **08:30 - First intervention** ⚡
   ```
   💡 Suggestion
   You have a meeting "Client Meeting" in 30 minutes. 
   Consider checking traffic to Downtown Office.
   ```

5. **08:45 - User still commuting**
   - Activity: DRIVING
   - Location: Moving toward office
   - Context: TRAVELING_TO_MEETING

6. **08:50 - Second intervention** ⚡
   ```
   🔔 Meeting Soon
   Meeting "Client Meeting" starts in 10 minutes. 
   You're currently 5 minutes away.
   ```

7. **08:58 - User arrives**
   - Location transition: TRAVELING → WORK
   - Activity: STILL
   - Context: AT_WORK

8. **09:00 - Meeting starts**
   - No intervention (user is at location)

## API Endpoints Reference

### Device Management
- `POST /api/v1/devices/register` - Register device
- `POST /api/v1/devices/heartbeat` - Update heartbeat
- `GET /api/v1/devices/config` - Get device config
- `GET /api/v1/devices/list` - List user's devices

### Event Ingestion
- `POST /api/v1/context/events` - Single event
- `POST /api/v1/context/events/batch` - Batch upload
- `GET /api/v1/context/events` - Query events
- `GET /api/v1/context/sync` - Sync status

### Context & Interventions
- `GET /api/v1/life-context/current` - Current context
- `GET /api/v1/life-context/analyze` - Analyze contexts
- `GET /api/v1/life-context/timeline` - Context timeline

## Debugging

### Check Collector Status

In the app, add debug output:
```typescript
const stats = await pipeline.getStats();
console.log('Collectors:', stats.collectors);
console.log('Events:', stats.events);
console.log('Sync:', stats.sync);
```

### Check Event Database

```typescript
const db = EventDatabase.getInstance();
const stats = await db.getSyncStats();
console.log('Pending:', stats.pending);
console.log('Synced:', stats.synced);
console.log('Failed:', stats.failed);
```

### Check Backend Events

```bash
# Get all events for user
curl "http://localhost:3001/api/v1/context/events?userId=user_001&limit=100"

# Get events by type
curl "http://localhost:3001/api/v1/context/events?userId=user_001&type=CALENDAR_EVENT"

# Get events in time range
curl "http://localhost:3001/api/v1/context/events?userId=user_001&startTime=2026-08-10T00:00:00Z"
```

### Check Sync Status

```bash
curl "http://localhost:3001/api/v1/context/sync?deviceId=device_android_001"
```

## Troubleshooting

### Events Not Syncing

1. Check network connectivity
2. Verify apiBaseUrl is correct
3. Check backend logs for errors
4. Verify device is registered:
   ```bash
   curl "http://localhost:3001/api/v1/devices/list?userId=user_001"
   ```

### Permissions Denied

- Ensure all permissions are granted in device settings
- Check collector logs for permission errors

### No Context Detected

- Need at least 2-3 events for context fusion
- Wait 1-2 minutes after first events
- Check that collectors are running

### Interventions Not Triggering

- Ensure InterventionEngine is started
- Check context is being detected
- Verify meeting is within intervention thresholds (30 minutes)

## Performance Considerations

### Battery Optimization

- Location updates: Every 50m or 1 minute
- Calendar sync: Every 30 minutes
- Activity detection: 10-second windows
- Context check: Every 2 minutes
- Event sync: Every 5 minutes (batched)

### Network Optimization

- Batch size: 50-100 events
- Compression: Events are JSON (consider gzip)
- Retry logic: Exponential backoff
- Wifi-only mode: Available in config

### Storage Management

- Local DB auto-cleanup: 7 days (configurable)
- Event retention: User-configurable
- Old interventions: Cleared after 7 days

## Security Considerations

1. **Privacy Filter**: Always processes notifications locally first
2. **OTP Detection**: Regex patterns block 4-8 digit codes
3. **Sensitive Categories**: Banking, healthcare get automatic redaction
4. **User Control**: Granular settings per category
5. **Encryption**: Local database should be encrypted (add SQLCipher)
6. **HTTPS**: Use HTTPS in production
7. **Authentication**: Add JWT tokens for API calls

## Production Deployment

### Backend

1. Deploy to cloud (AWS, GCP, Azure)
2. Enable HTTPS
3. Add authentication (JWT)
4. Set up database (PostgreSQL)
5. Enable monitoring (Sentry, LogRocket)

### Android

1. Build APK/AAB:
   ```bash
   expo build:android
   ```
2. Submit to Google Play
3. Configure push notifications
4. Set up crash reporting

## Next Steps

1. **Test with real data** - Use the app for a full day
2. **Tune intervention thresholds** - Adjust timing for your preferences
3. **Add more places** - Configure HOME, WORK, GYM locations
4. **Privacy settings** - Configure what to share
5. **Extend collectors** - Add contacts, app usage, etc.

## Success Metrics

The system is working correctly when:

✅ Events appear in backend within 5 minutes
✅ Context fusion detects meaningful life situations
✅ Interventions arrive at appropriate times
✅ No sensitive data (OTPs, banking) reaches backend
✅ Battery drain is acceptable (< 5% per hour)
✅ Works offline and syncs when reconnected

## Support

For issues, check:
1. Backend logs: `npm run dev`
2. Android logs: React Native debugger
3. API responses: Browser network tab or curl
4. Event database: Debug output in app

## Conclusion

You now have a complete **Passive Agent** that:
- Continuously observes life context
- Filters sensitive data locally
- Syncs intelligently to backend
- Derives meaningful contexts through fusion
- Provides passive interventions without being asked

This is the foundation of LifeOS v0.3 - a system that truly understands your life.
