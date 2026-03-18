/**
 * Example integration showing how to use the adaptive field review components
 * together in a chat interface with field extraction.
 */

import * as React from 'react';
import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { AdaptiveFieldReview, ReviewField } from './AdaptiveFieldReview';
import { FieldExtractionBadges, ExtractedField } from './FieldExtractionBadges';
import { useFieldExtraction } from '@/hooks/useFieldExtraction';
import { CHAPTER_FIELDS_MAP } from '@/config/chapterFields';
import { toast } from 'sonner';

/**
 * Example component demonstrating the mobile-first field editing experience
 *
 * This example shows:
 * 1. AI message with extracted fields shown as badges
 * 2. Click/tap on badges opens adaptive field review
 * 3. Review interface adapts to device (bottom sheet on mobile, sidebar on desktop)
 * 4. Swipe gestures on mobile, keyboard shortcuts on desktop
 */
export const FieldReviewExample: React.FC = () => {
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [reviewFields, setReviewFields] = useState<ReviewField[]>([]);
  const [currentReviewIndex, setCurrentReviewIndex] = useState(0);

  // Use field extraction hook
  const { fieldValues, fieldMetadata, setFieldManual, setFieldLock } = useFieldExtraction('default-avatar');

  // Example AI response with extracted fields
  const exampleAIResponse = `Based on our discussion, I've captured the following information about your brand:

Your brand name is "EcoVision Solutions" and your mission is to "make sustainable technology accessible to everyone."

Your core values include innovation, sustainability, and community impact. You're targeting environmentally conscious consumers aged 25-45 who value both technology and sustainability.`;

  // Example extracted fields
  const exampleExtractedFields: ExtractedField[] = [
    {
      fieldId: 'brand-name',
      label: 'Brand Name',
      value: 'EcoVision Solutions',
      confidence: 0.95,
    },
    {
      fieldId: 'mission',
      label: 'Mission',
      value: 'Make sustainable technology accessible to everyone',
      confidence: 0.9,
    },
    {
      fieldId: 'values',
      label: 'Core Values',
      value: ['Innovation', 'Sustainability', 'Community Impact'],
      confidence: 0.85,
    },
    {
      fieldId: 'target-audience',
      label: 'Target Audience',
      value: 'Environmentally conscious consumers aged 25-45',
      confidence: 0.8,
    },
  ];

  // Handle field badge click - open review for that field
  const handleFieldClick = useCallback((field: ExtractedField) => {
    // Find the corresponding chapter field definition
    const chapterField = Object.values(CHAPTER_FIELDS_MAP)
      .flatMap(chapter => chapter.fields)
      .find(f => f.id === field.fieldId);

    if (!chapterField) {
      toast.error('Field definition not found');
      return;
    }

    // Convert to review fields
    const fieldsToReview: ReviewField[] = exampleExtractedFields.map(ef => {
      const cf = Object.values(CHAPTER_FIELDS_MAP)
        .flatMap(chapter => chapter.fields)
        .find(f => f.id === ef.fieldId);

      if (!cf) {
        throw new Error(`Field ${ef.fieldId} not found`);
      }

      return {
        ...cf,
        value: ef.value,
        originalValue: fieldValues[ef.fieldId] || ef.value,
        isDirty: fieldValues[ef.fieldId] !== ef.value,
        source: 'ai' as const,
        isLocked: fieldMetadata[ef.fieldId]?.isLocked || false,
      };
    });

    // Set the fields and find the index of the clicked field
    setReviewFields(fieldsToReview);
    const clickedIndex = fieldsToReview.findIndex(f => f.id === field.fieldId);
    setCurrentReviewIndex(Math.max(0, clickedIndex));

    // Open the review panel
    setIsReviewOpen(true);
  }, [fieldValues, fieldMetadata]);

  // Handle accepting a field value
  const handleAcceptField = useCallback((field: ReviewField, value: string | string[]) => {
    setFieldManual(field.id, value);
    toast.success(`Accepted ${field.label}`);
  }, [setFieldManual]);

  // Handle rejecting a field value
  const handleRejectField = useCallback((field: ReviewField) => {
    // Optionally clear the field or mark it for re-extraction
    toast.info(`Rejected ${field.label}`);
  }, []);

  // Handle editing a field value
  const handleEditField = useCallback((field: ReviewField, value: string | string[]) => {
    // Temporarily store the edit (not persisted until accepted)
    console.log(`Editing ${field.id}:`, value);
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Field Review Example</h2>

        <div className="prose max-w-none">
          <p>
            This example demonstrates the mobile-first field editing experience with adaptive UI:
          </p>
          <ul>
            <li>Green badges show extracted fields under AI messages</li>
            <li>Click/tap badges to open field review</li>
            <li>Mobile: Bottom sheet with swipe gestures</li>
            <li>Desktop: Sidebar with keyboard shortcuts</li>
          </ul>
        </div>

        {/* Example AI message with extraction badges */}
        <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-xs">AI</span>
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground mb-2">Brand Coach</p>
              <div className="prose prose-sm max-w-none">
                {exampleAIResponse}
              </div>
            </div>
          </div>

          {/* Field extraction badges */}
          <FieldExtractionBadges
            fields={exampleExtractedFields}
            onFieldClick={handleFieldClick}
            showAnimation
          />
        </div>

        {/* Demo button to open review */}
        <Button
          onClick={() => {
            // Prepare all fields for review
            const fieldsToReview: ReviewField[] = exampleExtractedFields.map(ef => {
              const cf = Object.values(CHAPTER_FIELDS_MAP)
                .flatMap(chapter => chapter.fields)
                .find(f => f.id === ef.fieldId);

              if (!cf) {
                // Create a fallback field definition
                return {
                  id: ef.fieldId,
                  label: ef.label,
                  type: Array.isArray(ef.value) ? 'array' : 'textarea',
                  placeholder: `Enter ${ef.label}`,
                  required: false,
                  value: ef.value,
                  source: 'ai' as const,
                };
              }

              return {
                ...cf,
                value: ef.value,
                source: 'ai' as const,
              };
            });

            setReviewFields(fieldsToReview);
            setCurrentReviewIndex(0);
            setIsReviewOpen(true);
          }}
        >
          Open Field Review
        </Button>
      </div>

      {/* Adaptive field review panel */}
      <AdaptiveFieldReview
        fields={reviewFields}
        isOpen={isReviewOpen}
        onClose={() => setIsReviewOpen(false)}
        onAccept={handleAcceptField}
        onReject={handleRejectField}
        onEdit={handleEditField}
        currentIndex={currentReviewIndex}
        onNavigate={setCurrentReviewIndex}
        showHelp
      />

      {/* Instructions for testing */}
      <div className="mt-8 p-4 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900">
        <h3 className="font-semibold mb-2 text-blue-900 dark:text-blue-100">
          Testing Instructions
        </h3>
        <div className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
          <p><strong>Mobile Testing:</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Resize browser to &lt;768px width or use device emulation</li>
            <li>Tap a green badge to open bottom sheet</li>
            <li>Swipe right to accept, left to reject, down to dismiss</li>
            <li>Fields advance automatically after accept/reject</li>
          </ul>

          <p className="mt-3"><strong>Desktop Testing:</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Click a green badge to open sidebar panel</li>
            <li>Press 'A' to accept, 'R' to reject</li>
            <li>Use arrow keys to navigate between fields</li>
            <li>Edit values inline before accepting</li>
          </ul>
        </div>
      </div>
    </div>
  );
};