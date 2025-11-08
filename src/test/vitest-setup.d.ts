import '@testing-library/jest-dom';
import 'vitest';

declare global {
  namespace Vi {
    interface Matchers<R = any> {
      toBeInTheDocument(): R;
      toBeDisabled(): R;
      toBeEnabled(): R;
      toBeVisible(): R;
      toBeChecked(): R;
      toHaveValue(value: any): R;
      toHaveTextContent(text: string | RegExp): R;
      toHaveClass(...classNames: string[]): R;
    }
  }
}
