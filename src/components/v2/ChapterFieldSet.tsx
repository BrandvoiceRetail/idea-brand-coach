import * as React from "react";
import { Bot, Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
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

  /** Change handler for field updates */
  onChange: (fieldId: string, value: string | string[]) => void;

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
  ({ field, value, source, onChange, disabled = false, className }, ref) => {
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

    /**
     * Render the appropriate input component based on field type
     */
    const renderFieldInput = (): JSX.Element => {
      const stringValue = typeof value === 'string' ? value : undefined;

      switch (field.type) {
        case 'text':
          return (
            <Input
              id={field.id}
              value={stringValue || ''}
              onChange={handleInputChange}
              placeholder={field.placeholder}
              disabled={disabled}
              required={field.required}
            />
          );

        case 'textarea':
          return (
            <Textarea
              id={field.id}
              value={stringValue || ''}
              onChange={handleInputChange}
              placeholder={field.placeholder}
              disabled={disabled}
              required={field.required}
              className="min-h-[120px]"
            />
          );

        case 'array':
          return (
            <Textarea
              id={field.id}
              value={arrayValueToString(value)}
              onChange={handleArrayChange}
              placeholder={`${field.placeholder}\n(One item per line)`}
              disabled={disabled}
              required={field.required}
              className="min-h-[120px]"
            />
          );

        default:
          return (
            <Input
              id={field.id}
              value={stringValue || ''}
              onChange={handleInputChange}
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
