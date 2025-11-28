# 🧪 Field Context Testing - Quick Start Guide

**Branch:** `claude/test-field-context-storage-01ExRW2zN9Yck93kiC8m76yy`
**Goal:** Test that all text fields are being stored and accessible to the chatbot
**Time Available:** 5 hours

---

## 📋 What We're Testing

**The Data Flow:**
1. User fills in text field (Brand Canvas, Avatar Builder, etc.)
2. Field saves to browser IndexedDB (instant)
3. Background sync to Supabase `user_knowledge_base` table
4. Sync to OpenAI Vector Stores
5. Brand Coach GPT chatbot retrieves and uses the data

**Success = All 4 steps work for each field**

---

## 🚀 Quick Start (5 Steps)

### Step 1: Get Your User ID (1 minute)

```bash
# Open DevTools console on the app and run:
localStorage.getItem('supabase.auth.token')

# Or go to Supabase Dashboard → Authentication → Users
# Copy your user ID
```

### Step 2: Clear Everything (2 minutes)

**Clear Supabase & Chat History:**

Due to RLS policies, use Supabase SQL Editor:

1. Go to: https://supabase.com/dashboard/project/ecdrxtbclxfpkknasmrw/sql/new
2. Run this SQL:
```sql
DELETE FROM chat_messages WHERE user_id = 'YOUR_USER_ID';
DELETE FROM user_knowledge_base WHERE user_id = 'YOUR_USER_ID';

-- Verify (should show 0 for both)
SELECT 'chat_messages' as table_name, COUNT(*) as count
FROM chat_messages WHERE user_id = 'YOUR_USER_ID'
UNION ALL
SELECT 'user_knowledge_base', COUNT(*)
FROM user_knowledge_base WHERE user_id = 'YOUR_USER_ID';
```

**Clear Browser Storage:**
```bash
# Open browser console (F12) and paste:
cat scripts/clear-browser-storage.js
# Then copy the output and paste in console

# Or manually:
# DevTools → Application → IndexedDB → Delete "idea-brand-coach"
# Refresh page
```

### Step 3: Fill Fields with Test Data (Manual Entry)

**Navigate and fill fields:**
- Go to http://localhost:8080/brand-canvas
- Fill in each field with test values from `FIELD_TESTING_PROTOCOL.md`
- Wait 5-10 seconds after each field for sync
- Watch browser console for sync confirmations

### Step 4: Check Sync Status (2 minutes)

```bash
# Run the status checker:
./scripts/check-sync.sh YOUR_USER_ID

# This will show:
# ✅ Fields synced to Supabase
# ⚠️  Fields synced to Supabase but not OpenAI
# ❌ Fields not synced
```

### Step 5: Test Chatbot Retrieval (5 minutes)

Navigate to `/idea/consultant` (Trevor Brand Coach) and ask:

**For Brand Canvas:**
```
"What do you know about my brand purpose, vision, and mission?"
"Tell me about my brand values and personality"
```

**For Avatar:**
```
"What do you know about my target customer avatar?"
"Tell me about my customer's fears and desires"
```

**Expected:** Chatbot should mention the specific test values you entered.

---

## 📊 Tracking Your Results

Use the table in `FIELD_TESTING_PROTOCOL.md` to track each field:

| Field | Local | Supabase | OpenAI | Chatbot |
|-------|-------|----------|--------|---------|
| canvas_brand_purpose | ✅ | ✅ | ✅ | ✅ |

**Mark:**
- ✅ = Working
- ⚠️  = Partial (e.g., in Supabase but not OpenAI)
- ❌ = Not working

---

## 🔧 Troubleshooting

### Fields not syncing to Supabase?

**Check Console Logs:**
```javascript
// In browser console:
localStorage.debug = 'supabase:*'
// Then trigger field update and watch network tab
```

**Common Issues:**
- User not authenticated → Check `localStorage` for auth token
- RLS policy blocking → Check Supabase logs
- Network error → Check browser network tab

### Fields not syncing to OpenAI?

**Manual Trigger:**
```bash
curl -X POST 'https://ecdrxtbclxfpkknasmrw.supabase.co/functions/v1/sync-to-openai-vector-store' \
  -H "Authorization: Bearer YOUR_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"user_id": "YOUR_USER_ID"}'
```

**Check Vector Stores Exist:**
```sql
SELECT * FROM user_vector_stores WHERE user_id = 'YOUR_USER_ID';
```

### Chatbot not retrieving data?

**Check Edge Function Logs:**
- Supabase Dashboard → Edge Functions → `brand-coach-gpt` → Logs
- Look for "Retrieving relevant context" messages
- Check for errors in vector store retrieval

**Verify Vector Store Has Files:**
- OpenAI Dashboard → Vector Stores
- Find your store IDs (from `user_vector_stores` table)
- Verify files are uploaded

---

## 📝 What to Document

For each broken field, note:

1. **Field Identifier:** e.g., `canvas_brand_purpose`
2. **Failure Point:** Local / Supabase / OpenAI / Chatbot
3. **Error Message:** Copy from console/logs
4. **Reproducible:** Yes/No
5. **Workaround:** If found

**Example:**
```
Field: canvas_brand_values
Failure: OpenAI sync
Error: "Content too short"
Reproducible: Yes
Workaround: Arrays stored as "[]" initially, need at least 1 item
```

---

## ⏱️ Time Budget

**Total: 5 hours**

| Task | Time | Notes |
|------|------|-------|
| Setup & Clear | 15 min | Get user ID, clear databases |
| Brand Canvas Testing | 60 min | 8 fields × 7 min each |
| Avatar Testing | 90 min | 14 fields × 6 min each |
| Chatbot Verification | 30 min | Test queries for both |
| Bug Investigation | 60 min | For any failures |
| Documentation | 30 min | Fill in results table |
| Final Report | 15 min | Summary + next steps |

---

## 🎯 Success Criteria

**Field is "Working" when:**
- ✅ Saves to IndexedDB within 1 second
- ✅ Syncs to Supabase within 10 seconds
- ✅ Has `openai_file_id` within 60 seconds (or manual trigger)
- ✅ Chatbot retrieves and uses the value

**Overall Success:**
- Target: 90%+ fields working (20/22)
- Minimum: 80%+ fields working (18/22)

---

## 📦 Files Created

1. **FIELD_TESTING_PROTOCOL.md** - Detailed test protocol with all fields
2. **scripts/check-field-sync-status.ts** - Status checker script
3. **test/helpers/populate-test-fields.html** - Auto-fill test data
4. **TESTING_QUICK_START.md** - This file

---

## 🆘 Need Help?

**Common Commands:**

```bash
# Check sync status
npx tsx scripts/check-field-sync-status.ts YOUR_USER_ID

# View logs for a field
# (in browser console after triggering update)
console.log(localStorage.getItem('debug'))

# Manually trigger OpenAI sync
curl -X POST 'https://ecdrxtbclxfpkknasmrw.supabase.co/functions/v1/sync-to-openai-vector-store' \
  -H "Authorization: Bearer ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"user_id": "USER_ID"}'

# Check what's in IndexedDB
# (in browser console)
indexedDB.databases().then(console.log)
```

---

## 📊 Report Template

When done, fill this out:

```markdown
## Test Results - [DATE]

**Tester:** [Your Name]
**Duration:** [X hours]
**Fields Tested:** 22

### Summary
- ✅ Working: ___ / 22 (___%)
- ⚠️  Partial: ___ / 22
- ❌ Broken: ___ / 22

### Working Fields
- canvas_brand_purpose ✅
- [...]

### Broken Fields
- canvas_brand_values ❌ (Arrays not syncing)
- [...]

### Issues Found
1. **Array Fields:** Not syncing properly, stored as "[]"
2. [...]

### Recommended Fixes
1. Update array field sync logic to handle empty arrays
2. [...]

### Next Steps
- [ ] Fix critical issues
- [ ] Re-test failed fields
- [ ] Update documentation
```

---

**Ready to start? Follow the 5 Quick Start steps above!** 🚀
