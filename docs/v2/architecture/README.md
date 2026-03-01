# V2 Architecture Documentation

## Overview

Technical architecture documentation for the IDEA Brand Coach v2 multi-avatar system.

## Documents

### 📐 [Two-Panel Design](./TWO_PANEL_DESIGN.md)
Responsive layout system that adapts between desktop and mobile interfaces.

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
- **AI**: OpenAI GPT-4 + RAG

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