# LifeOS Full-Stack Application

A complete full-stack implementation of LifeOS with:
- **Backend**: Express.js REST API with TypeScript
- **Frontend**: React + TypeScript + Vite with dark-themed UI
- **Integration**: Complete integration with existing LifeOS context engine

## 🏗️ Architecture

```
LifeOS/
├── src/                          # Core engine (existing)
│   ├── engine.ts                # Context engine
│   ├── context-engine.ts        # Graph management
│   ├── reasoning-engine.ts      # Inference & scoring
│   └── api/                     # NEW: Backend API
│       ├── server.ts            # Express server
│       ├── index.ts             # API entry point
│       ├── services/            
│       │   └── lifeos-service.ts # Service layer wrapping engine
│       └── routes/              # API routes
│           ├── interventions.ts # Intervention management
│           ├── timeline.ts      # Event timeline
│           ├── context.ts       # Context graph
│           ├── tasks.ts         # Derived tasks
│           ├── entities.ts      # Entity management
│           ├── insights.ts      # Metrics & analytics
│           ├── events.ts        # Event processing
│           └── state.ts         # Sensor state
│
└── frontend/                    # NEW: React frontend
    ├── src/
    │   ├── App.tsx              # Main app with routing
    │   ├── services/api.ts      # API client
    │   ├── components/          
    │   │   └── Layout.tsx       # Layout with sidebar
    │   └── pages/               # Screen implementations
    │       ├── Home.tsx         # Intervention-first home screen
    │       ├── Timeline.tsx     # Day reconstruction
    │       ├── Interventions.tsx# Detailed intervention cards
    │       ├── ContextGraph.tsx # Graph visualization (placeholder)
    │       ├── Tasks.tsx        # Auto-generated tasks (placeholder)
    │       ├── Insights.tsx     # Engine metrics dashboard
    │       ├── People.tsx       # People entities (placeholder)
    │       ├── Places.tsx       # Location entities (placeholder)
    │       ├── Documents.tsx    # Document entities (placeholder)
    │       ├── Privacy.tsx      # Privacy center (placeholder)
    │       └── Settings.tsx     # Settings (placeholder)
    └── index.html
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Backend Setup

1. **Install dependencies** (already done):
   ```bash
   npm install
   ```

2. **Build the TypeScript code**:
   ```bash
   npm run build
   ```

3. **Start the API server**:
   ```bash
   npm run start:api
   ```

   The API server will run on `http://localhost:3001`

### Frontend Setup

1. **Navigate to frontend directory**:
   ```bash
   cd frontend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the development server**:
   ```bash
   npm run dev
   ```

   The frontend will run on `http://localhost:5173`

### Running Both Together

**Terminal 1 - Backend**:
```bash
npm run start:api
```

**Terminal 2 - Frontend**:
```bash
cd frontend
npm run dev
```

Then open `http://localhost:5173` in your browser.

## 📡 API Endpoints

### Interventions
- `GET /api/interventions` - Get all interventions (with optional priority filter)
- `GET /api/interventions/:id` - Get specific intervention
- `DELETE /api/interventions/:id` - Dismiss intervention
- `POST /api/interventions/:id/snooze` - Snooze intervention

### Timeline
- `GET /api/timeline` - Get timeline events (with date filters)
- `GET /api/timeline/today` - Get today's events
- `GET /api/timeline/week` - Get this week's events

### Context Graph
- `GET /api/context/graph` - Get entire context graph
- `GET /api/context/graph/:entityId` - Get entity with relationships
- `GET /api/context/relations` - Get filtered relations

### Tasks
- `GET /api/tasks` - Get all derived tasks
- `GET /api/tasks/high-priority` - Get high-priority tasks

### Entities
- `GET /api/entities` - Get entities (with type/search filters)
- `GET /api/entities/people` - Get all people
- `GET /api/entities/places` - Get all places
- `GET /api/entities/documents` - Get all documents
- `GET /api/entities/events` - Get all events
- `GET /api/entities/:id` - Get specific entity

### Insights
- `GET /api/insights` - Get all metrics and analytics
- `GET /api/insights/metrics` - Get performance metrics only
- `GET /api/insights/distributions` - Get entity/relation distributions

### Events
- `POST /api/events` - Process a new event (synchronous)
- `POST /api/events/publish` - Publish event to bus (asynchronous)

### State
- `GET /api/state` - Get current sensor state
- `PUT /api/state` - Update sensor state
- `PATCH /api/state` - Partial sensor state update

## 🎨 UI Screens

### ✅ Implemented

1. **Home / Now** (`/`)
   - Primary intervention card with high confidence score
   - Sensor state indicators (battery, focus, location)
   - High-priority tasks quick view
   - Recent activity timeline
   - **Purpose**: Answer "What do I need to know or do right now?"

2. **Timeline** (`/timeline`)
   - Automatic day reconstruction from events
   - Grouped by date with visual timeline track
   - Event cards with confidence scores
   - Filter by today/week/all
   - Shows which events triggered interventions

3. **Interventions** (`/interventions`)
   - Grid of intervention cards with detailed reasoning
   - Priority filtering (high/medium/low)
   - Action surfaces display
   - Dismiss and snooze functionality
   - Shows "why am I seeing this?" explanation

4. **Insights** (`/insights`)
   - **96% context accuracy** (from benchmark)
   - **100% precision, 57.5% recall**
   - F1 score and performance metrics
   - Entity and relation distributions
   - Intervention analytics
   - Real-time system statistics

### 🚧 Placeholders (Ready for Implementation)

5. **Context Graph** (`/context`) - Interactive graph visualization
6. **Tasks** (`/tasks`) - Auto-generated task list with priorities
7. **People** (`/people`) - People entities and relationships
8. **Places** (`/places`) - Location-aware context
9. **Documents** (`/documents`) - OCR'd documents and files
10. **Privacy Center** (`/privacy`) - Data transparency dashboard
11. **Settings** (`/settings`) - Sensor and interruption preferences

## 🎯 Key Features

### Backend
- ✅ Express.js REST API with TypeScript
- ✅ Complete integration with LifeOS engine
- ✅ Singleton service pattern for engine access
- ✅ Consistent JSON response format
- ✅ CORS enabled for frontend
- ✅ Error handling middleware
- ✅ Real-time event processing via event bus

### Frontend
- ✅ React 18 with TypeScript
- ✅ Vite for fast development
- ✅ React Router for navigation
- ✅ Dark theme matching design spec
- ✅ Responsive layouts
- ✅ Collapsible sidebar navigation
- ✅ Axios API client with interceptors
- ✅ Loading states and skeletons
- ✅ Empty state handling

## 🎨 Design System

The UI follows the LifeOS design specification:

### Color Palette
- **Background**: `#0a0e1a` (primary), `#141824` (secondary)
- **Cards**: `#1e2330` with `#2d3548` borders
- **Accent**: `#6366f1` (primary), `#8b5cf6` (secondary)
- **Status**: Success `#10b981`, Warning `#f59e0b`, Danger `#ef4444`

### Typography
- System fonts: -apple-system, Segoe UI, Roboto
- Dark theme optimized
- Information-dense but readable

### Components
- Intervention cards with confidence scores
- Timeline visualization with event dots and lines
- Metric cards with color-coded priorities
- Distribution bars and charts

## 📊 Engine Metrics (from BENCHMARK_RESULTS.md)

The Insights dashboard displays real metrics from the engine:

| Metric | Value | Description |
|--------|-------|-------------|
| **Context Accuracy** | 96% | Overall system accuracy |
| **Precision** | 100% | No false positives |
| **Recall** | 57.5% | Can be improved |
| **F1 Score** | 73.0% | Harmonic mean |

## 🔮 Next Steps

### Priority Implementations

1. **Context Graph Visualization**
   - Interactive force-directed graph
   - Entity filtering and search
   - Relationship exploration
   - Multi-hop path visualization

2. **Tasks Screen**
   - List of derived tasks with context
   - Priority sorting and filtering
   - Due date indicators
   - Mark complete / dismiss

3. **Entity Screens (People, Places, Documents)**
   - Entity cards with properties
   - Related entities and relationships
   - Timeline of interactions
   - Context-aware insights

4. **Privacy Center**
   - Data storage overview (local vs cloud)
   - Encryption status
   - Data retention policies
   - Export/delete controls

5. **Settings**
   - Sensor configuration
   - Interruption preferences
   - Notification settings
   - Threshold adjustments

### Mobile Development

The next phase should include:
- **Android app** using React Native or native Kotlin
- **iOS app** using React Native or native Swift
- Real mobile sensors integration
- Push notifications for interventions
- Background context processing

## 🤝 Contributing

This is a prototype. To extend:

1. **Add new API endpoints**: Create route files in `src/api/routes/`
2. **Add new screens**: Create components in `frontend/src/pages/`
3. **Extend the engine**: Modify core files in `src/`
4. **Add new entity types**: Update `types.ts` and entity resolution
5. **Improve UI**: Enhance components and styling

## 📝 Environment Variables

Create `.env` in the root:

```env
PORT=3001
CLIENT_URL=http://localhost:5173
NODE_ENV=development
```

## 🐛 Known Issues

1. Frontend npm install may take time - be patient or install packages individually
2. Hot reload works but full page refresh may be needed for some changes
3. Some placeholder screens need full implementation
4. Graph visualization requires additional libraries (D3.js, vis.js, etc.)

## 📚 Technology Stack

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: SQLite (via sql.js)
- **Architecture**: REST API

### Frontend
- **Framework**: React 18
- **Language**: TypeScript
- **Build Tool**: Vite
- **Routing**: React Router v6
- **HTTP Client**: Axios
- **Icons**: Lucide React
- **Styling**: CSS3 with CSS Variables

### Core Engine (Existing)
- Context graph with entities and relations
- Multi-hop reasoning engine
- Confidence scoring and intervention logic
- Vector embeddings for semantic search
- Event bus for async processing

## 🎉 Status

**Backend**: ✅ Complete and functional
**Frontend**: ✅ 4 screens implemented, 7 placeholders ready
**Integration**: ✅ Full API integration working
**Testing**: ⏳ Ready for manual testing
**Production**: ⏳ Development phase

---

Built with ❤️ for ambient intelligence
