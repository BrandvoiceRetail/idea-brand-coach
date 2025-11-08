# Supabase Patterns - IDEA Brand Coach

## Client Import

```typescript
// Always import from this file:
import { supabase } from '@/integrations/supabase/client';

// Types come from:
import type { Database } from '@/integrations/supabase/types';
```

## Standard Query Pattern

```typescript
// ✅ CORRECT: Always handle errors
const { data, error } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', userId)
  .single();

if (error) {
  console.error('Database error:', error);
  toast.error('Failed to load profile');
  return null;
}

// Use data safely
return data;
```

## Database Tables

### profiles
```typescript
{
  id: string;              // UUID from auth.users
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}
```

### diagnostic_responses
```typescript
{
  id: string;
  user_id: string;         // Foreign key to profiles
  responses: object;       // JSON of question answers
  scores: object;          // Calculated IDEA scores
  created_at: string;
}
```

### chat_history
```typescript
{
  id: string;
  user_id: string;
  message: string;
  role: 'user' | 'assistant';
  created_at: string;
}
```

### documents
```typescript
{
  id: string;
  user_id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  created_at: string;
}
```

## Authentication Patterns

### Sign Up
```typescript
const { data, error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    data: {
      full_name: name,
    }
  }
});

if (error) {
  toast.error('Failed to create account');
  return;
}

// Profile is auto-created via database trigger
toast.success('Account created! Check your email to verify.');
```

### Sign In
```typescript
const { data, error } = await supabase.auth.signInWithPassword({
  email,
  password,
});

if (error) {
  toast.error('Invalid email or password');
  return;
}

// Redirect to dashboard
navigate('/dashboard');
```

### Google OAuth
```typescript
const { error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: `${window.location.origin}/auth/callback`
  }
});
```

### Session Check
```typescript
const { data: { session } } = await supabase.auth.getSession();

if (!session) {
  navigate('/login');
}
```

### Sign Out
```typescript
const { error } = await supabase.auth.signOut();

if (error) {
  toast.error('Failed to sign out');
  return;
}

navigate('/');
```

## Edge Functions

### Calling idea-framework-consultant
```typescript
const { data, error } = await supabase.functions.invoke('idea-framework-consultant', {
  body: {
    message: userMessage,
    diagnosticScores: scores,
    chatHistory: history,
  }
});

if (error) {
  console.error('Function error:', error);
  toast.error('Failed to get AI response');
  return null;
}

return data.response;
```

## Loading States

```typescript
function BrandProfile() {
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      setIsLoading(true);

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .single();

      if (error) {
        console.error('Load error:', error);
        toast.error('Failed to load profile');
      } else {
        setProfile(data);
      }

      setIsLoading(false);
    }

    loadProfile();
  }, []);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return <div>{profile?.full_name}</div>;
}
```

## Error Toast Patterns

```typescript
// Database errors
toast.error('Unable to save changes. Please try again.');

// Auth errors
toast.error('Invalid email or password.');

// Network errors
toast.error('Connection lost. Please check your internet.');

// Permission errors
toast.error('You don\'t have permission to perform this action.');

// General errors
toast.error('Something went wrong. Please try again.');
```

## DO NOT Modify

**Never manually edit:**
- `src/integrations/supabase/types.ts` (auto-generated)
- Supabase Edge Function code (edit in Supabase dashboard)

**Database schema changes:**
- Make changes in Supabase dashboard
- Regenerate types if needed
