# Cost Analysis Documentation

This folder contains cost analysis and infrastructure pricing documentation for the IDEA Brand Coach platform.

## Documents

### 🤖 [AI Features Cost Analysis](./AI_FEATURES_COST_ANALYSIS.md)
Complete breakdown of OpenAI API costs across all features:
- Per-user cost estimates by subscription tier
- Feature-by-feature cost analysis (Brand Coach, Copy Generator, etc.)
- Model optimization strategies (GPT-4 vs GPT-4o-mini)
- Usage projections and break-even analysis
- **Key Finding: $2.15-$15.21 per user per month**

### 📊 [Document Upload Cost Analysis](./DOCUMENT_UPLOAD_COST_ANALYSIS.md)
Comprehensive analysis of costs associated with document upload functionality, including:
- Supabase storage and bandwidth costs
- OpenAI API costs (Files, Vector Stores, Embeddings)
- Cost scenarios for different business sizes
- Optimization strategies
- Impact of file size limits on pricing

## Key Cost Drivers

1. **OpenAI API Usage**
   - File storage: $0.10/GB/day
   - Vector store storage: $0.10/GB/day
   - Embeddings: $0.0001/1K tokens
   - Retrieval: $0.10/GB searched

2. **Supabase Infrastructure**
   - Storage: $0.021/GB/month (after free tier)
   - Edge Functions: $2/million invocations
   - Bandwidth: $0.09/GB (after free tier)

## Cost Monitoring

Use the SQL queries in the cost analysis documents to monitor:
- Monthly upload volumes
- Storage utilization
- Per-user usage patterns
- Cost projections

## Related Documentation

- [Pricing & Subscriptions](../pricing/) - User-facing pricing tiers and paywall implementation
- [Feature Gating](../FEATURE_GATING_GUIDE.md) - Feature access control by subscription tier
- [Technical Architecture](../TECHNICAL_ARCHITECTURE.md) - System design affecting costs

---

*For business pricing and subscription models, see [Pricing Documentation](../pricing/)*