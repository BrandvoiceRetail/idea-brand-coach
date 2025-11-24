# Deploy User Knowledge Base Schema to Supabase

## Quick Deploy Instructions

The user_knowledge_base table needs to be created in your Supabase database to enable the local-first persistence with sync functionality.

## Option 1: Deploy via Supabase Dashboard (Recommended)

1. **Open your Supabase Dashboard**
   - Go to https://supabase.com/dashboard/project/ecdrxtbclxfpkknasmrw

2. **Navigate to SQL Editor**
   - Click on "SQL Editor" in the left sidebar

3. **Create New Query**
   - Click "New query" button

4. **Copy and Paste the Migration**
   - Copy the entire contents of `/supabase/migrations/20241123_user_knowledge_base.sql`
   - Paste it into the SQL editor

5. **Run the Migration**
   - Click "Run" button (or press Ctrl/Cmd + Enter)
   - You should see "Success. No rows returned" message

6. **Verify the Deployment**
   - Go to "Table Editor" in the sidebar
   - You should see a new table called `user_knowledge_base`
   - The table should have all the columns defined in our schema

## Option 2: Deploy via Supabase CLI

If you have the service role key:

```bash
# Set your service role key (get from Supabase dashboard > Settings > API)
export SUPABASE_SERVICE_KEY="your-service-role-key"

# Run the deployment script
npx tsx scripts/deploy-knowledge-base-schema.ts
```

## Option 3: Manual SQL Execution

If the above options don't work, you can execute the SQL statements one by one:

### Step 1: Enable pgvector
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### Step 2: Create the Table
```sql
CREATE TABLE IF NOT EXISTS public.user_knowledge_base (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category TEXT NOT NULL CHECK (category IN ('diagnostic', 'avatar', 'insights', 'canvas', 'copy')),
    subcategory TEXT,
    field_identifier TEXT NOT NULL,
    content TEXT NOT NULL,
    structured_data JSONB,
    embedding vector(1536),
    metadata JSONB,
    source_page TEXT,
    version INTEGER DEFAULT 1 NOT NULL,
    is_current BOOLEAN DEFAULT true,
    last_synced_at TIMESTAMP WITH TIME ZONE,
    local_changes BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

### Step 3: Create Indexes
```sql
CREATE INDEX idx_user_knowledge_user_id ON public.user_knowledge_base(user_id);
CREATE INDEX idx_user_knowledge_field_identifier ON public.user_knowledge_base(field_identifier);
CREATE INDEX idx_user_knowledge_user_field ON public.user_knowledge_base(user_id, field_identifier);
CREATE INDEX idx_user_knowledge_user_category ON public.user_knowledge_base(user_id, category);
CREATE INDEX idx_user_knowledge_is_current ON public.user_knowledge_base(is_current);
CREATE INDEX idx_user_knowledge_user_current ON public.user_knowledge_base(user_id, is_current);
```

### Step 4: Enable RLS
```sql
ALTER TABLE public.user_knowledge_base ENABLE ROW LEVEL SECURITY;

-- Users can view their own entries
CREATE POLICY "Users can view own knowledge" ON public.user_knowledge_base
    FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own entries
CREATE POLICY "Users can insert own knowledge" ON public.user_knowledge_base
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own entries
CREATE POLICY "Users can update own knowledge" ON public.user_knowledge_base
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Users can delete their own entries
CREATE POLICY "Users can delete own knowledge" ON public.user_knowledge_base
    FOR DELETE USING (auth.uid() = user_id);
```

## Verification

After deployment, verify everything is working:

1. **Check Table Exists**
   - Go to Table Editor in Supabase
   - Look for `user_knowledge_base` table

2. **Test RLS Policies**
   - Try to insert a test record via the app
   - Check that users can only see their own data

3. **Test the Avatar Builder**
   - Go to http://localhost:8080/avatar
   - Enter some data
   - Check the Network tab - you should see sync attempts
   - Check Supabase table for new entries

## What This Schema Provides

- **Local-First Storage**: Data saves instantly to browser IndexedDB
- **Background Sync**: Automatic sync to Supabase when online
- **Version Control**: Keeps history of all field changes
- **Vector Embeddings**: Ready for RAG/semantic search (embeddings generated separately)
- **Row Level Security**: Users can only access their own data
- **Offline Support**: Full functionality without internet

## Troubleshooting

### If you see "relation already exists" errors:
- The table may already be partially created
- Drop the table and try again: `DROP TABLE IF EXISTS public.user_knowledge_base CASCADE;`

### If RLS policies fail:
- Make sure you're using the correct project
- Check that auth.users table exists

### If sync doesn't work:
- Check browser console for errors
- Verify your Supabase URL and anon key in .env
- Check RLS policies are correctly set

## Next Steps

Once deployed:
1. Test offline functionality in Avatar Builder
2. Migrate Brand Canvas to use the same system
3. Add vector embedding generation for RAG support