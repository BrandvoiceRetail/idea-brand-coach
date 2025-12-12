# Beta Testers Table - Security Risk Assessment

## Finding Summary

| Field | Value |
|-------|-------|
| **Table** | `beta_testers` |
| **Internal ID** | `beta_testers_email_exposure` |
| **Severity** | Error |
| **Scanner** | supabase_lov |

## Description

The `beta_testers` table contains sensitive PII (email addresses, names, company information). The current RLS configuration has a security concern:

- **INSERT Policy**: `WITH CHECK: true` - Allows **anyone**, including unauthenticated users, to insert data
- **SELECT Policy**: Restricts access to users whose email matches their profile email
- **UPDATE/DELETE**: No policies (blocked by default)

## Risk Analysis

### Potential Threats

1. **Data Injection**: Attackers could flood the table with fake beta tester records
2. **Enumeration**: Could probe the system by inserting test data
3. **Resource Abuse**: No authentication means bots could abuse this endpoint
4. **Storage Costs**: Malicious actors could increase storage costs with spam data

### Likelihood: Medium
The endpoint is publicly accessible, making it a potential target for automated attacks.

### Impact: Low-Medium
- No existing data can be read by attackers (SELECT is restricted)
- Injected data would only affect the beta_testers table
- No privilege escalation possible

## Business Context

The `beta_testers` table is used to capture anonymous beta tester signups from the `BetaTesterCapture.tsx` component. This flow intentionally allows:

- Unauthenticated users to express interest in beta testing
- Anonymous diagnostic completion with optional contact info capture
- Lowering friction for potential beta testers

## Remediation Options

### Option A: Require Authentication (Recommended for High Security)

**Pros:**
- Eliminates anonymous insertion attacks
- Ensures all beta testers have verified accounts
- Stronger data integrity

**Cons:**
- Adds friction to beta signup flow
- Users must create account before expressing interest
- May reduce beta tester conversion rate

**Implementation:**
```sql
DROP POLICY IF EXISTS "Anyone can insert beta tester data" ON public.beta_testers;

CREATE POLICY "Authenticated users can insert beta tester data"
ON public.beta_testers
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);
```

### Option B: Keep Public INSERT (Accept Risk)

**Pros:**
- Zero friction for beta signups
- Supports anonymous diagnostic flow
- Better user experience

**Cons:**
- Vulnerable to spam/fake data injection
- No verification of inserted data
- Potential storage abuse

**Mitigations if accepting risk:**
- Add rate limiting via edge function proxy
- Add CAPTCHA to frontend form
- Implement data validation/cleanup jobs
- Monitor for unusual insert patterns

### Option C: Edge Function Proxy (Best Balance)

**Pros:**
- Public access preserved
- Rate limiting and validation possible
- Can add CAPTCHA verification
- Keeps table protected with authenticated-only INSERT

**Cons:**
- More complex implementation
- Additional maintenance overhead

**Implementation:**
1. Restrict table to authenticated INSERT only
2. Create edge function for public signups
3. Add rate limiting and validation in edge function
4. Use service role key to insert verified data

## Current Decision

**Status**: [ ] Fixed | [ ] Accepted with Mitigations | [x] Under Review

**Decision Date**: _pending_

**Rationale**: _pending decision from product/security team_

## Related Files

- `src/components/BetaTesterCapture.tsx` - Frontend component using this table
- `supabase/functions/save-beta-tester/index.ts` - Edge function for saving beta testers

## Revision History

| Date | Author | Change |
|------|--------|--------|
| 2025-12-12 | AI Security Review | Initial assessment |
