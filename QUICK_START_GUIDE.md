# LifeOS v0.3 - Quick Start Guide

## 🚀 Get Running in 5 Minutes

This guide gets you from zero to a working Passive Agent system.

---

## Step 1: Start the Backend (2 minutes)

```bash
cd c:\LifeOS

# Install dependencies (first time only)
npm install

# Start the server
npm run dev
```

**Expected output:**
```
🚀 LifeOS API Server running on http://localhost:3001
📊 Health check: http://localhost:3001/api/health
```

**Verify it works:**
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

---

## Step 2: Configure Android App (1 minute)

Edit `lifeos-android/App.tsx` lines 14-16:

```typescript
const CONFIG = {
  userId: 'demo_user',              // Change to your ID
  deviceId: 'demo_device_001',      // Change to unique device ID
  apiBaseUrl: 'http://10.0.2.2:3001',  // ← Use this for Android Emulator
  // OR
  apiBaseUrl: 'http://192.168.1.XXX:3001',  // ← Use your IP for real device
  
  // ... rest stays the same
};
```

**Finding your IP address:**
- Windows: `ipconfig` (look for IPv4)
- Mac/Linux: `ifconfig` or `ip addr`

---

## Step 3: Start Android App (2 minutes)

```bash
cd c:\LifeOS\lifeos-android

# Install dependencies (first time only)
npm install

# Start the app
npm run android  # or npm run ios for iPhone
```

**What happens:**
1. Expo dev server starts
2. App builds and installs on device/emulator
3. Collectors request permissions
4. Device registers with backend
5. Event collection begins!

---

## Step 4: Test the System (5 minutes)

### Test 1: Check Device Registration

In backend terminal, you should see:
```
📱 Device registered: demo_device_001 for user demo_user (Android)
```

Verify via API:
```bash
curl "http://localhost:3001/api/v1/devices/list?userId=demo_user"
```

### Test 2: Generate Some Events

#### Add a Calendar Event
1. Open device calendar
2. Add event: "Test Meeting" 
3. Set time: 30 minutes from now
4. Add location: "Conference Room"
5. Save

Wait 30 seconds, then check backend:
```bash
curl "http://localhost:3001/api/v1/context/events?userId=demo_user&type=CALENDAR_EVENT"
```

#### Simulate Location Change
1. Shake your device (triggers activity change)
2. Or move around (triggers location update)
3. Check backend logs for events

#### Send a Test Notification
In React Native:
```typescript
await Notifications.scheduleNotificationAsync({
  content: {
    title: 'Test',
    body: 'Hello from LifeOS',
  },
  trigger: null,
});
```

### Test 3: Check Context Fusion

After collecting a few events:
```bash
curl "http://localhost:3001/api/v1/life-context/current?userId=demo_user"
```

**Expected response:**
```json
{
  "success": true,
  "data": {
    "context": {
      "contextType": "UPCOMING_MEETING",
      "confidence": 0.85,
      "insights": {
        "description": "Meeting 'Test Meeting' scheduled in 28 minutes",
        "key_signals": [
          "Calendar event in 28 minutes",
          "Location: Conference Room"
        ]
      },
      "recommendations": [
        "Start preparing for your meeting"
      ]
    }
  }
}
```

### Test 4: Wait for Intervention!

If you created a meeting 30 minutes away, **wait 2 minutes**.

The InterventionEngine checks every 2 minutes.

You should receive a notification:
```
📅 Upcoming Meeting
You have a meeting "Test Meeting" in 28 minutes.
Consider checking traffic to Conference Room.
```

**Open the app** → Navigate to "Interventions" tab → See the passive suggestion!

---

## 🎯 Quick Verification Checklist

After 10 minutes of running, verify:

✅ **Backend logs show events**:
```
📊 Event received: CALENDAR_EVENT from demo_device_001
📊 Event received: LOCATION_UPDATE from demo_device_001
📊 Event received: ACTIVITY_CHANGE from demo_device_001
```

✅ **Events are in database**:
```bash
curl "http://localhost:3001/api/v1/context/events?userId=demo_user&limit=10"
# Should return array of events
```

✅ **Context is being fused**:
```bash
curl "http://localhost:3001/api/v1/life-context/current?userId=demo_user"
# Should return a context object
```

✅ **App screens work**:
- "Now" tab shows current context
- "Interventions" tab shows suggestions

✅ **Interventions trigger**:
- Create meeting 25 minutes away
- Wait 2 minutes
- Receive notification

---

## 🐛 Troubleshooting

### Problem: Backend won't start

**Solution:**
```bash
# Check if port 3001 is in use
netstat -ano | findstr :3001

# Kill the process if needed (Windows)
taskkill /PID <PID> /F

# Try again
npm run dev
```

### Problem: Android app won't connect

**Error**: "Network request failed"

**Solutions:**
1. Check `apiBaseUrl` in `App.tsx`
2. For emulator: Use `http://10.0.2.2:3001`
3. For real device: Use your computer's local IP
4. Ensure backend is running
5. Check firewall settings

### Problem: No events showing up

**Check:**
1. Permissions granted in device settings?
2. Collectors running? (Check app logs)
3. Backend receiving requests? (Check backend logs)
4. Network connectivity working?

**Debug:**
```typescript
// In App.tsx, add:
const stats = await pipeline.getStats();
console.log('Pipeline stats:', stats);
```

### Problem: Context not detected

**Possible causes:**
1. Not enough events yet (need 2-3 minimum)
2. Events too old (only looks at last 2 hours)
3. No calendar events to fuse

**Solution:**
Wait 5 minutes after creating calendar event, then check:
```bash
curl "http://localhost:3001/api/v1/life-context/analyze?userId=demo_user&timeWindowMinutes=120"
```

### Problem: Interventions not triggering

**Check:**
1. Meeting must be 5-30 minutes away
2. InterventionEngine must be running
3. Context must be detected
4. Notification permissions granted?

**Debug:**
```typescript
// In App.tsx:
useEffect(() => {
  setInterval(() => {
    const interventions = interventionEngine?.getInterventions();
    console.log('Interventions:', interventions);
  }, 10000);
}, []);
```

---

## 📊 Monitoring

### Watch Backend Logs

Terminal 1:
```bash
cd c:\LifeOS
npm run dev
```

You'll see:
```
📱 Device registered: ...
📊 Event received: CALENDAR_EVENT from ...
📊 Batch received: 5 events from ...
🔄 Duplicate detected: ...
```

### Watch Event Flow

Terminal 2:
```bash
# Watch events in real-time
while ($true) { 
  curl "http://localhost:3001/api/v1/context/events?userId=demo_user&limit=5"
  Start-Sleep -Seconds 10
}
```

### Check Sync Status

```bash
curl "http://localhost:3001/api/v1/context/sync?deviceId=demo_device_001"
```

Returns:
```json
{
  "success": true,
  "data": {
    "pendingEvents": 0,
    "syncedEvents": 127,
    "failedEvents": 0,
    "lastSyncAt": "2026-08-10T..."
  }
}
```

---

## 🎨 Customization

### Change Intervention Thresholds

Edit `lifeos-android/src/services/InterventionEngine.ts` line 93:

```typescript
const DEPARTURE_WARNING_MINUTES = 30;  // Change to 60 for earlier warning
const URGENT_WARNING_MINUTES = 15;     // Change to 10 for later warning
const IMMEDIATE_WARNING_MINUTES = 5;   // Change to 2 for last-minute warning
```

### Add Known Places

Edit `lifeos-android/App.tsx` line 42:

```typescript
knownPlaces: [
  {
    id: 'home',
    type: 'HOME',
    name: 'Home',
    latitude: YOUR_LAT,
    longitude: YOUR_LON,
    radiusMeters: 100,
  },
  {
    id: 'office',
    type: 'WORK',
    name: 'My Office',
    latitude: YOUR_LAT,
    longitude: YOUR_LON,
    radiusMeters: 150,
  },
  {
    id: 'gym',
    type: 'GYM',
    name: 'Fitness Center',
    latitude: YOUR_LAT,
    longitude: YOUR_LON,
    radiusMeters: 80,
  },
],
```

**How to find coordinates:**
1. Open Google Maps
2. Right-click your location
3. Click coordinates to copy

### Adjust Privacy Settings

Edit `lifeos-android/App.tsx` line 21:

```typescript
userPrivacySettings: {
  shareMessaging: true,   // Set to true to sync WhatsApp, Telegram
  shareEmail: true,       // Set to true to sync email content
  shareFinancial: false,  // Keep false - banking should never sync
},
```

### Change Sync Frequency

Edit `lifeos-android/App.tsx` line 60:

```typescript
sync: {
  enabled: true,
  batchSize: 100,           // Increase to reduce network calls
  syncIntervalMs: 180000,   // 3 minutes instead of 5
  retryAttempts: 5,         // More retries
  wifiOnly: true,           // Only sync on wifi
},
```

---

## 🎯 Demo Scenario

Want to see the full system in action? Follow this:

### Setup (Day Before)
1. Start backend
2. Start Android app
3. Grant all permissions
4. Configure HOME location in app

### Morning of Demo
1. **08:00** - Add calendar event: "Important Meeting" at 09:00, Location: "Downtown Office"
2. **08:25** - Leave your home location
3. **08:30** - 📱 **INTERVENTION #1**: "Meeting in 30 minutes - check traffic"
4. **08:40** - Start driving (shake device to simulate)
5. **08:45** - 📱 **INTERVENTION #2**: "Meeting starts in 15 minutes"
6. **08:50** - Check "Now" screen → Should show "TRAVELING_TO_MEETING"
7. **08:55** - 📱 **INTERVENTION #3**: "Meeting starts in 5 minutes - join now"
8. **08:58** - Arrive at office location
9. **09:00** - Check "Now" screen → Should show "AT_WORK"

**Result**: The system understood your morning, predicted your needs, and intervened at the right times - all without you asking!

---

## ✅ Success!

If you've gotten this far, you have:

✅ Backend processing events  
✅ Android collecting context  
✅ Context fusion working  
✅ Interventions triggering  
✅ Complete Passive Agent operational  

---

## 📚 Next Steps

1. **Read**: `ANDROID_INTEGRATION_GUIDE.md` - Deep dive into architecture
2. **Read**: `V0.3_IMPLEMENTATION_SUMMARY.md` - Complete technical summary
3. **Read**: `lifeos-android/README.md` - Android-specific documentation
4. **Experiment**: Try different scenarios and watch the agent learn
5. **Extend**: Add more collectors, interventions, or contexts

---

## 🆘 Still Stuck?

1. Check backend logs for errors
2. Check Android logs in debugger
3. Verify API responses with curl
4. Review event database
5. Check network connectivity

**Common fix**: Restart both backend and Android app, wait 2 minutes for collectors to stabilize.

---

## 🎉 You're Done!

You now have a working **Passive Agent** that continuously understands your life context and provides intelligent interventions.

Welcome to LifeOS v0.3! 🌐
