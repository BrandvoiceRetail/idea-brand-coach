# Two-Panel Responsive Design Architecture

## Purpose
Define the responsive two-panel layout system that adapts seamlessly between desktop and mobile interfaces.

## Audience
Frontend developers, UI/UX designers, and product managers.

## Overview

The v2 interface uses a two-panel design that provides optimal experiences on both desktop and mobile devices. This replaces the three-panel design with a simpler, more maintainable architecture.

## Desktop Layout

### Structure
```
┌─────────────────────────────────────────────────┐
│                    Header                        │
│  [Avatar Tabs] [Brand Name]        [Settings]   │
├─────────────────┬───────────────────────────────┤
│                 │                                │
│   Left Panel    │       Right Panel              │
│                 │                                │
│  Field Editor   │     Chat Interface             │
│                 │                                │
│  - Demographics │    [Book Context Badge]        │
│  - Psychographics│                               │
│  - Behaviors    │    Chat Messages               │
│  - Values       │                                │
│                 │    [📎] [Input] [Send]         │
│                 │                                │
│  [Collapsible]  │                                │
└─────────────────┴───────────────────────────────┘
```

### Dimensions
- **Left Panel**: 320px min, 400px default, 480px max
- **Right Panel**: Flexible width (remaining space)
- **Min Desktop Width**: 768px
- **Optimal Width**: 1280px - 1920px

### Behavior
- Left panel collapsible via toggle button
- Resizable divider between panels
- Panels maintain state across avatar switches
- Keyboard shortcuts for panel focus (Cmd+1, Cmd+2)

## Mobile Layout

### Structure (Portrait)
```
┌──────────────────┐
│     Header       │
│  [≡] Brand [+]   │
├──────────────────┤
│                  │
│  Chat Interface  │
│                  │
│  [Chapter 3/11]  │
│                  │
│   Messages...    │
│                  │
│                  │
├──────────────────┤
│  [📎][Input][↑]  │
├──────────────────┤
│   Avatar Tabs    │
│ [Avatar 1][2][3] │
└──────────────────┘

[Swipe Up for Field Editor]
```

### Field Editor (Bottom Sheet)
```
┌──────────────────┐
│   Field Editor   │
│    ───────       │
│                  │
│  Demographics    │
│  Age: 25-35 ✏️   │
│                  │
│  Psychographics  │
│  Values: [...]   │
│                  │
│  [Swipe to Close]│
└──────────────────┘
```

### Dimensions
- **Mobile Breakpoint**: <768px
- **Bottom Sheet**: 60% screen height default, 90% max
- **Touch Targets**: Minimum 44x44px
- **Safe Areas**: Respect device notches

### Gestures
- **Swipe Up**: Open field editor
- **Swipe Down**: Close field editor
- **Swipe Left/Right**: Switch avatars
- **Pull to Refresh**: Reload chat

## Responsive Breakpoints

```typescript
const breakpoints = {
  mobile: 0,      // 0-767px
  tablet: 768,    // 768-1023px
  desktop: 1024,  // 1024-1279px
  wide: 1280,     // 1280px+
} as const;
```

## Component Implementation

### Layout Container
```typescript
interface TwoPanelLayoutProps {
  leftPanel: ReactNode;
  rightPanel: ReactNode;
  leftPanelWidth?: number;
  collapsible?: boolean;
  resizable?: boolean;
}

const TwoPanelLayout: React.FC<TwoPanelLayoutProps> = ({
  leftPanel,
  rightPanel,
  leftPanelWidth = 400,
  collapsible = true,
  resizable = true,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [width, setWidth] = useState(leftPanelWidth);
  const isMobile = useMediaQuery('(max-width: 767px)');

  if (isMobile) {
    return <MobileLayout left={leftPanel} right={rightPanel} />;
  }

  return (
    <div className="flex h-full">
      {!isCollapsed && (
        <div
          className="border-r"
          style={{ width: `${width}px` }}
        >
          {leftPanel}
        </div>
      )}
      <div className="flex-1">
        {rightPanel}
      </div>
    </div>
  );
};
```

### Mobile Bottom Sheet
```typescript
const MobileFieldEditor: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button className="fixed bottom-20 right-4">
          Edit Fields
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[60vh]">
        <FieldEditor />
      </SheetContent>
    </Sheet>
  );
};
```

## State Management

### Panel State
```typescript
interface PanelState {
  leftPanelCollapsed: boolean;
  leftPanelWidth: number;
  activeFieldSection: string;
  scrollPositions: {
    chat: number;
    fields: number;
  };
}

const usePanelState = () => {
  const [state, setState] = useLocalStorage<PanelState>('panel-state', {
    leftPanelCollapsed: false,
    leftPanelWidth: 400,
    activeFieldSection: 'demographics',
    scrollPositions: { chat: 0, fields: 0 }
  });

  return {
    state,
    toggleLeftPanel: () => setState(s => ({
      ...s,
      leftPanelCollapsed: !s.leftPanelCollapsed
    })),
    setLeftPanelWidth: (width: number) => setState(s => ({
      ...s,
      leftPanelWidth: width
    }))
  };
};
```

## Accessibility Features

### Keyboard Navigation
```typescript
const keyboardShortcuts = {
  'cmd+1': 'Focus left panel',
  'cmd+2': 'Focus right panel',
  'cmd+\\': 'Toggle left panel',
  'cmd+/': 'Focus chat input',
  'esc': 'Close mobile bottom sheet'
};
```

### ARIA Labels
```html
<div role="region" aria-label="Field Editor">
  <!-- Left panel content -->
</div>

<div role="region" aria-label="Chat Interface">
  <!-- Right panel content -->
</div>
```

### Focus Management
```typescript
const useFocusManagement = () => {
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyboard = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === '1') {
        leftPanelRef.current?.focus();
      }
      if (e.metaKey && e.key === '2') {
        rightPanelRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, []);

  return { leftPanelRef, rightPanelRef };
};
```

## Performance Optimizations

### Lazy Loading
```typescript
const FieldEditor = lazy(() => import('./FieldEditor'));
const ChatInterface = lazy(() => import('./ChatInterface'));
```

### Virtual Scrolling
```typescript
// For long chat histories
import { VirtualList } from '@tanstack/react-virtual';

const ChatMessages = ({ messages }) => {
  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 75,
  });

  return (
    <div ref={parentRef} className="overflow-auto">
      {virtualizer.getVirtualItems().map(item => (
        <Message key={item.key} message={messages[item.index]} />
      ))}
    </div>
  );
};
```

### Memoization
```typescript
const FieldSection = memo(({ section, fields }) => {
  return (
    <div className="field-section">
      {/* Render fields */}
    </div>
  );
}, (prev, next) => {
  return JSON.stringify(prev.fields) === JSON.stringify(next.fields);
});
```

## CSS Architecture

### Tailwind Configuration
```javascript
// tailwind.config.js
module.exports = {
  theme: {
    screens: {
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
      '2xl': '1536px',
    },
    extend: {
      width: {
        'panel-min': '320px',
        'panel-default': '400px',
        'panel-max': '480px',
      }
    }
  }
};
```

### Responsive Utilities
```css
/* Mobile-first responsive classes */
.panel-left {
  @apply w-full md:w-panel-default md:min-w-panel-min md:max-w-panel-max;
}

.panel-right {
  @apply w-full md:flex-1;
}

/* Hide on mobile, show on desktop */
.desktop-only {
  @apply hidden md:block;
}

/* Show on mobile, hide on desktop */
.mobile-only {
  @apply block md:hidden;
}
```

## Testing Considerations

### Responsive Testing
```typescript
describe('TwoPanelLayout', () => {
  it('renders two panels on desktop', () => {
    mockViewport(1280, 800);
    render(<TwoPanelLayout />);
    expect(screen.getByRole('region', { name: 'Field Editor' })).toBeVisible();
    expect(screen.getByRole('region', { name: 'Chat Interface' })).toBeVisible();
  });

  it('renders bottom sheet on mobile', () => {
    mockViewport(375, 812);
    render(<TwoPanelLayout />);
    expect(screen.getByRole('button', { name: 'Edit Fields' })).toBeVisible();
  });

  it('handles panel collapse', () => {
    const { getByRole } = render(<TwoPanelLayout />);
    fireEvent.click(getByRole('button', { name: 'Toggle Panel' }));
    expect(screen.queryByRole('region', { name: 'Field Editor' })).not.toBeVisible();
  });
});
```

## Migration from Three-Panel

### Removed Components
- `RightSidePanel.tsx` - Book context now inline
- `ThreePanelLayout.tsx` - Replaced with `TwoPanelLayout.tsx`
- `BookExcerptPanel.tsx` - Integrated into chat

### Component Mapping
| v1 Component | v2 Component | Notes |
|-------------|--------------|-------|
| `ThreePanelLayout` | `TwoPanelLayout` | Simplified structure |
| `BookExcerptPanel` | `ChatContextBadge` | Inline in chat |
| `FieldSidebar` | `FieldEditor` | Enhanced editing |
| `ChatPanel` | `ChatInterface` | Book-aware chat |

## Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Panel Toggle** | <50ms | Time to collapse/expand |
| **Resize Response** | <16ms | Smooth 60fps |
| **Mobile Sheet** | <200ms | Open animation |
| **Layout Shift** | 0 | No content jumping |
| **Touch Response** | <100ms | Immediate feedback |

---

**Last Updated:** February 28, 2026
**Status:** Ready for Implementation