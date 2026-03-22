# Field Visibility Improvements - Implementation Plan

## Current Gaps in Field Text Management

Based on comparison with the demo, our current V2 implementation lacks:

1. **No visual indication when fields are extracted from chat**
2. **No source attribution (AI vs manual) on fields**
3. **Hidden field extraction process**
4. **No celebration of progress**
5. **No field count visibility**

## Quick Wins (Can implement today)

### 1. Show Extracted Fields in Chat Messages

**File:** `src/pages/v2/BrandCoachV2.tsx`

Add after line 720 (in message rendering):

```typescript
{/* Show extracted fields for this message */}
{msg.metadata?.extractedFields && Object.keys(msg.metadata.extractedFields).length > 0 && (
  <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-border/50">
    {Object.entries(msg.metadata.extractedFields).map(([fieldId, value]) => {
      const fieldLabel = Object.values(CHAPTER_FIELDS_MAP)
        .flatMap(ch => ch.fields || [])
        .find(f => f.id === fieldId)?.label || fieldId;

      return (
        <Badge key={fieldId} variant="success" className="text-xs">
          <Plus className="h-3 w-3 mr-1" />
          {fieldLabel}
        </Badge>
      );
    })}
  </div>
)}
```

### 2. Add Source Badges to Fields

**File:** `src/components/v2/ChapterFieldSet.tsx`

Modify the field rendering to include source badges:

```typescript
<div className="flex items-center gap-2 mb-1">
  <Label htmlFor={field.id} className="text-sm">
    {field.label}
    {field.required && <span className="text-destructive ml-1">*</span>}
  </Label>

  {/* Add source badge */}
  {fieldSources?.[field.id] === 'manual' && (
    <Badge variant="outline" className="text-xs h-4 px-1">
      <Edit2 className="h-2 w-2 mr-1" />
      edited
    </Badge>
  )}
  {fieldSources?.[field.id] === 'ai' && !isLocked && (
    <Badge variant="secondary" className="text-xs h-4 px-1">
      <Sparkles className="h-2 w-2 mr-1" />
      AI
    </Badge>
  )}
  {isLocked && (
    <Badge variant="warning" className="text-xs h-4 px-1">
      <Lock className="h-2 w-2 mr-1" />
      locked
    </Badge>
  )}
</div>
```

### 3. Add Field Count to Header

**File:** `src/pages/v2/BrandCoachV2.tsx`

Update header (around line 547):

```typescript
<div className="flex items-center gap-3">
  <h1 className="font-semibold">IDEA Brand Coach</h1>
  <ChapterProgressBadge
    current={progress?.current_chapter_number ?? 1}
    total={11}
  />
  {savedFieldCount > 0 && (
    <Badge variant="outline" className="text-xs text-muted-foreground">
      <CheckCircle className="h-3 w-3 mr-1" />
      {savedFieldCount} fields saved
    </Badge>
  )}
  {/* Add field completion indicator */}
  <Badge variant={completionRate > 75 ? "success" : "secondary"} className="text-xs">
    {Math.round(completionRate)}% complete
  </Badge>
</div>
```

### 4. Track Extracted Fields in Messages

**File:** `src/hooks/useFieldExtractionV2.ts`

Modify the extraction to return what was extracted:

```typescript
const extractFields = useCallback((rawResponse: string): ExtractResult => {
  const result = baseHook.extractFields(rawResponse);

  // Track what was actually extracted
  const extractedInThisMessage: Record<string, any> = {};

  if (result.success && result.extractedFields) {
    Object.entries(result.extractedFields).forEach(([fieldId, value]) => {
      if (!lockedFields.has(fieldId)) {
        extractedInThisMessage[fieldId] = value;
      }
    });
  }

  return {
    ...result,
    extractedInThisMessage // Add this for UI display
  };
}, [baseHook, lockedFields]);
```

### 5. Add Stage-Based Progress

Create a progress calculator:

```typescript
// Add to BrandCoachV2.tsx
const calculateStageProgress = () => {
  const currentChapterFields = CHAPTER_FIELDS_MAP[currentChapter?.id] || [];
  const filledFields = currentChapterFields.filter(field =>
    fieldValues[field.id] && fieldValues[field.id].trim()
  );
  return (filledFields.length / currentChapterFields.length) * 100;
};

const stageProgress = calculateStageProgress();
```

## Medium-Term Improvements (1-2 days)

### 1. Structured JSON Response from Edge Function

Modify the edge function to return structured data:

```typescript
// In idea-framework-consultant/index.ts
return new Response(JSON.stringify({
  message: assistantMessage,
  extractedFields: extractedData,
  metadata: {
    chapterId: context.chapterId,
    confidence: confidenceScores,
    suggestedNextField: nextField
  }
}), {
  headers: { 'Content-Type': 'application/json' }
});
```

### 2. Visual Field Animation

Add animations when fields are populated:

```typescript
// CSS animation for field updates
@keyframes fieldUpdate {
  0% { background-color: rgb(34 197 94 / 0.1); }
  100% { background-color: transparent; }
}

.field-updated {
  animation: fieldUpdate 2s ease-out;
}
```

### 3. Two-Panel Toggle View

Add tabs to switch between chat and fields:

```typescript
<Tabs defaultValue="chat" className="flex-1">
  <TabsList className="grid w-full grid-cols-2">
    <TabsTrigger value="chat">
      Coach Chat
    </TabsTrigger>
    <TabsTrigger value="fields">
      Avatar Fields ({completedFieldCount}/{totalFieldCount})
    </TabsTrigger>
  </TabsList>

  <TabsContent value="chat">
    {/* Current chat UI */}
  </TabsContent>

  <TabsContent value="fields">
    {/* Current fields accordion */}
  </TabsContent>
</Tabs>
```

## Implementation Priority

### Phase 1: Immediate (Today)
1. ✅ Field sync to database (DONE)
2. 🔲 Show extracted fields as badges in chat
3. 🔲 Add source indicators to fields
4. 🔲 Add completion percentage

### Phase 2: Tomorrow
1. 🔲 Stage-based progress bars
2. 🔲 Field update animations
3. 🔲 Two-panel toggle

### Phase 3: This Week
1. 🔲 Structured JSON from edge function
2. 🔲 Field suggestions/hints
3. 🔲 Export functionality

## Success Metrics

After implementing these improvements:

- **User can see** which fields were extracted from each message
- **User knows** whether a field came from AI or their edit
- **User tracks** their progress visually
- **User celebrates** as fields are populated
- **User controls** their field values with confidence

## Testing Checklist

- [ ] Chat shows field extraction badges
- [ ] Fields show source (AI/manual/locked)
- [ ] Header shows completion percentage
- [ ] Manual edits show "edited" badge
- [ ] Progress updates in real-time
- [ ] Animations work smoothly
- [ ] Mobile view is responsive

## Code Quality Notes

- All changes should maintain TypeScript strict mode
- Add proper error boundaries for new UI elements
- Ensure accessibility (ARIA labels, keyboard navigation)
- Test with both empty and populated states
- Verify database sync still works

This approach brings the transparency and celebration of the demo while keeping our robust backend architecture.