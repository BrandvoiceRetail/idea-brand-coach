# V2 Field Population Integration

Connect the field extraction pipeline to the BrandCoachV2 UI, enabling automatic population of chapter fields from chat conversations with Trevor.

## Context

The field extraction foundation is complete:
- **ChatFieldExtractionService** intercepts raw AI responses and extracts field data
- **SupabaseChatService** returns cleaned content + extracted fields
- **useFieldExtraction hook** (from task 036) handles field parsing and source tracking
- **ChapterSectionAccordion** (from task 034) displays fields with manual edit capability

This spec connects these pieces to create the complete field population flow.

## Architecture Overview

```
User Types in Chat → Trevor Responds with Extraction Blocks
                ↓
    ChatFieldExtractionService (at source)
                ↓
    Extracts Fields + Cleans Content
                ↓
    Returns via ChatResponse.extractedFields
                ↓
    BrandCoachV2 Accumulates Fields
                ↓
    User Clicks "Proceed to Next Section"
                ↓
    Batch Apply to ChapterSectionAccordion
```

## Implementation Plan

### Step 1: Expose Extracted Fields in useChat

**File: `src/hooks/useChat.ts`**

```typescript
export const useChat = (options: UseChatOptions = {}) => {
  // ... existing code ...

  // Mutation: Send message
  const sendMessageMutation = useMutation({
    mutationKey: ['chat', 'sendMessage', chatbotType, sessionId],
    mutationFn: (message: ChatMessageCreate) => chatService.sendMessage({
      ...message,
      chatbot_type: chatbotType,
      ...(chapterId && { chapter_id: chapterId }),
      ...(chapterMetadata && { chapter_metadata: chapterMetadata }),
    }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'messages', chatbotType, sessionId] });

      // NEW: Trigger field extraction callback if provided
      if (options.onFieldsExtracted && data.extractedFields?.length) {
        options.onFieldsExtracted(data.extractedFields);
      }

      // Wait for title generation...
      if (data.titlePromise) {
        data.titlePromise.finally(() => {
          queryClient.invalidateQueries({ queryKey: ['chat', 'sessions', chatbotType] });
        });
      }
    },
    // ... error handling ...
  });

  return {
    // ... existing returns ...
    lastResponse: sendMessageMutation.data,
    extractedFields: sendMessageMutation.data?.extractedFields, // NEW
  };
};
```

### Step 2: Create Field Accumulator Hook

**File: `src/hooks/useFieldAccumulator.ts`**

```typescript
import { useState, useCallback } from 'react';

interface ExtractedField {
  fieldId: string;
  value: string | string[];
  confidence?: number;
  context?: string;
}

interface AccumulatedFields {
  [fieldId: string]: ExtractedField;
}

export function useFieldAccumulator(chapterId?: string) {
  // Accumulated fields for current chapter (not yet applied)
  const [accumulated, setAccumulated] = useState<AccumulatedFields>({});

  // Track if we have pending fields
  const hasPendingFields = Object.keys(accumulated).length > 0;

  // Add new extracted fields to accumulator
  const accumulate = useCallback((fields: ExtractedField[]) => {
    setAccumulated(prev => {
      const updated = { ...prev };

      fields.forEach(field => {
        // Only accumulate if not already present or higher confidence
        if (!updated[field.fieldId] ||
            (field.confidence && updated[field.fieldId].confidence &&
             field.confidence > updated[field.fieldId].confidence)) {
          updated[field.fieldId] = field;
        }
      });

      return updated;
    });
  }, []);

  // Get all accumulated fields as array
  const getAccumulated = useCallback(() => {
    return Object.values(accumulated);
  }, [accumulated]);

  // Clear accumulator (e.g., after applying or chapter change)
  const clear = useCallback(() => {
    setAccumulated({});
  }, []);

  // Remove specific field from accumulator
  const remove = useCallback((fieldId: string) => {
    setAccumulated(prev => {
      const updated = { ...prev };
      delete updated[fieldId];
      return updated;
    });
  }, []);

  return {
    accumulate,
    getAccumulated,
    clear,
    remove,
    hasPendingFields,
    pendingCount: Object.keys(accumulated).length,
    // Direct access to accumulated fields for preview
    accumulated,
  };
}
```

### Step 3: Wire Everything in BrandCoachV2

**File: `src/pages/v2/BrandCoachV2.tsx`**

```typescript
import { useFieldAccumulator } from '@/hooks/useFieldAccumulator';
import { useFieldExtraction } from '@/hooks/useFieldExtraction';

export default function BrandCoachV2() {
  // ... existing state and hooks ...

  // Field extraction and accumulation
  const {
    fieldValues,
    fieldSources,
    setFieldManual,
    mergeExtractedFields,
    clearFields,
  } = useFieldExtraction(currentAvatarId);

  const {
    accumulate,
    getAccumulated,
    clear: clearAccumulator,
    hasPendingFields,
    pendingCount,
  } = useFieldAccumulator(currentChapter?.id);

  // Hook up chat with field extraction callback
  const {
    messages,
    sendMessage,
    isLoading,
    isSending,
    extractedFields, // NEW: Get extracted fields from last response
  } = useChat({
    sessionId: currentSessionId,
    chatbotType: 'idea-framework-consultant',
    chapterId: currentChapter?.id,
    chapterMetadata: currentChapter?.metadata,
    onFieldsExtracted: accumulate, // NEW: Auto-accumulate extracted fields
  });

  // Handle chapter progression
  const handleProceed = async (chapterId: string) => {
    // 1. Apply accumulated fields as batch update
    if (hasPendingFields) {
      const fieldsToApply = getAccumulated();
      mergeExtractedFields(fieldsToApply);
      clearAccumulator();

      // Show success toast
      toast({
        title: 'Fields Updated',
        description: `Applied ${fieldsToApply.length} extracted fields`,
      });
    }

    // 2. Mark chapter complete and advance
    await completeCurrentChapter();

    // 3. Send Trevor a transition message
    const nextChapter = getNextChapter(chapterId);
    if (nextChapter) {
      await sendMessage({
        content: `[SYSTEM] User completed ${currentChapter?.title} and is moving to ${nextChapter.title}`,
        role: 'system' as const,
      });
    }
  };

  // Clear fields when avatar changes
  useEffect(() => {
    if (currentAvatarId) {
      clearFields();
      clearAccumulator();
    }
  }, [currentAvatarId]);

  return (
    <div className="flex flex-col h-screen">
      {/* Header with avatar dropdown and progress */}
      <header className="flex-shrink-0 border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="font-semibold">IDEA Brand Coach</h1>
            <ChapterProgressBadge
              current={progress?.current_chapter_number ?? 1}
              total={11}
            />
            {hasPendingFields && (
              <Badge variant="secondary" className="ml-2">
                {pendingCount} fields pending
              </Badge>
            )}
          </div>
          <AvatarHeaderDropdown />
        </div>
      </header>

      {/* Two-panel layout */}
      <TwoPanelTemplate
        leftPanel={
          <div className="h-full overflow-y-auto p-4">
            {hasPendingFields && (
              <Alert className="mb-4">
                <InfoIcon className="h-4 w-4" />
                <AlertDescription>
                  {pendingCount} fields extracted from conversation.
                  Click "Proceed to Next Section" to apply them.
                </AlertDescription>
              </Alert>
            )}

            <ChapterSectionAccordion
              chapters={allChapters}
              currentChapterId={currentChapter?.id}
              chapterStatuses={progress?.chapter_statuses}
              fieldValues={fieldValues}
              fieldSources={fieldSources}
              onProceed={handleProceed}
              onFieldChange={setFieldManual}
              // Show preview of pending fields
              pendingFields={hasPendingFields ? getAccumulated() : undefined}
            />
          </div>
        }
        rightPanel={
          <ChatPanel
            messages={messages}
            onSendMessage={sendMessage}
            isLoading={isLoading || isSending}
            chapterContext={currentChapter}
          />
        }
        rightPanelTitle={`Brand Coach — ${currentChapter?.title ?? 'Introduction'}`}
      />
    </div>
  );
}
```

### Step 4: Update ChapterSectionAccordion for Pending Fields

**File: `src/components/v2/ChapterSectionAccordion.tsx`**

Add visual indication of pending fields:

```typescript
interface ChapterSectionAccordionProps {
  // ... existing props ...
  pendingFields?: ExtractedField[];
}

export function ChapterSectionAccordion({
  // ... existing props ...
  pendingFields,
}: ChapterSectionAccordionProps) {
  // ... existing code ...

  return (
    <Accordion type="single" value={currentChapterId}>
      {chapters.map((chapter) => {
        const isPending = pendingFields?.some(f =>
          chapter.fields.some(cf => cf.id === f.fieldId)
        );

        return (
          <AccordionItem key={chapter.id} value={chapter.id}>
            <AccordionTrigger>
              <div className="flex items-center gap-2">
                {getChapterIcon(chapter.status)}
                <span>{chapter.title}</span>
                {isPending && (
                  <Badge variant="outline" size="sm">
                    Fields pending
                  </Badge>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              {/* Existing field content */}
              <ChapterFieldSet
                fields={chapter.fields}
                values={fieldValues}
                sources={fieldSources}
                onChange={onFieldChange}
                // Highlight pending fields
                pendingFieldIds={pendingFields?.map(f => f.fieldId)}
              />
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
```

## Testing Strategy

### Unit Tests

**Test: useFieldAccumulator**
```typescript
describe('useFieldAccumulator', () => {
  it('accumulates multiple field extractions');
  it('prefers higher confidence values for same field');
  it('clears accumulator on clear()');
  it('removes specific field on remove()');
  it('tracks pending count correctly');
});
```

**Test: Field extraction flow**
```typescript
describe('Field Extraction Integration', () => {
  it('extracts fields from Trevor response');
  it('accumulates fields without immediate application');
  it('applies fields on chapter proceed');
  it('preserves manual edits over AI suggestions');
  it('clears accumulator on avatar switch');
});
```

### Manual Testing Checklist

1. **Basic Flow**
   - [ ] Start chat with Trevor in Chapter 1
   - [ ] Describe brand → see "X fields pending" badge
   - [ ] Click "Proceed" → fields populate in accordion
   - [ ] Fields show AI source indicator

2. **Manual Override**
   - [ ] Manually edit a field
   - [ ] Continue chat with Trevor
   - [ ] Trevor extracts same field again
   - [ ] Manual edit is preserved (not overwritten)

3. **Accumulation**
   - [ ] Have multiple chat exchanges in one chapter
   - [ ] Each extraction adds to pending count
   - [ ] All fields apply together on proceed

4. **Avatar Switching**
   - [ ] Accumulate some pending fields
   - [ ] Switch avatars
   - [ ] Pending fields cleared
   - [ ] Start fresh with new avatar

5. **Edge Cases**
   - [ ] Malformed extraction blocks ignored
   - [ ] Empty extractions don't create pending badge
   - [ ] Duplicate field IDs use highest confidence

## Success Metrics

- Zero fields lost during extraction
- 100% of valid extraction blocks processed
- Manual edits never overwritten by AI
- Accumulator state persists during chapter conversation
- Clear visual feedback for pending fields

## Migration Notes

No database migration required - this is purely frontend integration. The ChatFieldExtractionService already handles the extraction at the service layer.

## Dependencies

This spec depends on:
- ✅ ChatFieldExtractionService (just implemented)
- ✅ Task 036: field-extraction-hook
- ✅ Task 034: chapter-section-accordion
- ⏳ Task 037: v2-layout-rework (must complete first)

## Next Steps

After this integration:
1. Implement field validation before applying
2. Add undo/redo for field changes
3. Create field history/audit trail
4. Add bulk field operations (apply all, reject all)
5. Implement field suggestions preview