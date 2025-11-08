# UI & Design System - IDEA Brand Coach

## Core Principles

1. **Mobile-First:** Design for mobile, enhance for desktop
2. **Accessible:** WCAG AA minimum (proper labels, contrast, keyboard nav)
3. **Consistent:** Use shadcn-ui components, Tailwind utilities
4. **Fast:** Loading states, optimistic UI, skeleton loaders
5. **Clear:** User-friendly errors, helpful empty states

## shadcn-ui Components

**Location:** `src/components/ui/`

**DO NOT MODIFY** these files directly. They are managed by shadcn-ui.

**Available components:**
- Button, Card, Dialog, Form, Input, Label
- Tabs, Toast (sonner), Select, Checkbox
- Alert, Badge, Progress, Separator
- Accordion, Avatar, Calendar, Dropdown Menu
- and more...

**Usage:**
```typescript
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent } from '@/components/ui/card';

<Card>
  <CardHeader>
    <h2>Brand Diagnostic</h2>
  </CardHeader>
  <CardContent>
    <Button>Start Assessment</Button>
  </CardContent>
</Card>
```

## Tailwind Patterns

### Spacing Scale (4px base)
```tsx
// Padding/Margin
p-4    // 16px
p-6    // 24px
p-8    // 32px

// Gap for flex/grid
gap-4  // 16px
gap-6  // 24px

// Common patterns
className="p-6 space-y-4"  // Card padding with vertical spacing
className="flex gap-2 items-center"  // Horizontal layout
```

### Responsive Design
```tsx
// Mobile-first approach
className="
  p-4 md:p-6 lg:p-8        // Padding increases on larger screens
  grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3  // Column layout
  text-sm md:text-base     // Font size
  w-full md:w-auto         // Width
"
```

### Color Utilities
```tsx
// Text colors
text-foreground          // Primary text
text-muted-foreground    // Secondary text

// Background colors
bg-background            // Page background
bg-card                  // Card background
bg-primary               // Primary actions
bg-destructive           // Danger/delete

// Borders
border-border            // Default border
border-input             // Form inputs
```

## Typography

### Headings
```tsx
<h1 className="text-3xl md:text-4xl font-bold">Page Title</h1>
<h2 className="text-2xl md:text-3xl font-semibold">Section</h2>
<h3 className="text-xl font-semibold">Subsection</h3>
```

### Body Text
```tsx
<p className="text-base text-muted-foreground">
  Regular body text with secondary color
</p>

<p className="text-sm text-muted-foreground">
  Helper text or captions
</p>
```

## Loading States

### Skeleton Loaders
```tsx
import { Skeleton } from '@/components/ui/skeleton';

function LoadingCard() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-48" />
      </CardHeader>
      <CardContent className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </CardContent>
    </Card>
  );
}
```

### Loading Spinners
```tsx
import { Loader2 } from 'lucide-react';

<Button disabled={isLoading}>
  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
  Save Changes
</Button>
```

## Error States

### Error Messages
```tsx
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

<Alert variant="destructive">
  <AlertCircle className="h-4 w-4" />
  <AlertDescription>
    Failed to load data. Please try again.
  </AlertDescription>
</Alert>
```

### Toast Notifications
```tsx
import { toast } from 'sonner';

// Success
toast.success('Profile updated successfully!');

// Error
toast.error('Failed to save changes. Please try again.');

// Loading
toast.loading('Saving changes...');

// Promise-based
toast.promise(saveProfile(), {
  loading: 'Saving...',
  success: 'Profile updated!',
  error: 'Failed to save',
});
```

## Empty States

```tsx
import { FileQuestion } from 'lucide-react';

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <FileQuestion className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold mb-2">No diagnostics yet</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Complete your first brand diagnostic to get started.
      </p>
      <Button>Start Diagnostic</Button>
    </div>
  );
}
```

## Forms

### Form Pattern with Validation
```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const formSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

function LoginForm() {
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    // Handle submission
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="you@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full">
          Sign In
        </Button>
      </form>
    </Form>
  );
}
```

## Accessibility

### ARIA Labels
```tsx
// Buttons without text
<Button aria-label="Close dialog">
  <X className="h-4 w-4" />
</Button>

// Links
<a href="/profile" aria-label="View your profile">
  <Avatar />
</a>
```

### Keyboard Navigation
- All interactive elements must be keyboard accessible
- Use proper focus states (Tailwind: `focus:ring-2 focus:ring-primary`)
- Logical tab order
- Escape key closes dialogs/modals

### Screen Readers
```tsx
// Skip to main content
<a href="#main-content" className="sr-only focus:not-sr-only">
  Skip to main content
</a>

// Live regions for dynamic content
<div role="status" aria-live="polite">
  {loadingMessage}
</div>
```

## Icons

**Library:** `lucide-react`

```tsx
import { Check, X, AlertCircle, Loader2, ChevronRight } from 'lucide-react';

// Usage
<Check className="h-4 w-4 text-green-500" />
<AlertCircle className="h-5 w-5 text-destructive" />
```

## Layout Patterns

### Container
```tsx
<div className="container mx-auto px-4 py-8 max-w-7xl">
  {/* Content */}
</div>
```

### Two-Column Layout
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
  <div>Column 1</div>
  <div>Column 2</div>
</div>
```

### Centered Content
```tsx
<div className="flex items-center justify-center min-h-screen">
  <Card className="w-full max-w-md">
    {/* Centered card */}
  </Card>
</div>
```

## Common UI Patterns

### Page Header
```tsx
function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <div className="mb-8">
      <h1 className="text-3xl font-bold mb-2">{title}</h1>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
}
```

### Action Card
```tsx
<Card className="hover:shadow-lg transition-shadow cursor-pointer">
  <CardHeader>
    <CardTitle>Brand Diagnostic</CardTitle>
    <CardDescription>Assess your brand's current state</CardDescription>
  </CardHeader>
  <CardContent>
    <Button>Get Started</Button>
  </CardContent>
</Card>
```

## Performance Tips

- Use `loading="lazy"` for images
- Implement virtual scrolling for long lists
- Debounce search inputs
- Memoize expensive computations
- Code-split heavy components with `React.lazy()`
