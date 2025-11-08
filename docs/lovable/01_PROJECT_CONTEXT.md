# Project Context - IDEA Brand Coach

## What We're Building

AI-powered brand consulting SaaS using the IDEA framework:
- **I**dentify: Understand brand current state
- **D**iscover: Explore brand opportunities
- **E**xecute: Implement brand strategy
- **A**nalyze: Measure brand performance

## Tech Stack

**Frontend:** React 18, TypeScript, Vite, Tailwind CSS, shadcn-ui
**Backend:** Supabase (Auth, Database, Edge Functions)
**AI:** GPT-4 with LangChain RAG for personalized brand consulting
**Testing:** Vitest, @testing-library/react (≥85% coverage target)

## Current Status

**P0 Beta Launch:** ~60% complete
**Timeline:** 14 working days to MVP launch
**Focus:** Three core features (Diagnostic, Auth, AI Coach)

## Core User Journey

1. **Anonymous Entry:** User completes 6-question brand diagnostic
2. **Account Creation:** Prompted to create account to save results
3. **Authenticated Experience:** Access to AI Brand Coach with chat interface
4. **Personalized Consulting:** AI provides advice based on diagnostic scores
5. **Document Analysis:** Upload brand docs for deeper insights

## Success Metrics (P0 Launch)

- Complete anonymous diagnostic flow
- Working authentication (email + Google)
- Functional AI Brand Coach with chat history
- ≥85% test coverage for critical paths
- Mobile-responsive on all breakpoints
- Sub-3 second page load times

## What's NOT in P0

Deferred to P1 (post-launch):
- Full IDEA module system (4 deep-dive modules)
- Avatar builder for brand personality
- Advanced analytics dashboard
- Team collaboration features
- Template library for brand assets

## Key Constraints

- Mobile-first design (primary use case)
- WCAG AA accessibility compliance
- Privacy-focused (minimal data collection)
- Fast performance (target: <3s load)
