import * as React from "react"

import { cn } from "@/lib/utils"

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, onChange, ...props }, ref) => {
    const internalRef = React.useRef<HTMLTextAreaElement | null>(null);

    const autoResize = React.useCallback((el: HTMLTextAreaElement | null): void => {
      if (!el) return;
      // Only auto-resize when field-sizing: content is not natively supported
      if (typeof CSS !== 'undefined' && CSS.supports?.('field-sizing', 'content')) return;
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    }, []);

    // Resize on mount and when value changes externally
    React.useEffect(() => {
      autoResize(internalRef.current);
    }, [props.value, autoResize]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
      onChange?.(e);
      autoResize(e.target);
    };

    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={(el) => {
          internalRef.current = el;
          if (typeof ref === 'function') ref(el);
          else if (ref) ref.current = el;
          autoResize(el);
        }}
        onChange={handleChange}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
