# Metrics Instrumentation Plan

## Executive Summary

Comprehensive metrics tracking for usage analytics, cost monitoring, and user behavior insights. Critical for post-beta optimization and scaling decisions.

**Priority**: HIGH (implement before public launch)
**Timeline**: Phase 2 (Beta) → Phase 3 (Post-Beta)
**Estimated Effort**: 5-7 days

## Metrics Categories

### 1. AI Usage Metrics (CRITICAL)

#### Token Tracking
```typescript
interface TokenUsageMetric {
  id: string;
  user_id: string;
  session_id: string;
  feature_name: string; // 'brand-coach', 'copy-generator', etc.
  model: string; // 'gpt-4', 'gpt-4o-mini', etc.
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  response_time_ms: number;
  timestamp: datetime;
  subscription_tier: string;
}
```

**Implementation**:
- Wrapper function for all OpenAI API calls
- Automatic token counting from API response
- Cost calculation based on model pricing
- Store in `ai_usage_metrics` table

#### Feature Usage Tracking
```typescript
interface FeatureUsageMetric {
  user_id: string;
  feature_name: string;
  action: string; // 'initiated', 'completed', 'failed'
  metadata: {
    document_size?: number;
    message_count?: number;
    generation_type?: string;
  };
  timestamp: datetime;
}
```

### 2. User Behavior Metrics

#### Session Analytics
```typescript
interface SessionMetric {
  session_id: string;
  user_id: string;
  start_time: datetime;
  end_time: datetime;
  page_views: string[];
  ai_interactions: number;
  documents_uploaded: number;
  exports_generated: number;
  subscription_tier: string;
}
```

#### Engagement Metrics
- Daily/Weekly/Monthly Active Users (DAU/WAU/MAU)
- Session duration and frequency
- Feature adoption rates
- Retention cohorts

### 3. Cost Analytics

#### Per-User Cost Tracking
```sql
CREATE TABLE user_cost_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  ai_costs DECIMAL(10, 4),
  storage_costs DECIMAL(10, 4),
  bandwidth_costs DECIMAL(10, 4),
  total_costs DECIMAL(10, 4),
  revenue DECIMAL(10, 4),
  margin DECIMAL(10, 4),
  created_at TIMESTAMP DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_user_cost_metrics_user_period
ON user_cost_metrics(user_id, period_start);
```

#### Real-time Cost Dashboard
- Current month spend by feature
- Cost trends and projections
- Alert thresholds ($X per user per day)
- Anomaly detection for usage spikes

### 4. Performance Metrics

#### API Response Times
```typescript
interface PerformanceMetric {
  endpoint: string;
  method: string;
  response_time_ms: number;
  status_code: number;
  error_message?: string;
  user_id?: string;
  timestamp: datetime;
}
```

#### System Health
- Edge function execution times
- Database query performance
- Vector store search latency
- File upload/processing times

### 5. Business Metrics

#### Conversion Funnel
```typescript
interface ConversionMetric {
  event_type: 'diagnostic_started' | 'diagnostic_completed' |
              'account_created' | 'subscription_started' |
              'first_ai_chat' | 'first_document_upload';
  user_id?: string;
  session_id: string;
  metadata: Record<string, any>;
  timestamp: datetime;
}
```

#### Revenue Analytics
- MRR/ARR tracking
- Churn rate by tier
- LTV by acquisition channel
- Upgrade/downgrade patterns

## Implementation Phases

### Phase 1: Core Infrastructure (Pre-Beta)
**Timeline**: 2 days

1. **Database Schema**
```sql
-- Create metrics tables
CREATE SCHEMA IF NOT EXISTS analytics;

CREATE TABLE analytics.ai_usage_metrics (...);
CREATE TABLE analytics.feature_usage_metrics (...);
CREATE TABLE analytics.session_metrics (...);
CREATE TABLE analytics.performance_metrics (...);
```

2. **Tracking Service**
```typescript
// src/services/metrics.ts
export class MetricsService {
  static async trackAIUsage(data: TokenUsageMetric): Promise<void> {
    // Queue for batch insert
    await this.queue.add('ai-usage', data);
  }

  static async trackFeatureUsage(data: FeatureUsageMetric): Promise<void> {
    // Real-time tracking
    await supabase.from('feature_usage_metrics').insert(data);
  }
}
```

3. **OpenAI Wrapper**
```typescript
// src/lib/openai-wrapper.ts
export async function openAICompletion(params: CompletionParams) {
  const startTime = Date.now();

  try {
    const response = await openai.chat.completions.create(params);

    // Track usage
    await MetricsService.trackAIUsage({
      model: params.model,
      input_tokens: response.usage.prompt_tokens,
      output_tokens: response.usage.completion_tokens,
      cost_usd: calculateCost(params.model, response.usage),
      response_time_ms: Date.now() - startTime,
      // ... other fields
    });

    return response;
  } catch (error) {
    // Track error
    await MetricsService.trackError(error);
    throw error;
  }
}
```

### Phase 2: Analytics Dashboard (Beta)
**Timeline**: 3 days

1. **Admin Dashboard Components**
   - Real-time cost monitor
   - Usage charts (Chart.js/Recharts)
   - User activity heatmap
   - Alert configuration

2. **SQL Queries & Views**
```sql
-- Daily cost rollup
CREATE MATERIALIZED VIEW analytics.daily_costs AS
SELECT
  DATE(timestamp) as date,
  user_id,
  feature_name,
  COUNT(*) as request_count,
  SUM(input_tokens) as total_input_tokens,
  SUM(output_tokens) as total_output_tokens,
  SUM(cost_usd) as total_cost
FROM analytics.ai_usage_metrics
GROUP BY 1, 2, 3;

-- User cost summary
CREATE VIEW analytics.user_cost_summary AS
SELECT
  u.email,
  u.raw_user_meta_data->>'subscription_tier' as tier,
  COUNT(DISTINCT DATE(aim.timestamp)) as active_days,
  COUNT(aim.id) as total_requests,
  SUM(aim.cost_usd) as total_cost,
  AVG(aim.cost_usd) as avg_cost_per_request
FROM auth.users u
LEFT JOIN analytics.ai_usage_metrics aim ON u.id = aim.user_id
WHERE aim.timestamp >= NOW() - INTERVAL '30 days'
GROUP BY 1, 2;
```

3. **Monitoring Alerts**
   - Cost threshold alerts
   - Usage spike detection
   - Error rate monitoring
   - Performance degradation

### Phase 3: Advanced Analytics (Post-Beta)
**Timeline**: 2 days

1. **Predictive Analytics**
   - Cost forecasting
   - Churn prediction
   - Usage pattern clustering

2. **A/B Testing Framework**
   - Model performance comparison
   - Feature flag integration
   - Conversion optimization

3. **Export & Reporting**
   - Automated monthly reports
   - CSV exports for accounting
   - API usage reports for users

## Technical Implementation

### Frontend Tracking

```typescript
// src/hooks/useMetrics.ts
export function useMetrics() {
  const { user } = useAuth();

  const trackEvent = useCallback((event: string, properties?: any) => {
    if (!user) return;

    // Queue events for batch sending
    eventQueue.push({
      user_id: user.id,
      event,
      properties,
      timestamp: new Date(),
    });

    // Batch send every 10 seconds or 20 events
    if (eventQueue.length >= 20) {
      flushEvents();
    }
  }, [user]);

  return { trackEvent };
}

// Usage in components
const { trackEvent } = useMetrics();
trackEvent('brand_coach_message_sent', {
  session_id,
  message_length,
});
```

### Backend Tracking

```typescript
// Edge function wrapper
export async function trackEdgeFunction<T>(
  name: string,
  handler: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();

  try {
    const result = await handler();

    // Track success
    await supabase.from('performance_metrics').insert({
      function_name: name,
      duration_ms: Date.now() - startTime,
      status: 'success',
    });

    return result;
  } catch (error) {
    // Track error
    await supabase.from('performance_metrics').insert({
      function_name: name,
      duration_ms: Date.now() - startTime,
      status: 'error',
      error_message: error.message,
    });

    throw error;
  }
}
```

## Privacy & Compliance

### Data Retention
- Raw metrics: 90 days
- Aggregated metrics: 2 years
- PII handling: Anonymize after 30 days

### GDPR Compliance
- User consent for analytics
- Right to deletion
- Data export capability

### Security
- Encrypt sensitive metrics
- Role-based access to dashboards
- Audit logs for data access

## Success Metrics

### Beta Phase KPIs
- [ ] 100% of AI calls tracked
- [ ] < 1% data loss in metrics
- [ ] Dashboard load time < 2s
- [ ] Cost tracking accuracy > 99%

### Post-Beta Goals
- [ ] Reduce AI costs by 30%
- [ ] Identify top 3 feature optimizations
- [ ] Predict churn with 80% accuracy
- [ ] Automate cost anomaly detection

## Rollout Plan

### Week 1 (Pre-Beta)
- [ ] Deploy database schema
- [ ] Implement AI usage tracking
- [ ] Test metrics collection

### Week 2 (Beta Launch)
- [ ] Deploy basic dashboard
- [ ] Set up alerts
- [ ] Monitor data quality

### Week 3-4 (Beta Testing)
- [ ] Analyze usage patterns
- [ ] Optimize based on data
- [ ] Prepare scaling plan

### Month 2 (Post-Beta)
- [ ] Advanced analytics
- [ ] Predictive models
- [ ] Full automation

## Estimated Costs

### Infrastructure
- Supabase Analytics Tables: ~$5/month (included in plan)
- Dashboard Hosting: Included in current setup
- Monitoring Tools: ~$20/month (optional DataDog/Sentry)

### Development
- Initial Setup: 2 days
- Dashboard Build: 3 days
- Testing & Refinement: 2 days
- **Total: 7 days effort**

## Risk Mitigation

### Data Loss Prevention
- Implement retry logic
- Queue failed metrics
- Daily backups

### Performance Impact
- Async tracking (non-blocking)
- Batch inserts
- Separate analytics database (future)

### Cost Overruns
- Real-time alerts at 80% budget
- Automatic rate limiting
- Kill switches for features

---

**Next Steps**:
1. Review and approve plan
2. Create analytics schema
3. Implement core tracking
4. Deploy to beta environment

**Dependencies**:
- Database migrations
- Environment variables for feature flags
- Admin role setup for dashboard access

---

*Document Version: 1.0*
*Last Updated: December 2024*
*Owner: Engineering Team*