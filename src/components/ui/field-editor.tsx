import * as React from "react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { EditSourceBadge } from "@/components/ui/edit-source-badge"
import { validateField } from "@/lib/validation/field-validators"
import type { FieldConfig, ValidationResult, EditSource } from "@/types/field-metadata"

export interface FieldEditorProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  config: FieldConfig;
  value: string;
  onChange: (value: string, editSource?: EditSource) => void;
  editSource?: EditSource;
  disabled?: boolean;
  error?: string;
  showEditSource?: boolean;
}

/**
 * FieldEditor Component
 * Reusable field editor with validation, help text, and edit source tracking
 * - Supports text, textarea, email, url, number field types
 * - Validates input based on field configuration
 * - Displays edit source badges (manual vs AI)
 * - Shows help text and validation errors
 * - Auto-validates on blur
 */
const FieldEditor = React.forwardRef<HTMLInputElement | HTMLTextAreaElement, FieldEditorProps>(
  ({ config, value, onChange, editSource, disabled, error: externalError, showEditSource = true, className, ...props }, ref) => {
    const [validationResult, setValidationResult] = React.useState<ValidationResult>({ isValid: true });
    const [isFocused, setIsFocused] = React.useState<boolean>(false);

    // Determine if we should show textarea
    const isTextarea = config.validation?.type === 'textarea' || config.validation?.type === 'richtext';

    // Get input type based on field validation type
    const inputType = React.useMemo(() => {
      if (!config.validation?.type) return 'text';

      switch (config.validation.type) {
        case 'email':
          return 'email';
        case 'url':
          return 'url';
        case 'number':
        case 'range':
          return 'number';
        default:
          return 'text';
      }
    }, [config.validation?.type]);

    /**
     * Validate the current value
     */
    const validate = React.useCallback((valueToValidate: string): ValidationResult => {
      if (!config.validation) {
        return { isValid: true };
      }

      return validateField(valueToValidate, config.validation);
    }, [config.validation]);

    /**
     * Handle input change
     */
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
      const newValue = e.target.value;

      // Clear validation error on change
      if (!validationResult.isValid) {
        setValidationResult({ isValid: true });
      }

      // Call onChange with manual edit source
      onChange(newValue, 'manual');
    };

    /**
     * Handle blur - validate the field
     */
    const handleBlur = (): void => {
      setIsFocused(false);

      // Validate on blur
      const result = validate(value);
      setValidationResult(result);
    };

    /**
     * Handle focus
     */
    const handleFocus = (): void => {
      setIsFocused(true);
    };

    // Determine error message to display
    const errorMessage = externalError || validationResult.error;
    const hasError = !!errorMessage;

    // Input/Textarea common props
    const commonProps = {
      value,
      onChange: handleChange,
      onBlur: handleBlur,
      onFocus: handleFocus,
      disabled,
      placeholder: config.placeholder,
      className: cn(
        hasError && "border-red-500 focus-visible:ring-red-500",
        className
      ),
    };

    return (
      <div className="space-y-2" {...props}>
        {/* Label and Edit Source Badge */}
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            {config.label}
          </label>
          {showEditSource && editSource && (
            <EditSourceBadge source={editSource} />
          )}
        </div>

        {/* Help Text */}
        {config.helpText && (
          <p className="text-sm text-muted-foreground">
            {config.helpText}
          </p>
        )}

        {/* Input or Textarea */}
        {isTextarea ? (
          <Textarea
            ref={ref as React.Ref<HTMLTextAreaElement>}
            {...commonProps}
          />
        ) : (
          <Input
            ref={ref as React.Ref<HTMLInputElement>}
            type={inputType}
            {...commonProps}
          />
        )}

        {/* Error Message */}
        {hasError && (
          <p className="text-sm text-red-500">
            {errorMessage}
          </p>
        )}
      </div>
    );
  }
);

FieldEditor.displayName = "FieldEditor";

export { FieldEditor }
