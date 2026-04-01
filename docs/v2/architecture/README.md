# V2 Architecture Documentation

## Overview

Technical architecture documentation for the IDEA Brand Coach v2 multi-avatar system.

## Documents

### 📐 [Two-Panel Design](./TWO_PANEL_DESIGN.md)
Responsive layout system that adapts between desktop and mobile interfaces.

### 🧠 [Conversation Memory — Semantic Retrieval](./adr/ADR-CONVERSATION-MEMORY.md)
Hybrid semantic + recency context window for Trevor's conversation memory. Replaces sequential history truncation and OpenAI server-side chaining with embedding-based retrieval via pgvector.

### 💰 [AI Cost Analysis](./cost-analysis/AI-COST-ANALYSIS.md)
Complete inventory of all OpenAI API calls, per-message cost breakdown, scale projections, and optimization roadmap. Living document updated as optimizations are applied.

### 💰 [Cost Analysis](./cost-analysis/)
- [AI Cost Analysis](./cost-analysis/AI-COST-ANALYSIS.md) — Complete API call inventory, model pricing (GPT-5 series), and optimization roadmap
- [Beta Cost Projection](./cost-analysis/BETA-COST-PROJECTION.md) — 4-week estimate for 200 beta testers; model swap strategies cut cost from $411 to $89
- [Incident: Cost Spike March 2026](./cost-analysis/INCIDENT-COST-SPIKE-2026-03.md) — Post-mortem on $5+ spike; 61% was unnecessary API calls

### 📦 [Edge Function Versioning](./EDGE-FUNCTION-VERSIONING.md)
Audit and refactoring plan for the four `generate-brand-strategy-*` edge functions. Identifies active v1/v2 paths, dead code, and proposed renames.

### 🏗️ Domain Model (Coming Soon)
Brand → Avatars hierarchy and business logic architecture.

### 💬 Chat System (Coming Soon)
Book-guided conversation flow with field extraction.

### 🔄 Field Sync (Coming Soon)
Manual edit prioritization and real-time synchronization.

### 🗄️ Database Schema (Coming Soon)
Complete database structure for brands, avatars, and metrics.

## Key Architectural Decisions

### Why Two Panels?
- Simpler than three-panel design
- Better mobile experience
- Easier state management
- Cleaner separation of concerns

### Domain-Driven Design
- Clear separation of business logic
- Repository pattern for data access
- Use cases for business operations
- Value objects for data integrity

### Mobile-First Approach
- Bottom sheet for field editing
- Touch-optimized interactions
- Progressive enhancement
- Offline capabilities

## Technology Stack

- **Frontend**: React 18 + TypeScript
- **State**: React Context + Custom Hooks
- **Styling**: Tailwind CSS + shadcn/ui
- **Backend**: Supabase (PostgreSQL + Auth)
- **AI**: OpenAI GPT-4.1 + Supabase pgvector (semantic memory)

## Performance Targets

| Metric | Target | Rationale |
|--------|--------|-----------|
| Panel Toggle | <50ms | Smooth interaction |
| Chat Response | <2s | User expectation |
| Field Save | <500ms | Real-time feel |
| Page Load | <3s | Mobile performance |

## Next Steps

1. Complete Domain Model documentation
2. Document Chat System architecture
3. Detail Field Sync mechanism
4. Finalize Database Schema

---

**Status**: In Development
**Last Updated**: February 28, 2026