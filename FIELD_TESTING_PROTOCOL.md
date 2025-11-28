# Text Field Context Storage - Comprehensive Testing Protocol

## Test Date: 2025-11-25
**Branch:** `claude/test-field-context-storage-01ExRW2zN9Yck93kiC8m76yy`
**Available Time:** 5 hours

## Data Flow Architecture

### How Text Fields Work:
1. **User Input** → Text field on page (Brand Canvas, Avatar Builder, etc.)
2. **Local Save** → `usePersistedField` hook saves to IndexedDB (instant, <10ms)
3. **Supabase Sync** → `SupabaseSyncService` syncs to `user_knowledge_base` table (background)
4. **OpenAI Sync** → `sync-to-openai-vector-store` uploads to OpenAI Vector Stores
5. **Chatbot Retrieval** → Brand Coach GPT retrieves from Vector Stores

### Verification Points:
- ✅ **Local**: Check browser IndexedDB
- ✅ **Supabase**: Check `user_knowledge_base` table has entry
- ✅ **OpenAI**: Check entry has `openai_file_id` and `openai_synced_at`
- ✅ **Chatbot**: Ask chatbot and verify it knows the data

---

## All Text Fields to Test

### Brand Canvas (`/brand-canvas`)
| Field Identifier | Field Name | Test Value | Local | Supabase | OpenAI | Chatbot |
|-----------------|------------|------------|-------|----------|--------|---------|
| `canvas_brand_purpose` | Brand Purpose | "My test purpose is to help people succeed" | [ ] | [ ] | [ ] | [ ] |
| `canvas_brand_vision` | Brand Vision | "My vision is a world where everyone thrives" | [ ] | [ ] | [ ] | [ ] |
| `canvas_brand_mission` | Brand Mission | "My mission is to provide exceptional tools" | [ ] | [ ] | [ ] | [ ] |
| `canvas_positioning_statement` | Positioning Statement | "We position ourselves as the trusted leader" | [ ] | [ ] | [ ] | [ ] |
| `canvas_value_proposition` | Value Proposition | "We deliver unmatched value through innovation" | [ ] | [ ] | [ ] | [ ] |
| `canvas_brand_voice` | Brand Voice | "Our voice is friendly yet professional" | [ ] | [ ] | [ ] | [ ] |
| `canvas_brand_values` | Brand Values (Array) | ["Integrity", "Innovation", "Excellence"] | [ ] | [ ] | [ ] | [ ] |
| `canvas_brand_personality` | Brand Personality (Array) | ["Trustworthy", "Bold", "Caring"] | [ ] | [ ] | [ ] | [ ] |

**Test Query for Chatbot:** "What do you know about my brand purpose, vision, and mission?"

---

### Avatar Builder (`/avatar`)
| Field Identifier | Field Name | Test Value | Local | Supabase | OpenAI | Chatbot |
|-----------------|------------|------------|-------|----------|--------|---------|
| `avatar_name` | Avatar Name | "Sarah the Strategic Shopper" | [ ] | [ ] | [ ] | [ ] |
| `avatar_demographics_age` | Age | "35-45" | [ ] | [ ] | [ ] | [ ] |
| `avatar_demographics_income` | Income | "$75,000-$100,000" | [ ] | [ ] | [ ] | [ ] |
| `avatar_demographics_location` | Location | "Urban areas in Northeast USA" | [ ] | [ ] | [ ] | [ ] |
| `avatar_demographics_lifestyle` | Lifestyle | "Busy professional with two kids, values efficiency and quality" | [ ] | [ ] | [ ] | [ ] |
| `avatar_psychology_values` | Values (Array) | ["Family", "Success", "Time"] | [ ] | [ ] | [ ] | [ ] |
| `avatar_psychology_fears` | Fears (Array) | ["Missing out", "Making wrong choice"] | [ ] | [ ] | [ ] | [ ] |
| `avatar_psychology_desires` | Desires (Array) | ["Simplicity", "Premium quality"] | [ ] | [ ] | [ ] | [ ] |
| `avatar_psychology_triggers` | Triggers (Array) | ["Social proof", "Scarcity", "Authority"] | [ ] | [ ] | [ ] | [ ] |
| `avatar_buying_behavior_intent` | Buyer Intent | "high" | [ ] | [ ] | [ ] | [ ] |
| `avatar_buying_behavior_decision_factors` | Decision Factors (Array) | ["Reviews", "Brand trust", "Price"] | [ ] | [ ] | [ ] | [ ] |
| `avatar_buying_behavior_shopping_style` | Shopping Style | "Research-heavy, comparison shopping" | [ ] | [ ] | [ ] | [ ] |
| `avatar_buying_behavior_price_consciousness` | Price Consciousness | "moderate" | [ ] | [ ] | [ ] | [ ] |
| `avatar_voice_customer_feedback` | Voice of Customer | "Customers say: I love the quality but wish it was easier to find" | [ ] | [ ] | [ ] | [ ] |

**Test Query for Chatbot:** "What do you know about my target customer avatar?"

---

## Testing Procedure

### Before Testing
1. **Clear OpenAI Vector Stores:**
   - Go to Supabase Dashboard
   - Run SQL: `UPDATE user_knowledge_base SET openai_file_id = NULL, openai_synced_at = NULL WHERE user_id = '[YOUR_USER_ID]';`
   - Or manually delete via OpenAI dashboard

2. **Clear Supabase Knowledge Base:**
   ```sql
   DELETE FROM user_knowledge_base WHERE user_id = '[YOUR_USER_ID]';
   ```

3. **Clear IndexedDB:**
   - Open DevTools → Application → IndexedDB
   - Delete `idea-brand-coach` database
   - Refresh page

### For Each Field

#### Step 1: Update Field
1. Navigate to the page (e.g., `/brand-canvas`)
2. Find the field
3. Enter the test value from the table above
4. Wait 5 seconds for debounce + sync

#### Step 2: Verify Local Storage (IndexedDB)
1. Open DevTools → Application → IndexedDB
2. Navigate to `idea-brand-coach` → `knowledge_entries`
3. Look for entry with matching `fieldIdentifier`
4. Verify `content` matches test value
5. Mark **Local** column ✅ or ❌

#### Step 3: Verify Supabase Sync
1. Open Supabase Dashboard → Table Editor → `user_knowledge_base`
2. Filter by `field_identifier` = the field ID
3. Verify `content` column matches test value
4. Verify `is_current = true`
5. Check `updated_at` is recent
6. Mark **Supabase** column ✅ or ❌

#### Step 4: Trigger OpenAI Sync
**Option A: Automatic (if enabled)**
- Wait 30 seconds for background sync

**Option B: Manual Trigger**
```bash
curl -X POST 'https://ecdrxtbclxfpkknasmrw.supabase.co/functions/v1/sync-to-openai-vector-store' \
  -H "Authorization: Bearer [YOUR_ANON_KEY]" \
  -H "Content-Type: application/json" \
  -d '{"user_id": "[YOUR_USER_ID]", "category": "canvas"}'
```

#### Step 5: Verify OpenAI Sync
1. Check Supabase `user_knowledge_base` table again
2. Verify `openai_file_id` is NOT NULL
3. Verify `openai_synced_at` is recent
4. Mark **OpenAI** column ✅ or ❌

#### Step 6: Test Chatbot Retrieval
1. Navigate to Trevor Brand Coach (`/idea/consultant`)
2. Ask the test query (see table above)
3. Verify chatbot mentions the specific test value
4. Mark **Chatbot** column ✅ or ❌

#### Step 7: Check Logs
```bash
# View edge function logs
# Supabase Dashboard → Edge Functions → idea-framework-consultant → Logs
# Look for:
# - "User KB status: already exists"
# - Vector store retrieval
# - OpenAI API calls
```

---

## Quick Test Script

Save this as a browser bookmark for quick DB checking:

```javascript
// Check IndexedDB
(async () => {
  const db = await new Promise((resolve, reject) => {
    const req = indexedDB.open('idea-brand-coach');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  const tx = db.transaction(['knowledge_entries'], 'readonly');
  const store = tx.objectStore('knowledge_entries');
  const all = await store.getAll();

  console.table(all.map(e => ({
    field: e.fieldIdentifier,
    content: e.content.substring(0, 50) + '...',
    synced: e.lastSyncedAt ? 'Yes' : 'No'
  })));
})();
```

---

## Common Issues & Fixes

### Issue: Field not saving to IndexedDB
- **Check:** Browser console for errors
- **Fix:** Verify `usePersistedField` hook is properly initialized

### Issue: Not syncing to Supabase
- **Check:** Network tab for failed requests
- **Check:** Console logs for sync errors
- **Fix:** Verify user is authenticated
- **Fix:** Check RLS policies on `user_knowledge_base` table

### Issue: Not syncing to OpenAI
- **Check:** `openai_file_id` is NULL in database
- **Fix:** Manually trigger sync function
- **Fix:** Check OpenAI API key is configured
- **Fix:** Verify vector stores exist in `user_vector_stores` table

### Issue: Chatbot doesn't retrieve data
- **Check:** Edge function logs for errors
- **Check:** Vector store has files
- **Fix:** Ensure `openai_file_id` is set
- **Fix:** Verify vector store IDs in `user_vector_stores`

---

## Success Criteria

✅ **Field Working Properly:**
- Local: Saves to IndexedDB within 1 second
- Supabase: Syncs within 10 seconds
- OpenAI: Syncs within 60 seconds (or on manual trigger)
- Chatbot: Retrieves and uses data in response

❌ **Field Broken:**
- Any step fails consistently (after 3 retries)
- Document specific failure point and error messages

---

## Time Budget (5 hours)

- **Brand Canvas Testing:** 90 minutes (8 fields × 10 min each)
- **Avatar Builder Testing:** 120 minutes (14 fields × 8 min each)
- **Documentation & Analysis:** 45 minutes
- **Bug Investigation:** 60 minutes (for any failures)
- **Final Report:** 15 minutes

---

## Test Results Summary

**Total Fields:** 22
**Working:** ___ / 22
**Broken:** ___ / 22
**Success Rate:** ___%

### Working Fields:
-

### Broken Fields (with failure point):
-

### Next Steps:
-
