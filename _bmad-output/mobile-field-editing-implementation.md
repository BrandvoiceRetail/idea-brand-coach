# Mobile Field Editing - Implementation Guide

## Phase 1: Core Components (Week 1)

### 1.1 Field Extraction Badges Component
**File:** `src/components/v2/FieldExtractionBadges.tsx`

```typescript
interface FieldExtractionBadgesProps {
  extractedFields: Record<string, any>
  onFieldClick: (fieldId: string) => void
}

export function FieldExtractionBadges({
  extractedFields,
  onFieldClick
}: FieldExtractionBadgesProps) {
  return (
    <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t animate-in fade-in duration-300">
      {Object.entries(extractedFields).map(([fieldId, value]) => (
        <Badge
          key={fieldId}
          variant="success"
          className="cursor-pointer hover:scale-105 transition-transform"
          onClick={() => onFieldClick(fieldId)}
        >
          <Plus className="h-3 w-3 mr-1" />
          {getFieldLabel(fieldId)}
        </Badge>
      ))}
    </div>
  )
}
```

### 1.2 Field Review Overlay (One-at-a-Time)
**File:** `src/components/v2/FieldReviewOverlay.tsx`

```typescript
interface FieldReviewOverlayProps {
  pendingExtractions: FieldExtraction[]
  onAcceptField: (fieldId: string) => void
  onRejectField: (fieldId: string) => void
  onAcceptAll: () => void
  onClose: () => void
}

export function FieldReviewOverlay({
  pendingExtractions,
  onAcceptField,
  onRejectField,
  onAcceptAll,
  onClose
}: FieldReviewOverlayProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const currentExtraction = pendingExtractions[currentIndex]

  const handleAccept = () => {
    onAcceptField(currentExtraction.fieldId)
    moveToNext()
  }

  const handleReject = () => {
    onRejectField(currentExtraction.fieldId)
    moveToNext()
  }

  const handleAcceptAll = () => {
    // Accept current and all remaining
    pendingExtractions.slice(currentIndex).forEach(extraction => {
      onAcceptField(extraction.fieldId)
    })
    onClose()
  }

  const moveToNext = () => {
    if (currentIndex < pendingExtractions.length - 1) {
      setCurrentIndex(currentIndex + 1)
    } else {
      onClose() // Auto-dismiss after last field
    }
  }

  // Swipe gesture handling
  const [touchStart, setTouchStart] = useState(0)
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX)
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEnd = e.changedTouches[0].clientX
    const diff = touchEnd - touchStart

    if (Math.abs(diff) > 50) { // Minimum swipe distance
      if (diff > 0) {
        handleAccept() // Swipe right = accept
      } else {
        handleReject() // Swipe left = reject
      }
    }
  }

  if (!currentExtraction) return null

  return (
    <Sheet open={pendingExtractions.length > 0} onOpenChange={onClose}>
      <SheetContent
        side="bottom"
        className="h-[30vh]"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between">
            Field Update
            <Badge variant="outline" className="text-xs">
              {currentIndex + 1} of {pendingExtractions.length}
            </Badge>
          </SheetTitle>
        </SheetHeader>

        <div className="flex flex-col items-center justify-center py-4">
          <h3 className="text-lg font-semibold mb-4">
            {getFieldLabel(currentExtraction.fieldId)}
          </h3>

          <div className="space-y-2 w-full">
            <div className="text-sm text-muted-foreground">
              <span className="font-medium">Was:</span>{' '}
              {currentExtraction.previousValue || '(empty)'}
            </div>
            <div className="text-sm">
              <span className="font-medium">Now:</span>{' '}
              {currentExtraction.value}
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-auto">
          <Button
            variant="outline"
            onClick={handleReject}
            className="flex-1"
          >
            <X className="h-4 w-4 mr-1" />
            Reject
          </Button>
          <Button
            onClick={handleAccept}
            className="flex-1"
          >
            <Check className="h-4 w-4 mr-1" />
            Accept
          </Button>
          {pendingExtractions.length > 1 && (
            <Button
              variant="secondary"
              onClick={handleAcceptAll}
            >
              Accept All
            </Button>
          )}
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-1 mt-3">
          {pendingExtractions.map((_, index) => (
            <div
              key={index}
              className={cn(
                "h-1.5 w-1.5 rounded-full transition-colors",
                index === currentIndex ? "bg-primary" : "bg-muted"
              )}
            />
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}
```

### 1.3 Floating Field Editor
**File:** `src/components/v2/FloatingFieldEditor.tsx`

```typescript
export function FloatingFieldEditor({
  field,
  value,
  source,
  onSave,
  onClose
}: FloatingFieldEditorProps) {
  const [localValue, setLocalValue] = useState(value)

  return (
    <Dialog open={!!field} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] mx-4">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            {field?.label}
            <Badge variant={source === 'ai' ? 'secondary' : 'outline'}>
              {source === 'ai' ? <Bot className="h-3 w-3 mr-1" /> : <Pencil className="h-3 w-3 mr-1" />}
              {source}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <Textarea
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          placeholder={field?.placeholder}
          className="min-h-[100px]"
        />

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onSave(localValue)}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

### 1.4 Enhanced Chat Input Bar
**File:** Update `src/pages/v2/BrandCoachV2.tsx`

```typescript
// Add to chat input section
<div className="border-t bg-background p-4">
  <div className="flex items-center gap-2">
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setDocumentUploadOpen(true)}
    >
      <Paperclip className="h-4 w-4" />
    </Button>

    <Input
      ref={inputRef}
      value={userMessage}
      onChange={(e) => setUserMessage(e.target.value)}
      onKeyPress={handleKeyPress}
      placeholder="Ask Trevor anything..."
      className="flex-1"
    />

    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={autoAcceptEnabled ? "default" : "outline"}
            size="icon"
            onClick={() => setAutoAcceptEnabled(!autoAcceptEnabled)}
          >
            {autoAcceptEnabled ? <Check className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {autoAcceptEnabled ? "Auto-accept enabled" : "Review mode"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>

    <Button
      onClick={handleSendMessage}
      disabled={isLoading || !userMessage.trim()}
    >
      <Send className="h-4 w-4" />
    </Button>
  </div>

  {/* Tab navigation for mobile */}
  <div className="flex justify-around mt-2 pt-2 border-t md:hidden">
    <Button
      variant={activeTab === 'chat' ? 'default' : 'ghost'}
      size="sm"
      onClick={() => setActiveTab('chat')}
    >
      Chat
    </Button>
    <Button
      variant={activeTab === 'fields' ? 'default' : 'ghost'}
      size="sm"
      onClick={() => setActiveTab('fields')}
    >
      Fields {savedFieldCount > 0 && `(${savedFieldCount})`}
    </Button>
    <Button
      variant={activeTab === 'progress' ? 'default' : 'ghost'}
      size="sm"
      onClick={() => setActiveTab('progress')}
    >
      Progress
    </Button>
  </div>
</div>
```

## Phase 2: Progressive Disclosure (Week 2)

### 2.1 Progressive Chapter Visibility Hook
**File:** `src/hooks/useProgressiveDisclosure.ts`

```typescript
export function useProgressiveDisclosure(fieldValues: Record<string, any>) {
  const [visibleChapters, setVisibleChapters] = useState<Set<string>>(new Set())
  const [currentStep, setCurrentStep] = useState(1)
  const [maxStep, setMaxStep] = useState(1)

  useEffect(() => {
    // Calculate which chapters should be visible
    const newVisibleChapters = new Set<string>()
    let highestPopulatedChapter = 0

    CHAPTER_ORDER.forEach((chapterId, index) => {
      const chapter = CHAPTER_FIELDS_MAP[chapterId]
      const hasPopulatedFields = chapter.fields?.some(
        field => fieldValues[field.id] && String(fieldValues[field.id]).trim()
      )

      if (hasPopulatedFields) {
        newVisibleChapters.add(chapterId)
        highestPopulatedChapter = Math.max(highestPopulatedChapter, index + 1)
      }
    })

    // Always show at least the first chapter
    if (newVisibleChapters.size === 0) {
      newVisibleChapters.add(CHAPTER_ORDER[0])
    }

    setVisibleChapters(newVisibleChapters)
    setMaxStep(highestPopulatedChapter || 1)
  }, [fieldValues])

  return {
    visibleChapters,
    currentStep,
    maxStep,
    progressText: `Step ${currentStep} of ${maxStep}`
  }
}
```

### 2.2 Recently Updated Fields Component
**File:** `src/components/v2/RecentlyUpdatedFields.tsx`

```typescript
export function RecentlyUpdatedFields({
  recentUpdates,
  onFieldClick
}: RecentlyUpdatedFieldsProps) {
  return (
    <div className="space-y-2">
      <h3 className="font-semibold text-sm text-muted-foreground">
        Recently Updated
      </h3>

      {recentUpdates.map(update => (
        <Card
          key={update.fieldId}
          className="p-3 cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => onFieldClick(update.fieldId)}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="font-medium text-sm">{update.label}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {truncate(update.value, 50)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={update.source === 'ai' ? 'secondary' : 'outline'} className="text-xs">
                {update.source}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {formatRelativeTime(update.timestamp)}
              </span>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
```

## Phase 3: Polish & Delight (Week 3)

### 3.1 Animation Utilities
**File:** `src/lib/animations.ts`

```typescript
export const animations = {
  fieldBadgeAppear: {
    initial: { opacity: 0, scale: 0.9 },
    animate: { opacity: 1, scale: 1 },
    transition: { duration: 0.3, ease: 'easeOut' }
  },

  reviewOverlay: {
    initial: { y: '100%' },
    animate: { y: 0 },
    exit: { y: '100%' },
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 30
    }
  },

  progressUpdate: {
    transition: { duration: 0.6, ease: 'easeInOut' }
  },

  chapterComplete: {
    scale: [1, 1.2, 1],
    transition: { duration: 0.5 }
  }
}
```

### 3.2 Celebration Component
**File:** `src/components/v2/CelebrationOverlay.tsx`

```typescript
export function CelebrationOverlay({
  type,
  message,
  onDismiss
}: CelebrationOverlayProps) {
  const confettiConfig = {
    50: { particleCount: 50, spread: 45, colors: ['#3B82F6'] },
    75: { particleCount: 75, spread: 60, colors: ['#8B5CF6'] },
    100: { particleCount: 100, spread: 70, colors: ['#10B981', '#F59E0B'] }
  }

  useEffect(() => {
    if (type && confettiConfig[type]) {
      confetti(confettiConfig[type])
    }
  }, [type])

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <Card className="p-6 text-center max-w-sm">
            <h2 className="text-2xl font-bold mb-2">
              {type === 100 ? '🎉 Complete!' : '🎊 Milestone!'}
            </h2>
            <p className="text-muted-foreground mb-4">{message}</p>
            <Button onClick={onDismiss}>Continue</Button>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```

## State Management Updates

### Enhanced Message Type
**File:** `src/types/chat.ts`

```typescript
export interface EnhancedMessage extends Message {
  extractedFields?: {
    fieldId: string
    value: string
    confidence: number
    previousValue?: string
  }[]
  celebrationTrigger?: 'chapter' | 'milestone' | 'complete'
}
```

### Field Extraction State
**File:** `src/hooks/useFieldExtractionV2.ts`

Add to existing hook:

```typescript
interface FieldExtractionState {
  pendingExtractions: FieldExtraction[]
  recentlyUpdated: FieldUpdate[]
  autoAcceptEnabled: boolean
  reviewOverlayVisible: boolean
}

// Add state management
const [extractionState, setExtractionState] = useState<FieldExtractionState>({
  pendingExtractions: [],
  recentlyUpdated: [],
  autoAcceptEnabled: false,
  reviewOverlayVisible: false
})

// Track recently updated
const addToRecentlyUpdated = useCallback((update: FieldUpdate) => {
  setExtractionState(prev => ({
    ...prev,
    recentlyUpdated: [
      update,
      ...prev.recentlyUpdated.slice(0, 9) // Keep last 10
    ]
  }))
}, [])
```

## Testing Checklist

### Functional Tests
- [ ] Field badges appear after AI extraction
- [ ] Tap on badge opens field editor
- [ ] Review overlay shows before/after
- [ ] Accept All works correctly
- [ ] Auto-accept toggle persists
- [ ] Recently updated shows last 10 fields
- [ ] Progressive disclosure reveals chapters
- [ ] Tab navigation switches views
- [ ] Fields auto-save on blur
- [ ] Progress updates in real-time

### Visual Tests
- [ ] Animations run smoothly (60fps)
- [ ] Touch targets ≥ 44x44px
- [ ] Overlays dismiss properly
- [ ] Celebration appears at milestones
- [ ] Source badges display correctly
- [ ] Mobile keyboard doesn't break layout

### Accessibility Tests
- [ ] Screen reader announces extractions
- [ ] Keyboard navigation works
- [ ] Focus management correct
- [ ] ARIA labels present
- [ ] Color contrast passes WCAG AA

## Performance Optimizations

### 1. Debounced Auto-Save
```typescript
const debouncedSave = useMemo(
  () => debounce((fieldId: string, value: string) => {
    saveFieldToDatabase(fieldId, value)
  }, 500),
  []
)
```

### 2. Virtual Scrolling for Long Field Lists
```typescript
import { Virtuoso } from 'react-virtuoso'

<Virtuoso
  data={fields}
  itemContent={(index, field) => (
    <ChapterFieldSet field={field} />
  )}
/>
```

### 3. Lazy Load Celebration Library
```typescript
const confetti = lazy(() => import('canvas-confetti'))
```

## Deployment Strategy

### Week 1: Alpha Testing
- Deploy to staging environment
- Internal team testing
- Collect performance metrics

### Week 2: Beta Release
- 10% rollout to users
- A/B test auto-accept default
- Monitor engagement metrics

### Week 3: Full Release
- 100% rollout
- Marketing announcement
- Support documentation ready

---

*This implementation guide will be updated as development progresses.*