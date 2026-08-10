# LifeOS Passive Context Engine

**v0.2 - Relationship-Based Intelligence** 🎯

A privacy-first context engine that understands real-world situations through multi-event reasoning, not keyword matching.

## Vision

LifeOS observes digital signals, builds a semantic context graph, and surfaces intelligent interventions at exactly the right moment—before you ask.

## Current Status

✅ **Working Context Engine** with relationship-based reasoning  
✅ **96% context accuracy** across 50 real-world scenarios  
✅ **100% intervention precision** (zero false positives)  
✅ **Multi-hop graph reasoning** replacing keyword heuristics  
⚠️ **57.5% recall** - being conservative, needs tuning  

See [BENCHMARK_RESULTS.md](./BENCHMARK_RESULTS.md) for detailed analysis.

## What It Does

**Input:**  
```
Message: "Mom's hospital appointment is tomorrow at 4"
Message: "Don't forget the insurance papers"  
Location: User leaving home
```

**Output:**  
```
Intervention: "Before you leave for Mom's appointment at hospital, 
              take insurance papers."
Confidence: 95%
```

LifeOS connected three independent events through semantic relationships, detected dependencies, and triggered intervention at the perfect moment.

## Core Capabilities

- ✅ **Passive ingestion** - notifications, calendar, location, documents, voice
- ✅ **Entity extraction** - people, places, documents, appointments, requirements
- ✅ **Temporal reasoning** - "tomorrow", "next Monday", "before leaving"
- ✅ **Persistent context graph** - SQLite-backed relationship store
- ✅ **Multi-hop reasoning** - discovers connections up to 3 relationship hops
- ✅ **Dependency detection** - appointments → documents, events → locations
- ✅ **Decision engine** - context-aware intervention scoring
- ✅ **50-scenario test harness** - automated benchmark across 9 life categories

## Project Structure

### Core Engine
- `src/types.ts` — domain models and type definitions
- `src/engine.ts` — main context processing pipeline
- `src/context-engine.ts` — semantic graph with relationship queries
- `src/entity-extractor.ts` — NER and structured entity extraction
- `src/entity-resolution.ts` — semantic entity linking across events
- `src/temporal.ts` — temporal expression parsing
- `src/reasoning-engine.ts` — 5-level context analysis with multi-hop traversal
- `src/context-reasoner.ts` — cross-event dependency detection
- `src/decision-engine.ts` — intervention confidence scoring

### Intelligence Layer
- `src/ingestion.ts` — event normalization pipeline
- `src/state-engine.ts` — sensor state management
- `src/intervention-layer.ts` — action surface generation
- `src/ner.ts` — named entity recognition
- `src/slm.ts` — lightweight on-device language model stub
- `src/ocr.ts` / `src/stt.ts` — document and voice processing

### Testing & Benchmarking
- `src/test-harness.ts` — professional benchmark runner
- `src/scenario-tests.ts` — 50 real-world test scenarios
- `BENCHMARK_RESULTS.md` — detailed performance analysis

### Supporting Systems
- `src/persistence.ts` — SQLite graph persistence
- `src/vector-store.ts` — semantic similarity search
- `src/privacy.ts` — encryption and data minimization
- `src/event-bus.ts` — event routing

## Getting Started

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run benchmark
node dist/test-harness.js
```

## Architecture

```
┌─────────────────────────────────────────────┐
│  Raw Signals                                │
│  (messages, calendar, location, documents)  │
└──────────────────┬──────────────────────────┘
                   ↓
┌─────────────────────────────────────────────┐
│  Ingestion & Normalization                  │
│  • Entity extraction (NER)                  │
│  • Temporal resolution                      │
│  • Structured parsing                       │
└──────────────────┬──────────────────────────┘
                   ↓
┌─────────────────────────────────────────────┐
│  Entity Resolution                          │
│  • Person/place/document linking            │
│  • Appointment detection                    │
│  • Requirement attachment                   │
└──────────────────┬──────────────────────────┘
                   ↓
┌─────────────────────────────────────────────┐
│  Context Graph (Persistent)                 │
│  • Semantic entities                        │
│  • Typed relationships                      │
│  • Multi-hop queries                        │
└──────────────────┬──────────────────────────┘
                   ↓
┌─────────────────────────────────────────────┐
│  Cross-Event Reasoning                      │
│  • Multi-hop traversal (3 hops)             │
│  • Semantic similarity                      │
│  • Dependency detection                     │
│  • Temporal proximity                       │
│  • Location inference                       │
└──────────────────┬──────────────────────────┘
                   ↓
┌─────────────────────────────────────────────┐
│  Decision Engine                            │
│  • Confidence scoring                       │
│  • Importance/urgency/actionability         │
│  • Interruptibility checks                  │
└──────────────────┬──────────────────────────┘
                   ↓
┌─────────────────────────────────────────────┐
│  Intervention                               │
│  (notification, widget, draft, haptic)      │
└─────────────────────────────────────────────┘
```

## Roadmap

### ✅ v0.1 - Core Architecture (Completed)
- Event ingestion pipeline
- Basic entity extraction
- Context graph foundation
- Persistence layer
- Test harness

### ✅ v0.2 - Relationship Intelligence (Current)
- Multi-hop graph reasoning
- Semantic entity resolution
- Cross-event dependency detection
- 50-scenario benchmark
- 100% precision, 96% context accuracy

### 🎯 v0.3 - Android Passive Agent (Next)
- Android background service
- Real notification/calendar/location signals
- Encrypted context API
- On-device processing
- 10-user pilot preparation

### 🔮 v0.4 - Privacy Hardening
- On-device AI models
- Zero-knowledge cloud vault
- Differential privacy
- User data controls

### 🚀 v0.5 - Real-World Pilot
- 10 real users, 30 days
- Intervention usefulness metrics
- Model refinement
- UX optimization

### 🎉 v1.0 - LifeOS MVP
- Production-ready context engine
- Multi-device sync
- Plugin architecture
- Public beta

## Key Innovations

1. **Relationship-based reasoning** - No hardcoded patterns, pure graph intelligence
2. **Multi-hop inference** - Discovers connections 3 degrees apart
3. **Zero false positives** - 100% precision in interventions
4. **Temporal-aware** - Understands "tomorrow", "before leaving", time proximity
5. **Privacy-first** - Local processing, encrypted persistence, no cloud dependency

## Why This Matters

Traditional assistants require prompts. LifeOS **understands context passively**.

```
Old way:
  User: "Remind me to take insurance papers"
  Assistant: "Ok, when?"
  User: "When I leave for Mom's appointment"
  Assistant: "When is that?"
  User: "Tomorrow at 4"

LifeOS way:
  [You receive]: "Mom's appointment tomorrow at 4"
  [You receive]: "Don't forget insurance papers"  
  [You start leaving]
  [LifeOS]: "Take insurance papers for Mom's appointment"
```

**No prompts. Just intelligence.**

## Contributing

This is a research prototype demonstrating passive context intelligence. Focus areas:

1. **Improve recall** - Current 57.5%, target 75%+ without sacrificing precision
2. **Android agent** - Real-world signal integration
3. **Entity extraction** - Better document/requirement detection
4. **Temporal reasoning** - More sophisticated time-based interventions

## License

MIT
