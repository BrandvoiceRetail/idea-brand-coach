# Database Migration Strategy: V1 to V2

## Purpose
Define the additive migration strategy for transitioning from v1 to v2 without breaking existing functionality.

## Audience
Backend developers and database administrators.

## Prerequisites
- Understanding of Supabase/PostgreSQL
- Access to database admin panel
- Backup procedures in place

## Migration Principles

### Core Strategy: Additive Only
- **No breaking changes** - Existing tables/columns remain unchanged
- **New tables only** - Add brands, avatars, performance_metrics
- **Gradual migration** - Users opt-in to v2 features
- **Backward compatible** - v1 continues working throughout

## New Database Schema

### Table Structure

```sql
-- New table: brands (one brand per user for MVP)
CREATE TABLE IF NOT EXISTS brands (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  website TEXT,
  logo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id) -- One brand per user in MVP
);

-- New table: avatars (multiple per brand)
CREATE TABLE IF NOT EXISTS avatars (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  template_id TEXT, -- Reference to template used

  -- Demographics (flattened for query performance)
  age_range TEXT,
  gender TEXT,
  income_range TEXT,
  location TEXT,
  education_level TEXT,
  occupation TEXT,
  family_status TEXT,

  -- Psychographics (JSONB for flexibility)
  psychographics JSONB DEFAULT '{}',
  -- Structure: {
  --   values: string[],
  --   interests: string[],
  --   pain_points: string[],
  --   aspirations: string[],
  --   personality_traits: string[],
  --   lifestyle: string
  -- }

  -- Behaviors (JSONB)
  behaviors JSONB DEFAULT '{}',
  -- Structure: {
  --   shopping_habits: string[],
  --   media_consumption: string[],
  --   purchase_triggers: string[],
  --   brand_loyalty: string,
  --   decision_factors: string[]
  -- }

  -- IDEA Framework
  idea_insight TEXT,
  idea_distinctive TEXT,
  idea_empathetic TEXT,
  idea_authentic TEXT,

  -- Book Progress
  book_progress JSONB DEFAULT '{"currentChapter": 1, "completedStages": []}',

  -- Metadata
  completion_percentage INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Indexes for common queries
  INDEX idx_avatars_brand_id (brand_id),
  INDEX idx_avatars_active (brand_id, is_active)
);

-- New table: avatar_fields (track manual edits)
CREATE TABLE IF NOT EXISTS avatar_fields (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  avatar_id UUID NOT NULL REFERENCES avatars(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  field_value TEXT,
  is_manual_edit BOOLEAN DEFAULT false,
  edited_at TIMESTAMP WITH TIME ZONE,
  ai_suggested_value TEXT,
  confidence_score DECIMAL(3,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(avatar_id, field_name)
);

-- New table: avatar_chat_sessions
CREATE TABLE IF NOT EXISTS avatar_chat_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  avatar_id UUID NOT NULL REFERENCES avatars(id) ON DELETE CASCADE,
  messages JSONB DEFAULT '[]',
  current_chapter INTEGER DEFAULT 1,
  session_metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- New table: performance_metrics
CREATE TABLE IF NOT EXISTS performance_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  avatar_id UUID NOT NULL REFERENCES avatars(id) ON DELETE CASCADE,
  channel TEXT NOT NULL, -- facebook, email, tiktok, etc.
  metric_type TEXT NOT NULL, -- ctr, cpa, roas, conversion_rate
  metric_value DECIMAL(10,2) NOT NULL,
  comparison_baseline DECIMAL(10,2),
  notes TEXT,
  campaign_name TEXT,
  date_recorded DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  INDEX idx_metrics_avatar (avatar_id),
  INDEX idx_metrics_date (avatar_id, date_recorded)
);

-- New table: generated_documents
CREATE TABLE IF NOT EXISTS generated_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  avatar_id UUID NOT NULL REFERENCES avatars(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL, -- strategy, campaign_brief, content_plan
  content TEXT NOT NULL,
  format TEXT NOT NULL, -- pdf, markdown
  version INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Row-Level Security (RLS)

```sql
-- Enable RLS on all new tables
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE avatars ENABLE ROW LEVEL SECURITY;
ALTER TABLE avatar_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE avatar_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_documents ENABLE ROW LEVEL SECURITY;

-- Brands: Users can only see their own brand
CREATE POLICY "Users own brands" ON brands
  FOR ALL USING (user_id = auth.uid());

-- Avatars: Access through brand ownership
CREATE POLICY "Access avatars through brands" ON avatars
  FOR ALL USING (
    brand_id IN (
      SELECT id FROM brands WHERE user_id = auth.uid()
    )
  );

-- Avatar fields: Access through avatar ownership
CREATE POLICY "Access avatar fields" ON avatar_fields
  FOR ALL USING (
    avatar_id IN (
      SELECT a.id FROM avatars a
      JOIN brands b ON a.brand_id = b.id
      WHERE b.user_id = auth.uid()
    )
  );

-- Similar policies for other tables...
```

## Migration Steps

### Phase 1: Add New Tables (Day 1)

```bash
# Create migration file
npx supabase migration new add_v2_tables

# Add CREATE TABLE statements to migration file
# Run migration locally
npx supabase db reset

# Test migration
npm run test:db

# Push to staging
npx supabase db push --db-url $STAGING_DB_URL

# Verify in staging
# Push to production
npx supabase db push
```

### Phase 2: Create Default Brand (Day 2)

For existing users, create a default brand:

```sql
-- Migration: Create default brand for existing users
INSERT INTO brands (user_id, name, description)
SELECT
  u.id,
  COALESCE(p.company_name, p.full_name, 'My Brand'),
  'Migrated from v1'
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
WHERE NOT EXISTS (
  SELECT 1 FROM brands b WHERE b.user_id = u.id
)
ON CONFLICT (user_id) DO NOTHING;
```

### Phase 3: Migrate Chat History (Day 3)

```sql
-- Migration: Convert existing chats to first avatar
INSERT INTO avatars (brand_id, name, created_at)
SELECT
  b.id,
  'Original Avatar',
  MIN(c.created_at)
FROM brands b
JOIN chat_messages c ON c.user_id = b.user_id
GROUP BY b.id;

-- Migrate chat messages to avatar_chat_sessions
INSERT INTO avatar_chat_sessions (avatar_id, messages, created_at)
SELECT
  a.id,
  jsonb_agg(
    jsonb_build_object(
      'role', c.role,
      'content', c.content,
      'timestamp', c.created_at
    ) ORDER BY c.created_at
  ),
  MIN(c.created_at)
FROM avatars a
JOIN brands b ON a.brand_id = b.id
JOIN chat_messages c ON c.user_id = b.user_id
GROUP BY a.id;
```

## Rollback Strategy

### Immediate Rollback (< 1 hour)

```sql
-- Rollback script (keep ready)
DROP TABLE IF EXISTS performance_metrics CASCADE;
DROP TABLE IF EXISTS generated_documents CASCADE;
DROP TABLE IF EXISTS avatar_chat_sessions CASCADE;
DROP TABLE IF EXISTS avatar_fields CASCADE;
DROP TABLE IF EXISTS avatars CASCADE;
DROP TABLE IF EXISTS brands CASCADE;
```

### Gradual Rollback (Feature Flags)

```typescript
// Use feature flags for gradual rollback
const V2_FEATURES = {
  multiAvatar: false,  // Disable v2 features
  bookGuidedChat: false,
  performanceTracking: false
};
```

## Data Integrity Checks

### Pre-Migration Checks

```sql
-- Check for orphaned records
SELECT COUNT(*) FROM chat_messages
WHERE user_id NOT IN (SELECT id FROM auth.users);

-- Verify user count matches
SELECT
  (SELECT COUNT(*) FROM auth.users) as user_count,
  (SELECT COUNT(*) FROM profiles) as profile_count;
```

### Post-Migration Validation

```sql
-- Verify all users have brands
SELECT COUNT(*) FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM brands b WHERE b.user_id = u.id
);

-- Check migration completeness
SELECT
  'Users' as entity,
  COUNT(*) as count
FROM auth.users
UNION ALL
SELECT
  'Brands',
  COUNT(*)
FROM brands
UNION ALL
SELECT
  'Avatars',
  COUNT(*)
FROM avatars;
```

## Performance Considerations

### Indexes

```sql
-- Performance-critical indexes
CREATE INDEX idx_avatars_brand_active
  ON avatars(brand_id, is_active)
  WHERE is_active = true;

CREATE INDEX idx_fields_avatar_manual
  ON avatar_fields(avatar_id, is_manual_edit)
  WHERE is_manual_edit = true;

CREATE INDEX idx_metrics_avatar_recent
  ON performance_metrics(avatar_id, date_recorded DESC);

-- JSONB indexes for common queries
CREATE INDEX idx_avatar_psychographics
  ON avatars USING gin(psychographics);

CREATE INDEX idx_avatar_behaviors
  ON avatars USING gin(behaviors);
```

### Query Optimization

```sql
-- Materialized view for avatar summaries
CREATE MATERIALIZED VIEW avatar_summaries AS
SELECT
  a.id,
  a.brand_id,
  a.name,
  a.completion_percentage,
  COUNT(DISTINCT af.field_name) as filled_fields,
  COUNT(DISTINCT pm.id) as metric_count,
  MAX(pm.date_recorded) as last_metric_date
FROM avatars a
LEFT JOIN avatar_fields af ON a.id = af.avatar_id
LEFT JOIN performance_metrics pm ON a.id = pm.avatar_id
GROUP BY a.id;

-- Refresh periodically
CREATE INDEX idx_avatar_summaries_brand
  ON avatar_summaries(brand_id);
```

## Monitoring

### Migration Metrics

```sql
-- Monitor migration progress
CREATE OR REPLACE VIEW migration_status AS
SELECT
  'Total Users' as metric,
  COUNT(*) as value
FROM auth.users
UNION ALL
SELECT
  'Brands Created',
  COUNT(*)
FROM brands
UNION ALL
SELECT
  'Avatars Created',
  COUNT(*)
FROM avatars
UNION ALL
SELECT
  'V2 Active Users',
  COUNT(DISTINCT b.user_id)
FROM brands b
JOIN avatars a ON b.id = a.brand_id
WHERE a.created_at > NOW() - INTERVAL '7 days';
```

### Alert Queries

```sql
-- Alert if migration is incomplete
SELECT
  user_id,
  email,
  'No brand created' as issue
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM brands b WHERE b.user_id = u.id
)
AND u.created_at < NOW() - INTERVAL '1 day';
```

## Testing Checklist

- [ ] All migrations run without errors
- [ ] RLS policies work correctly
- [ ] No performance degradation
- [ ] V1 features still functional
- [ ] Data integrity maintained
- [ ] Rollback script tested
- [ ] Monitoring queries return expected results
- [ ] Load testing completed

## Timeline

| Day | Task | Status |
|-----|------|--------|
| 1 | Create new tables | Pending |
| 2 | Add RLS policies | Pending |
| 3 | Migrate existing data | Pending |
| 4 | Test in staging | Pending |
| 5 | Production deployment | Pending |

---

**Migration Date:** TBD
**Rollback Window:** 24 hours
**Point of Contact:** Database Team