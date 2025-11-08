# IDEA Brand Coach - Technical Documentation

## Overview

IDEA Brand Coach is a comprehensive web application that implements the IDEA Strategic Brand Framework™ to help businesses build emotionally resonant brands through data-driven insights and AI-powered guidance. The platform combines strategic brand consulting methodologies with modern web technologies and artificial intelligence to deliver a scalable, interactive brand-building experience.

## Technology Stack

### Frontend
- **React 18.3.1** - Modern UI library with hooks and concurrent rendering
- **TypeScript 5.5.3** - Type-safe JavaScript for enhanced developer experience
- **Vite 5.4.1** - Next-generation frontend build tool with HMR
- **React Router 6.26.2** - Client-side routing and navigation
- **shadcn/ui** - Accessible, customizable component library built on Radix UI
- **Tailwind CSS 3.4.11** - Utility-first CSS framework
- **Tailwind Typography** - Beautiful typographic defaults
- **TanStack Query 5.56.2** - Powerful data synchronization and caching
- **React Hook Form 7.53.0** - Performant form validation
- **Zod 3.23.8** - TypeScript-first schema validation
- **Recharts 2.12.7** - Composable charting library
- **jsPDF 3.0.1** - Client-side PDF generation
- **Lucide React** - Beautiful, consistent icon library

### Backend
- **Supabase** - Backend-as-a-Service platform
  - PostgreSQL 12.2.12 - Relational database
  - Edge Functions (Deno runtime) - Serverless API endpoints
  - Authentication - User management and auth flows
  - Storage - Document and file management
  - Real-time subscriptions - Live data updates

### AI Integration
- **OpenAI API** - GPT-4o-mini and GPT-4.1 models
  - Brand strategy consultation
  - Buyer intent analysis
  - Contextual guidance
  - Content suggestions
- **Anthropic Claude API** - Claude 3 Haiku
  - Contextual help system
  - Diagnostic assistance
- **Hugging Face Transformers 3.7.1** - Browser-based ML models
  - Client-side image processing

### Email & Notifications
- **Resend 2.0.0** - Transactional email service
  - Diagnostic results delivery
  - Framework submission confirmations

### Development Tools
- **ESLint** - Code quality and style enforcement
- **TypeScript ESLint** - TypeScript-specific linting rules
- **Lovable Tagger** - Component tagging for the Lovable platform

## Project Structure

```
idea-brand-coach/
├── src/
│   ├── components/           # React components
│   │   ├── ui/              # shadcn/ui base components (50+ components)
│   │   ├── research/        # Research tools (SurveyBuilder, ReviewAnalyzer)
│   │   ├── AIAssistant.tsx
│   │   ├── BuyerIntentResearch.tsx
│   │   ├── ContextualHelp.tsx
│   │   └── ... (30+ feature components)
│   ├── contexts/            # React Context providers
│   │   └── BrandContext.tsx # Global brand state management
│   ├── hooks/               # Custom React hooks
│   │   ├── useAuth.tsx      # Authentication hook
│   │   ├── useBetaMode.tsx  # Beta feature flags
│   │   └── use-mobile.tsx   # Responsive design hook
│   ├── pages/               # Route components
│   │   ├── IdeaInsight.tsx
│   │   ├── IdeaDistinctive.tsx
│   │   ├── IdeaEmpathy.tsx
│   │   ├── IdeaAuthenticity.tsx
│   │   ├── AvatarBuilder.tsx
│   │   ├── BrandCanvas.tsx
│   │   └── ... (15+ pages)
│   ├── integrations/        # Third-party integrations
│   │   └── supabase/
│   │       ├── client.ts    # Supabase client configuration
│   │       └── types.ts     # Database type definitions
│   ├── lib/                 # Utility libraries
│   │   └── utils.ts         # Helper functions
│   ├── utils/               # Application utilities
│   │   └── backgroundRemoval.ts
│   ├── App.tsx              # Application root with routing
│   └── main.tsx             # Application entry point
├── supabase/
│   ├── functions/           # Edge Functions (9 serverless APIs)
│   │   ├── buyer-intent-analyzer/
│   │   ├── brand-ai-assistant/
│   │   ├── idea-framework-consultant/
│   │   ├── ai-insight-guidance/
│   │   ├── contextual-help/
│   │   ├── document-processor/
│   │   ├── save-beta-tester/
│   │   ├── save-beta-feedback/
│   │   └── send-framework-email/
│   └── migrations/          # Database schema migrations
├── public/                  # Static assets
└── Configuration files
    ├── vite.config.ts
    ├── tsconfig.json
    ├── tailwind.config.ts
    └── package.json
```

## Core Architecture

### IDEA Strategic Brand Framework™

The application is built around four core pillars:

1. **Insight-Driven** - Deep customer understanding through behavioral psychology
   - Buyer intent analysis
   - Customer motivation mapping
   - Emotional trigger identification

2. **Distinctive** - Unique brand positioning and differentiation
   - Competitive analysis
   - Market gap identification
   - Positioning strategy development

3. **Empathetic** - Emotional connection and customer resonance
   - Emotional intelligence assessment
   - Customer need identification
   - Brand personality development

4. **Authentic** - Trust, credibility, and brand consistency
   - Brand values definition
   - Brand story crafting
   - Brand promise articulation

### State Management

#### BrandContext
The application uses React Context for global state management, centered around the `BrandContext` which maintains:

```typescript
interface BrandData {
  insight: { marketInsight, consumerInsight, brandPurpose, completed }
  distinctive: { uniqueValue, differentiators, positioning, completed }
  empathy: { emotionalConnection, customerNeeds, brandPersonality, completed }
  authentic: { brandValues, brandStory, brandPromise, completed }
  avatar: { demographics, psychographics, painPoints, goals, completed }
  brandCanvas: { purpose, vision, mission, values, positioning, completed }
  userInfo: { name, email, company, industry }
}
```

Key functions:
- `updateBrandData()` - Update specific framework sections
- `getCompletionPercentage()` - Calculate progress
- `getRecommendedNextStep()` - Intelligent next action guidance

### Routing Architecture

The application uses React Router 6 with nested layouts:

```
/ (Index/Landing)
/welcome (Landing Page)
/auth (Authentication)
/diagnostic (Free Diagnostic)
/diagnostic/results (Results Display)
/dashboard (User Dashboard)
/idea (Framework Overview)
  /idea/insight (Insight Module)
  /idea/distinctive (Distinctive Module)
  /idea/empathy (Empathy Module)
  /idea/authenticity (Authenticity Module)
  /idea/consultant (AI Consultant)
/avatar (Avatar Builder)
/canvas (Brand Canvas)
/value-lens (ValueLens Tool)
/research-learning (Research Tools)
/beta (Beta Program Entry)
  /beta/journey (Beta Flow)
  /beta/feedback (Feedback Submission)
```

### Authentication Flow

1. User accesses `/auth` route
2. Supabase Auth handles email/password or OAuth
3. `useAuth` hook manages authentication state
4. Protected routes check auth status
5. User profile created in `profiles` table on signup
6. Session persisted via Supabase client

### Data Flow

```
User Input → React Components → BrandContext State
                ↓
         Supabase Client
                ↓
         Edge Functions → OpenAI/Anthropic APIs
                ↓
         PostgreSQL Database
                ↓
         Real-time Updates → UI Refresh
```

## Database Architecture

### Tables

1. **profiles** - User account information
   - id (UUID, primary key, references auth.users)
   - email, full_name
   - created_at, updated_at

2. **beta_testers** - Beta program participants
   - id (UUID, primary key)
   - name, email, company
   - overall_score, category_scores (JSON)
   - diagnostic_completion_date

3. **beta_feedback** - Beta program feedback
   - id (UUID, primary key)
   - user_id (references profiles)
   - beta_tester_id (references beta_testers)
   - overall_rating, areas_tested (array)
   - liked_most, improvements, issues
   - would_recommend

4. **user_diagnostic_results** - Diagnostic assessment results
   - id (UUID, primary key)
   - user_id (references profiles)
   - beta_tester_id (references beta_testers)
   - overall_score, category_scores (JSON)
   - diagnostic_completion_date

5. **idea_framework_submissions** - IDEA framework completions
   - id (UUID, primary key)
   - user_id (references profiles)
   - buyer_intent, motivation, triggers
   - shopper_type, demographics

6. **uploaded_documents** - Document uploads for knowledge base
   - id (UUID, primary key)
   - user_id, filename, file_path
   - mime_type, file_size
   - extracted_content (text)
   - status (pending/completed/error)

### Storage Buckets

- **documents** - User-uploaded files (PDFs, Word docs, text files)

## API Integration

### Supabase Edge Functions

All edge functions follow a consistent pattern:
- CORS-enabled for cross-origin requests
- Environment variable configuration
- Error handling with structured responses
- Logging for debugging and monitoring

See [API.md](./API.md) for complete API documentation.

### OpenAI Integration

- Model: GPT-4o-mini (fast, cost-effective) and GPT-4.1-2025-04-14 (advanced)
- Temperature: 0.3-0.7 (balanced creativity/consistency)
- Max tokens: 500-1500 (response length control)
- System prompts: Custom-engineered for IDEA framework alignment

### Anthropic Claude Integration

- Model: Claude 3 Haiku (fast, efficient)
- Max tokens: 300
- Use case: Contextual help and quick guidance

## Build & Deployment

### Development Build
```bash
npm run dev
# Runs Vite dev server on http://localhost:8080
# Hot Module Replacement enabled
# Source maps included
```

### Production Build
```bash
npm run build
# Optimized production bundle
# Asset minification and compression
# Tree shaking for minimal bundle size
# Output to /dist directory
```

### Preview Build
```bash
npm run preview
# Preview production build locally
# Test optimized bundle before deployment
```

## Environment Variables

Required environment variables (set in Supabase dashboard or .env.local):

### Frontend (.env.local)
```
VITE_SUPABASE_URL=<your-project-url>
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

### Backend (Supabase Edge Functions)
```
OPENAI_API_KEY=<openai-api-key>
ANTHROPIC_API_KEY=<anthropic-api-key>
RESEND_API_KEY=<resend-api-key>
SUPABASE_URL=<your-project-url>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

## Performance Optimizations

1. **Code Splitting** - Route-based lazy loading via React Router
2. **Asset Optimization** - Vite build optimization with rollup
3. **Image Optimization** - Lazy loading and background removal in-browser
4. **Database Indexing** - Indexed foreign keys and frequently queried columns
5. **Edge Functions** - Serverless architecture for auto-scaling
6. **React Query Caching** - Intelligent data caching and invalidation
7. **Bundle Analysis** - Tree shaking removes unused code

## Security Features

1. **Row Level Security (RLS)** - Database-level access control
2. **Authentication** - Supabase Auth with JWT tokens
3. **API Keys** - Server-side environment variables only
4. **CORS Headers** - Controlled cross-origin access
5. **Input Validation** - Zod schemas for type-safe validation
6. **SQL Injection Protection** - Parameterized queries via Supabase client

## Browser Compatibility

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari 14+, Chrome Mobile 90+)

## Key Features

### Brand Building Tools
- Interactive IDEA Framework modules
- AI-powered buyer intent analysis
- Customer avatar builder with export
- Brand canvas with PDF generation
- ValueLens emotional trigger assessment

### AI Assistance
- IDEA Framework GPT consultant
- Contextual help system
- Real-time content suggestions
- Behavioral science integration

### Research Tools
- Customer review analyzer
- Survey builder
- Buyer intent research

### Beta Program
- Diagnostic assessment
- Feedback collection
- Results email delivery
- Progress tracking

## Testing Strategy

While the codebase currently has minimal automated tests, recommended testing approach:

1. **Unit Tests** - Component logic and utility functions
2. **Integration Tests** - API endpoints and database operations
3. **E2E Tests** - Critical user flows (auth, framework completion)
4. **Manual Testing** - Beta program for real-world validation

## Monitoring & Logging

- **Edge Function Logs** - Supabase dashboard console output
- **Client Errors** - Browser console (consider error tracking service)
- **Database Monitoring** - Supabase database insights
- **Performance Monitoring** - Browser performance APIs

## Scalability Considerations

1. **Serverless Architecture** - Auto-scaling edge functions
2. **Database Connection Pooling** - Supabase built-in pooling
3. **CDN Delivery** - Static asset distribution
4. **Lazy Loading** - Progressive feature loading
5. **Caching Strategy** - React Query + browser caching

## Development Workflow

1. Clone repository
2. Install dependencies: `npm install`
3. Configure environment variables
4. Start dev server: `npm run dev`
5. Access at http://localhost:8080
6. Make changes (HMR auto-reloads)
7. Test locally
8. Build for production: `npm run build`
9. Deploy via Lovable platform or custom deployment

## Related Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) - Detailed system architecture
- [API.md](./API.md) - Complete API documentation
- [DATABASE.md](./DATABASE.md) - Database schema and relationships
- [DEVELOPMENT.md](./DEVELOPMENT.md) - Developer setup guide
- [CONTRIBUTING.md](./CONTRIBUTING.md) - Contribution guidelines
- [docs/](./docs/) - Feature guides and troubleshooting

## License

Copyright (c) 2025 IDEA Brand Coach. All rights reserved.

## Support

For technical issues or questions:
- Check documentation in /docs
- Review Supabase logs for backend issues
- Check browser console for frontend errors
- Contact development team
