import * as React from "react";
import { Bot, Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { GhostTextFieldWrapper } from "@/components/v2/GhostTextFieldWrapper";
import { scoreFieldQuality } from "@/utils/fieldQualityScore";
import type { QualityTier } from "@/utils/fieldQualityScore";
import type { ChapterField, FieldSource } from "@/config/chapterFields";

/**
 * Props for ChapterFieldSet component
 */
export interface ChapterFieldSetProps {
  /** The field configuration from chapterFields.ts */
  field: ChapterField;

  /** Current field value */
  value: string | string[] | undefined;

  /** Field source indicator (AI-generated or manually entered) */
  source?: FieldSource;

  /** Pending AI-extracted value to show as ghost text (Tab-to-accept) */
  pendingValue?: string | string[];

  /** Change handler for field updates */
  onChange: (fieldId: string, value: string | string[]) => void;

  /** Focus handler for field (for conversational guidance) */
  onFocus?: () => void;

  /** Whether the field is disabled */
  disabled?: boolean;

  /** Additional CSS class names */
  className?: string;
}

/**
 * ChapterFieldSet Component
 *
 * Renders individual chapter fields with appropriate input types,
 * labels, help text, and source indicators (Bot icon for AI, Pencil icon for manual).
 *
 * @example
 * ```tsx
 * <ChapterFieldSet
 *   field={chapterField}
 *   value={brandData.brandPurpose}
 *   source="ai"
 *   onChange={(id, value) => updateBrandData(id, value)}
 * />
 * ```
 */
export const ChapterFieldSet = React.forwardRef<HTMLDivElement, ChapterFieldSetProps>(
  ({ field, value, pendingValue, source, onChange, onFocus, disabled = false, className }, ref) => {
    /**
     * Handle input change for text and textarea fields
     */
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
      onChange(field.id, e.target.value);
    };

    /**
     * Handle array field changes
     * For now, we'll use a textarea where each line is an array item
     */
    const handleArrayChange = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
      const lines = e.target.value.split('\n').filter(line => line.trim());
      onChange(field.id, lines);
    };

    /**
     * Convert array value to textarea string
     */
    const arrayValueToString = (val: string | string[] | undefined): string => {
      if (Array.isArray(val)) {
        return val.join('\n');
      }
      return val || '';
    };

    /**
     * Render source indicator badge
     */
    const renderSourceBadge = (): JSX.Element | null => {
      if (!source) return null;

      return (
        <Badge
          variant="outline"
          className="ml-2 gap-1"
        >
          {source === 'ai' ? (
            <>
              <Bot className="h-3 w-3" />
              <span>AI Generated</span>
            </>
          ) : (
            <>
              <Pencil className="h-3 w-3" />
              <span>Manual</span>
            </>
          )}
        </Badge>
      );
    };

    const TIER_STYLES: Record<QualityTier, string> = {
      empty: '',
      weak: 'border-red-400/60 text-red-600',
      fair: 'border-amber-400/60 text-amber-600',
      good: 'border-emerald-400/60 text-emerald-600',
      strong: 'border-emerald-500 text-emerald-700 bg-emerald-50',
    };

    /**
     * Render IDEA Brand Coach quality score badge
     */
    const renderQualityBadge = (): JSX.Element | null => {
      const quality = scoreFieldQuality(value);
      if (quality.tier === 'empty') return null;

      return (
        <Badge
          variant="outline"
          className={cn('ml-auto gap-1 text-xs', TIER_STYLES[quality.tier])}
        >
          {quality.label}
        </Badge>
      );
    };

    /**
     * Normalize pending value to a display string for ghost text.
     * Returns empty string if the field already has a value (ghost text
     * should only appear on empty fields).
     */
    const getGhostText = (): string => {
      // Don't show ghost text if field already has content
      const hasValue = Array.isArray(value)
        ? value.length > 0
        : Boolean(value);
      if (hasValue || !pendingValue) return '';

      if (Array.isArray(pendingValue)) {
        return pendingValue.join('\n');
      }
      return pendingValue;
    };

    /**
     * Handle accepting ghost text — route through the standard onChange handler.
     * For array fields, split the accepted string into lines.
     */
    const handleGhostAccept = (ghostValue: string): void => {
      if (field.type === 'array') {
        const lines = ghostValue.split('\n').filter(line => line.trim());
        onChange(field.id, lines);
      } else {
        onChange(field.id, ghostValue);
      }
    };

    /**
     * Optionally wrap an input element in GhostTextFieldWrapper
     * when there is a pending ghost value to display.
     */
    const wrapWithGhost = (inputElement: JSX.Element): JSX.Element => {
      const ghostText = getGhostText();
      if (!ghostText) return inputElement;

      return (
        <GhostTextFieldWrapper
          pendingValue={ghostText}
          onAccept={handleGhostAccept}
        >
          {inputElement}
        </GhostTextFieldWrapper>
      );
    };

    /**
     * Render the appropriate input component based on field type
     */
    const renderFieldInput = (): JSX.Element => {
      const stringValue = typeof value === 'string' ? value : undefined;

      switch (field.type) {
        case 'text':
          return wrapWithGhost(
            <Input
              id={field.id}
              value={stringValue || ''}
              onChange={handleInputChange}
              onFocus={onFocus}
              placeholder={field.placeholder}
              disabled={disabled}
              required={field.required}
            />
          );

        case 'textarea':
          return wrapWithGhost(
            <Textarea
              id={field.id}
              value={stringValue || ''}
              onChange={handleInputChange}
              onFocus={onFocus}
              placeholder={field.placeholder}
              disabled={disabled}
              required={field.required}
              className="min-h-[80px] max-h-[400px] resize-y"
              style={{ fieldSizing: 'content' } as React.CSSProperties}
            />
          );

        case 'array':
          return wrapWithGhost(
            <Textarea
              id={field.id}
              value={arrayValueToString(value)}
              onChange={handleArrayChange}
              onFocus={onFocus}
              placeholder={`${field.placeholder}\n(One item per line)`}
              disabled={disabled}
              required={field.required}
              className="min-h-[80px] max-h-[400px] resize-y"
              style={{ fieldSizing: 'content' } as React.CSSProperties}
            />
          );

        default:
          return wrapWithGhost(
            <Input
              id={field.id}
              value={stringValue || ''}
              onChange={handleInputChange}
              onFocus={onFocus}
              placeholder={field.placeholder}
              disabled={disabled}
              required={field.required}
            />
          );
      }
    };

    return (
      <div ref={ref} className={cn("space-y-2", className)}>
        <div className="flex items-center">
          <Label htmlFor={field.id} className="flex items-center">
            {field.label}
            {field.required && (
              <span className="ml-1 text-destructive">*</span>
            )}
          </Label>
          {renderSourceBadge()}
          {renderQualityBadge()}
        </div>

        {renderFieldInput()}

        {field.helpText && (
          <p className="text-sm text-muted-foreground">
            {field.helpText}
          </p>
        )}
      </div>
    );
  }
);

ChapterFieldSet.displayName = "ChapterFieldSet";
