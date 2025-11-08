# Coding Conventions - IDEA Brand Coach

## TypeScript Rules (Strict)

```typescript
// ✅ GOOD
function calculateScore(responses: Response[]): number {
  return responses.reduce((sum, r) => sum + r.score, 0);
}

// ❌ BAD
function calculateScore(responses: any): any {
  return responses.reduce((sum, r) => sum + r.score, 0);
}
```

**Rules:**
- Explicit return types on all functions
- NO `any` types - use `unknown` with type guards
- Interface over type for object shapes
- Props interfaces for every component

## React Patterns

### Component Structure
```typescript
// 1. Imports
import { useState } from 'react';
import { toast } from 'sonner';

// 2. Types
interface BrandDiagnosticProps {
  onComplete: (score: number) => void;
}

// 3. Component
export function BrandDiagnostic({ onComplete }: BrandDiagnosticProps) {
  // Hooks first
  const [score, setScore] = useState(0);

  // Event handlers
  const handleSubmit = () => {
    onComplete(score);
  };

  // Render
  return <div>...</div>;
}
```

### Hooks
- Custom hooks: `use` prefix (`useBrandData`, `useAuth`)
- Hook order: useState → useEffect → custom hooks → event handlers
- Extract complex logic to custom hooks

### State Management
- **Local state:** `useState` for component-specific state
- **Global state:** `BrandContext` for brand-related data
- **Server state:** React Query for API data
- **NO prop drilling:** Use Context API for deep props

## Naming Conventions

```typescript
// Components: PascalCase
BrandDiagnostic.tsx
IdeaFrameworkConsultant.tsx

// Hooks: camelCase with 'use'
useBrandData.ts
useAuthSession.ts

// Utilities: camelCase
formatDate.ts
calculateScore.ts

// Constants: UPPER_SNAKE_CASE
API_ENDPOINTS.ts
ERROR_MESSAGES.ts

// Types/Interfaces: PascalCase
BrandProfile
DiagnosticResponse

// Event handlers: 'handle' prefix
handleSubmit
handleInputChange

// Boolean props: is/has/can prefix
isLoading
hasError
canEdit
```

## File Organization

```
src/
├── components/
│   ├── ui/              # shadcn-ui (DO NOT MODIFY)
│   ├── brand/           # Brand-specific components
│   └── research/        # Research tools
├── contexts/            # React Context providers
├── hooks/               # Custom hooks
├── integrations/
│   └── supabase/        # Supabase client & types
├── lib/                 # Utility libraries
├── pages/               # Route pages
├── types/               # TypeScript types
└── utils/               # Helper functions
```

## Import Order

```typescript
// 1. React & external libraries
import { useState } from 'react';
import { toast } from 'sonner';

// 2. Internal modules (absolute imports with @/)
import { Button } from '@/components/ui/button';
import { useBrandData } from '@/hooks/useBrandData';

// 3. Relative imports
import { calculateScore } from './utils';

// 4. Types
import type { BrandProfile } from '@/types/profile';
```

## Error Handling Pattern

```typescript
// ✅ GOOD: User-friendly + logging
try {
  const { data, error } = await supabase.from('profiles').select('*');
  if (error) throw error;
  return data;
} catch (error) {
  console.error('Failed to load profile:', error);
  toast.error('Unable to load your profile. Please try again.');
  return null;
}

// ❌ BAD: Technical error shown to user
try {
  const { data, error } = await supabase.from('profiles').select('*');
  if (error) throw error;
  return data;
} catch (error) {
  toast.error(error.message); // Shows: "PGRST116: relation 'profiles' does not exist"
}
```

## Best Practices Reference

This project follows [@matthewkerns/software-development-best-practices-guide](https://github.com/MatthewKerns/software-development-best-practices-guide)

**Installed location:** `node_modules/@matthewkerns/software-development-best-practices-guide/`

**Key guides:**
- Variable naming: `01-foundations/VARIABLE_NAMING.md`
- Function design: `01-foundations/FUNCTIONS_AND_ROUTINES.md`
- Error handling: `01-foundations/ERROR_HANDLING.md`
- Component design: `02-design-in-code/CLASS_DESIGN.md`
