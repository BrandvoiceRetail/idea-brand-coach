# Unified Implementation Plan - Adaptive Components

## Development Strategy: Build Once, Adapt Everywhere

### Core Architecture

```typescript
// Responsive hook for consistent breakpoint detection
export const useDeviceType = () => {
  const isMobile = useMediaQuery('(max-width: 767px)')
  const isTablet = useMediaQuery('(min-width: 768px) and (max-width: 1023px)')
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  return { isMobile, isTablet, isDesktop }
}
```

---

## Phase 1: Core Adaptive Components (Week 1)

### 1.1 Adaptive Field Review Component

**Single Component, Multiple Presentations**

```typescript
// src/components/v2/AdaptiveFieldReview.tsx
export function AdaptiveFieldReview({
  pendingExtractions,
  onAcceptField,
  onRejectField,
  onAcceptAll,
  onClose
}: FieldReviewProps) {
  const { isMobile, isDesktop } = useDeviceType()

  if (isMobile) {
    return (
      <MobileFieldReview
        {...props}
        presentation="bottom-sheet"
        swipeEnabled={true}
        oneAtATime={true}
      />
    )
  }

  if (isDesktop) {
    return (
      <DesktopFieldReview
        {...props}
        presentation="sidebar"
        keyboardShortcuts={true}
        showPreview={true}
      />
    )
  }

  // Tablet: hybrid approach
  return (
    <TabletFieldReview
      {...props}
      presentation="modal"
      oneAtATime={true}
    />
  )
}
```

### 1.2 Field Extraction Badges - Universal Component

```typescript
// src/components/v2/FieldExtractionBadges.tsx
export function FieldExtractionBadges({
  extractedFields,
  onFieldClick
}: FieldExtractionBadgesProps) {
  const { isDesktop } = useDeviceType()
  const [hoveredField, setHoveredField] = useState<string | null>(null)

  return (
    <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t animate-in fade-in duration-300">
      {Object.entries(extractedFields).map(([fieldId, value]) => (
        <TooltipProvider key={fieldId}>
          <Tooltip open={isDesktop && hoveredField === fieldId}>
            <TooltipTrigger asChild>
              <Badge
                variant="success"
                className={cn(
                  "cursor-pointer transition-transform",
                  isDesktop && "hover:scale-105"
                )}
                onClick={() => onFieldClick(fieldId)}
                onMouseEnter={() => isDesktop && setHoveredField(fieldId)}
                onMouseLeave={() => setHoveredField(null)}
              >
                <Plus className="h-3 w-3 mr-1" />
                {getFieldLabel(fieldId)}
                {/* Desktop only: show truncated value inline */}
                {isDesktop && (
                  <span className="ml-2 text-xs opacity-70 max-w-[100px] truncate">
                    "{value}"
                  </span>
                )}
              </Badge>
            </TooltipTrigger>
            {isDesktop && (
              <TooltipContent>
                <p className="max-w-xs">{value}</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      ))}
    </div>
  )
}
```

### 1.3 Progressive Disclosure Container

```typescript
// src/components/v2/ProgressiveFieldContainer.tsx
export function ProgressiveFieldContainer({
  chapters,
  fieldValues,
  onFieldEdit
}: ProgressiveFieldContainerProps) {
  const { isMobile, isDesktop } = useDeviceType()
  const { visibleChapters, currentStep, maxStep } = useProgressiveDisclosure(fieldValues)

  if (isMobile) {
    return (
      <MobileTabView
        chapters={visibleChapters}
        currentStep={currentStep}
        maxStep={maxStep}
      />
    )
  }

  return (
    <DesktopSidebarView
      chapters={chapters}
      visibleChapters={visibleChapters}
      currentStep={currentStep}
      maxStep={maxStep}
      sections={[
        { id: 'recent', title: 'Recently Updated', collapsible: false },
        { id: 'active', title: 'Active Chapters', collapsible: true },
        { id: 'all', title: 'All Chapters', collapsible: true, collapsed: true }
      ]}
    />
  )
}
```

### 1.4 Recently Updated Widget

```typescript
// src/components/v2/RecentlyUpdatedWidget.tsx
export function RecentlyUpdatedWidget({
  updates,
  onFieldClick
}: RecentlyUpdatedWidgetProps) {
  const { isMobile, isDesktop } = useDeviceType()

  // Mobile: Collapsible section or dedicated tab
  // Desktop: Always visible in sidebar
  // No drag to reorder - keep it simple

  return (
    <div className={cn(
      "space-y-2",
      isMobile && "px-4",
      isDesktop && "sticky top-0"
    )}>
      <h3 className="font-semibold text-sm text-muted-foreground flex items-center justify-between">
        Recently Updated
        {updates.length > 5 && isDesktop && (
          <Button variant="ghost" size="sm" onClick={onViewAll}>
            View All
          </Button>
        )}
      </h3>

      <div className="space-y-1">
        {updates.slice(0, isMobile ? 5 : 10).map(update => (
          <RecentFieldCard
            key={update.id}
            update={update}
            onClick={() => onFieldClick(update.fieldId)}
            compact={isMobile}
            showKeyboardHint={isDesktop}
          />
        ))}
      </div>
    </div>
  )
}
```

---

## Phase 2: Input & Navigation (Week 1-2)

### 2.1 Adaptive Chat Input Bar

```typescript
// src/components/v2/AdaptiveChatInput.tsx
export function AdaptiveChatInput({
  onSend,
  onDocumentUpload,
  autoAcceptEnabled,
  onAutoAcceptToggle
}: ChatInputProps) {
  const { isMobile, isDesktop } = useDeviceType()

  // Keyboard shortcuts for desktop
  useEffect(() => {
    if (!isDesktop) return

    const handleKeyboard = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        switch(e.key) {
          case 'Enter': handleSend(); break
          case '/': focusInput(); break
        }
      }
    }

    window.addEventListener('keydown', handleKeyboard)
    return () => window.removeEventListener('keydown', handleKeyboard)
  }, [isDesktop])

  return (
    <div className="border-t bg-background">
      <div className="p-4">
        {/* Input row */}
        <div className="flex items-center gap-2">
          {/* Same components, different layouts */}
        </div>

        {/* Mobile: Tab navigation below input */}
        {isMobile && (
          <TabNavigation className="mt-2 pt-2 border-t" />
        )}

        {/* Desktop: Keyboard hints */}
        {isDesktop && (
          <div className="text-xs text-muted-foreground mt-2">
            Press ⌘+Enter to send • ⌘+/ to focus
          </div>
        )}
      </div>
    </div>
  )
}
```

### 2.2 Unified Navigation System

```typescript
// src/components/v2/UnifiedNavigation.tsx
export function UnifiedNavigation() {
  const { isMobile, isDesktop } = useDeviceType()
  const [activeView, setActiveView] = useState<'chat' | 'fields' | 'progress'>('chat')

  // Desktop: Keyboard navigation
  useKeyboardShortcuts({
    'cmd+1': () => setActiveView('chat'),
    'cmd+2': () => setActiveView('fields'),
    'cmd+3': () => setActiveView('progress'),
  })

  if (isMobile) {
    return <MobileBottomTabs activeView={activeView} onChange={setActiveView} />
  }

  return <DesktopViewSwitcher activeView={activeView} onChange={setActiveView} />
}
```

---

## Phase 3: Polish & Platform Optimizations (Week 2)

### 3.1 Platform-Specific Enhancements

```typescript
// src/hooks/usePlatformFeatures.ts
export function usePlatformFeatures() {
  const { isMobile, isDesktop } = useDeviceType()

  return {
    // Mobile features
    swipeGestures: isMobile,
    bottomSheet: isMobile,
    compactMode: isMobile,

    // Desktop features
    keyboardShortcuts: isDesktop,
    hoverPreviews: isDesktop,
    sidebarLayout: isDesktop,
    richTooltips: isDesktop,
    contextMenus: isDesktop,

    // Shared features
    animations: true,
    autoSave: true,
    progressiveDisclosure: true
  }
}
```

### 3.2 Celebration System

```typescript
// src/components/v2/AdaptiveCelebration.tsx
export function AdaptiveCelebration({ type, message }: CelebrationProps) {
  const { isMobile, isDesktop } = useDeviceType()

  // Same celebration, different intensity
  const particleCount = isMobile ? 50 : 100
  const spread = isMobile ? 45 : 70

  return (
    <CelebrationOverlay
      particleCount={particleCount}
      spread={spread}
      fullScreen={isMobile}
      corner={isDesktop} // Desktop: corner notification
    />
  )
}
```

---

## Implementation Schedule

### Week 1: Foundation
**Days 1-2: Core Components**
- [ ] AdaptiveFieldReview
- [ ] FieldExtractionBadges
- [ ] useDeviceType hook
- [ ] Basic responsive layouts

**Days 3-4: Progressive Disclosure**
- [ ] ProgressiveFieldContainer
- [ ] RecentlyUpdatedWidget
- [ ] Chapter visibility logic
- [ ] Step counter

**Day 5: Input & Navigation**
- [ ] AdaptiveChatInput
- [ ] UnifiedNavigation
- [ ] Auto-accept toggle
- [ ] Basic keyboard shortcuts

### Week 2: Polish & Testing
**Days 1-2: Platform Optimizations**
- [ ] Desktop keyboard shortcuts
- [ ] Mobile swipe gestures
- [ ] Hover states & tooltips
- [ ] Context menus

**Days 3-4: Celebrations & Feedback**
- [ ] Celebration animations
- [ ] Progress milestones
- [ ] Field update animations
- [ ] Success states

**Day 5: Testing & Refinement**
- [ ] Cross-browser testing
- [ ] Performance optimization
- [ ] Accessibility audit
- [ ] Bug fixes

---

## Testing Matrix

| Component | Mobile | Tablet | Desktop | Tests |
|-----------|--------|--------|---------|-------|
| Field Review | Bottom sheet, swipe | Modal | Sidebar, keyboard | ✓ |
| Extraction Badges | Tap only | Tap only | Hover + tap | ✓ |
| Recently Updated | Tab/drawer | Section | Sidebar widget | ✓ |
| Navigation | Bottom tabs | Bottom tabs | View switcher | ✓ |
| Input Bar | Above keyboard | Floating | Docked | ✓ |
| Celebrations | Full screen | Modal | Corner | ✓ |

---

## Key Technical Decisions

### 1. CSS Strategy
```scss
// Mobile-first with desktop enhancements
.field-badge {
  @apply cursor-pointer; // Works everywhere

  @screen md {
    @apply hover:scale-105; // Desktop only
  }
}
```

### 2. State Management
- Single source of truth for field values
- Platform-specific UI state only
- Shared business logic

### 3. Bundle Optimization
```typescript
// Lazy load desktop-only features
const ContextMenu = lazy(() =>
  import(/* webpackChunkName: "desktop" */ './ContextMenu')
)
```

### 4. Performance Targets
- Mobile: First paint < 1.5s
- Desktop: First paint < 1s
- Animations: 60fps on all platforms
- Bundle size: < 200KB initial

---

## Success Metrics

### Universal Metrics
- Field completion rate > 80%
- Auto-accept usage > 60%
- Average time to 50% complete < 10 min

### Mobile Specific
- Touch target accuracy > 95%
- Swipe gesture success > 90%
- Bottom sheet dismissal < 5% accidental

### Desktop Specific
- Keyboard shortcut usage > 40%
- Hover preview engagement > 70%
- Sidebar collapse/expand < 20%

---

*Building unified adaptive components ensures consistency while optimizing for each platform's strengths.*