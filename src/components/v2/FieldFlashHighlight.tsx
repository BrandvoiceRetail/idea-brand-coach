import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Imperative handle for triggering the flash animation
 */
export interface FieldFlashHandle {
  /** Trigger the green flash animation */
  flash: () => void;
}

/**
 * Props for FieldFlashHighlight component
 */
export interface FieldFlashHighlightProps {
  /** Field identifier used for scroll targeting (renders as id="field-{fieldId}") */
  fieldId: string;

  /** Content to wrap with the flash highlight */
  children: React.ReactNode;

  /** Additional CSS class names */
  className?: string;
}

/**
 * FieldFlashHighlight Component
 *
 * A minimal wrapper that provides a green flash animation on a field when
 * an AI extraction is accepted. Exposes an imperative `flash()` method
 * via `forwardRef` + `useImperativeHandle`.
 *
 * Respects `prefers-reduced-motion` by using an instant border change
 * instead of an animated background transition.
 *
 * @example
 * ```tsx
 * const ref = useRef<FieldFlashHandle>(null);
 * <FieldFlashHighlight ref={ref} fieldId="brand-purpose">
 *   <Input value={value} onChange={onChange} />
 * </FieldFlashHighlight>
 * // Later: ref.current?.flash();
 * ```
 */
export const FieldFlashHighlight = React.forwardRef<FieldFlashHandle, FieldFlashHighlightProps>(
  ({ fieldId, children, className }, ref) => {
    const [isFlashing, setIsFlashing] = React.useState(false);
    const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    React.useImperativeHandle(ref, () => ({
      flash: (): void => {
        // Clear any existing animation timer
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }

        setIsFlashing(true);

        timerRef.current = setTimeout(() => {
          setIsFlashing(false);
          timerRef.current = null;
        }, 1500);
      },
    }));

    // Cleanup timer on unmount
    React.useEffect(() => {
      return (): void => {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }
      };
    }, []);

    return (
      <div
        id={`field-${fieldId}`}
        className={cn(
          "rounded-md transition-colors scroll-mt-20",
          isFlashing && "animate-field-flash motion-reduce:animate-none motion-reduce:border motion-reduce:border-green-500",
          className
        )}
      >
        {children}
      </div>
    );
  }
);

FieldFlashHighlight.displayName = "FieldFlashHighlight";
