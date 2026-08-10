# Notification Intelligence - Quick Start Guide

## 🚀 5-Minute Setup

### Step 1: Start the Backend

```bash
cd c:\LifeOS
npm install
npm run dev
```

Server starts at: `http://localhost:3001`

### Step 2: Start the Frontend

```bash
cd c:\LifeOS\frontend
npm install
npm run dev
```

Frontend starts at: `http://localhost:5173`

### Step 3: View the Dashboard

Open: `http://localhost:5173/notification-intelligence`

## 📱 Android Integration (For Testing)

### Initialize the Intelligence Engine

```typescript
import { NotificationCollector } from './agent/notification/NotificationCollector';
import { EventDatabase } from './storage/EventDatabase';

// Create database instance
const database = new EventDatabase();

// Initialize collector with Intelligence Engine
const collector = new NotificationCollector({
  enabled: true,
  userId: 'demo_user',
  deviceId: 'demo_device',
  appVersion: '0.3.0',
  filterSystemNotifications: true,
  enableDiagnostics: true, // Enable for testing
}, database);

// Start collecting
await collector.start();
```

### Test with Sample Notification

```typescript
// Simulate a notification
const testNotification = {
  id: 'test_001',
  packageName: 'com.example.bank',
  appName: 'My Bank',
  title: 'Bill Payment',
  text: 'Your electricity bill of ₹2,431 is due on Friday.',
  timestamp: Date.now(),
  priority: 1,
};

// Process with diagnostics
const result = await collector.processDiagnostic(testNotification);

console.log('Pipeline:', result.pipeline);
console.log('Result:', result.result);
```

Expected output:
```json
{
  "normalized": {
    "sourceApp": "com.example.bank",
    "title": "Bill Payment",
    "body": "Your electricity bill of ₹2,431 is due on Friday."
  },
  "classification": {
    "relevance": "RELEVANT",
    "category": "FINANCE",
    "intent": "BILL_DUE",
    "action": "PAY",
    "priority": 0.63,
    "confidence": 0.97
  },
  "extractedData": {
    "amount": { "value": 2431, "currency": "INR" },
    "dueDate": { "value": "2026-08-14" },
    "organization": { "name": "Electricity" }
  },
  "result": {
    "shouldSync": true,
    "event": { ... },
    "structuredEvent": { ... }
  }
}
```

## 🧪 Testing Different Notification Types

### 1. Bill Due

```typescript
{
  title: 'Bill Reminder',
  text: 'Your electricity bill of ₹2,431 is due on Friday.',
}
// → Category: FINANCE, Intent: BILL_DUE, Sync: YES
```

### 2. OTP (Should be Filtered)

```typescript
{
  title: 'Verification Code',
  text: 'Your OTP is 123456. Valid for 5 minutes.',
}
// → Category: AUTHENTICATION, Sync: NO, Reason: "Contains OTP"
```

### 3. Delivery

```typescript
{
  title: 'Package Update',
  text: 'Your Amazon order will arrive tomorrow.',
}
// → Category: DELIVERY, Intent: DELIVERY, Sync: YES
```

### 4. Appointment

```typescript
{
  title: 'Appointment Reminder',
  text: 'Your doctor appointment is on Aug 12 at 3 PM.',
}
// → Category: HEALTH, Intent: APPOINTMENT, Sync: YES
```

### 5. Promotional (Should be Filtered)

```typescript
{
  title: 'Sale Alert',
  text: '50% off on all items. Shop now!',
}
// → Category: PROMOTION, Relevance: IRRELEVANT, Sync: NO
```

## 📊 View Statistics

```typescript
const stats = collector.getStatistics();

console.log('Statistics:', {
  totalProcessed: stats.stats.totalProcessed,
  relevant: stats.stats.relevant,
  filterRate: `${stats.efficiency.filterRate.toFixed(1)}%`,
  syncRate: `${stats.efficiency.syncRate.toFixed(1)}%`,
  avgProcessingTime: `${stats.stats.averageProcessingTime}ms`,
});
```

Output:
```
Statistics: {
  totalProcessed: 347,
  relevant: 89,
  filterRate: '62.3%',
  syncRate: '21.0%',
  avgProcessingTime: '45ms'
}
```

## 🔍 Debug Mode

```typescript
// Enable diagnostic mode
const collector = new NotificationCollector({
  ...config,
  enableDiagnostics: true,
}, database);

// Process with full pipeline visibility
const diagnostic = await collector.processDiagnostic(notification);

// See every stage
console.log('1. Normalized:', diagnostic.pipeline.normalized);
console.log('2. Privacy:', diagnostic.pipeline.privacyClassification);
console.log('3. Classification:', diagnostic.pipeline.classification);
console.log('4. Entities:', diagnostic.pipeline.extractedData);
console.log('5. Event:', diagnostic.pipeline.event);
console.log('6. Decision:', diagnostic.result);
```

## 🔗 Entity Resolution Testing

Test that related notifications are linked:

```typescript
// First notification
await collector.process({
  id: 'notif_1',
  text: 'Electricity bill ₹2,431 due Friday',
  timestamp: Date.now(),
});

// Wait a bit
await new Promise(resolve => setTimeout(resolve, 100));

// Second notification (same bill)
await collector.process({
  id: 'notif_2',
  text: 'Reminder: Electricity bill due tomorrow',
  timestamp: Date.now() + 2 * 24 * 60 * 60 * 1000, // 2 days later
});

// Check entities
const entities = await intelligenceService.getAllEntities();
console.log('Entities:', entities.length); // Should be 1, not 2!

const entity = entities[0];
console.log('Related events:', entity.relatedEvents);
// Should contain both: ['notif_1', 'notif_2']
```

## 📈 Monitor Performance

```typescript
// Every 10 seconds
setInterval(() => {
  const stats = collector.getStatistics();
  
  console.log(`📊 Stats:
    Processed: ${stats.stats.totalProcessed}
    Relevant: ${stats.stats.relevant} (${stats.efficiency.relevanceRate.toFixed(1)}%)
    Synced: ${stats.stats.synced} (${stats.efficiency.syncRate.toFixed(1)}%)
    Filtered: ${stats.efficiency.filterRate.toFixed(1)}%
    Avg time: ${stats.stats.averageProcessingTime.toFixed(0)}ms
  `);
}, 10000);
```

## 🎨 Frontend Features

### View Processing Pipeline
Visit: `/notification-intelligence`

See:
- Real-time processing visualization
- Privacy protection metrics
- Entity resolution cards
- Processing statistics

### View Entity Details
Click on any entity card to see:
- Related notifications
- Linked tasks
- Update history
- Confidence scores

## 🔒 Privacy Testing

Verify sensitive data is protected:

```typescript
const testCases = [
  {
    name: 'OTP',
    text: 'Your OTP is 123456',
    expectSync: false,
    expectLocal: true,
  },
  {
    name: 'Bank Transaction',
    text: 'Account ending 1234 debited ₹5000',
    expectSync: false, // Only sanitized
    expectLocal: true,
  },
  {
    name: 'Bill',
    text: 'Electricity bill ₹2431 due Friday',
    expectSync: true,
    expectLocal: true,
  },
];

for (const test of testCases) {
  const result = await collector.process({
    id: `test_${test.name}`,
    text: test.text,
    timestamp: Date.now(),
  });
  
  console.log(`${test.name}:`, {
    shouldSync: result.shouldSync,
    expected: test.expectSync,
    pass: result.shouldSync === test.expectSync ? '✓' : '✗',
  });
}
```

## 🌐 API Testing

### Test Single Event Submission

```bash
curl -X POST http://localhost:3001/api/notification-intelligence/event \
  -H "Content-Type: application/json" \
  -d '{
    "eventId": "evt_test_001",
    "userId": "demo_user",
    "deviceId": "demo_device",
    "type": "NOTIFICATION",
    "timestamp": "2026-08-11T10:00:00Z",
    "source": {
      "type": "ANDROID",
      "collector": "notification"
    },
    "data": {
      "package": "com.example.bank",
      "title": "Bill Payment",
      "text": "Electricity bill due"
    },
    "metadata": {
      "notificationCategory": "FINANCE",
      "notificationIntent": "BILL_DUE",
      "amount": 2431,
      "currency": "INR",
      "dueDate": "2026-08-14"
    },
    "confidence": 0.97,
    "privacy": {
      "sensitivity": "PRIVATE"
    }
  }'
```

### Test Batch Submission

```bash
curl -X POST http://localhost:3001/api/notification-intelligence/batch \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "demo_device",
    "userId": "demo_user",
    "batchId": "batch_001",
    "timestamp": "2026-08-11T10:00:00Z",
    "events": [
      { ... },
      { ... }
    ]
  }'
```

## ✅ Validation Checklist

- [ ] Backend server running
- [ ] Frontend dashboard accessible
- [ ] Android collector initialized
- [ ] Sample notification processed
- [ ] Statistics displaying
- [ ] Entity resolution working
- [ ] Privacy filters active
- [ ] API endpoints responding

## 🎓 Common Issues

### Issue: "Notification permissions not granted"
**Solution:** Request permissions explicitly in Android app

### Issue: "No candidates found" for entity resolution
**Solution:** Entities expire after 30 days. Process related notifications within time window

### Issue: Processing time > 100ms
**Solution:** Check if diagnostic mode is enabled (adds overhead)

### Issue: All notifications marked irrelevant
**Solution:** Check app registry and keyword lists in classifier

## 📚 Next Steps

1. Read: `NOTIFICATION_INTELLIGENCE.md` for full documentation
2. Read: `NOTIFICATION_INTELLIGENCE_IMPLEMENTATION.md` for architecture
3. Integrate with your Android app
4. Configure privacy policies
5. Train local ML model (Phase 2)

## 🎉 Success Criteria

You'll know it's working when:
- ✓ 500 notifications → 15 meaningful updates
- ✓ OTPs never reach the server
- ✓ Bills automatically create tasks
- ✓ Related notifications link to one entity
- ✓ Processing < 50ms average

---

**You're now running a privacy-first, edge-intelligent notification system! 🚀**
