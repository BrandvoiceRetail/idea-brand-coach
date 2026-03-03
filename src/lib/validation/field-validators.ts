/**
 * Field Validators
 * Validation utilities for field editing with auto-save
 * Following clean architecture patterns and SOLID principles
 */

import { ValidationResult, FieldValidation } from '@/types/field-metadata';

/**
 * Validates an email address
 * Uses standard email regex pattern
 */
export function validateEmail(value: string): ValidationResult {
  if (!value || value.trim() === '') {
    return {
      isValid: false,
      error: 'Email is required',
    };
  }

  // Standard email regex pattern
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(value)) {
    return {
      isValid: false,
      error: 'Please enter a valid email address',
    };
  }

  if (value.length > 255) {
    return {
      isValid: false,
      error: 'Email must be less than 255 characters',
    };
  }

  return { isValid: true };
}

/**
 * Validates a URL
 * Supports http, https, and optionally other protocols
 */
export function validateUrl(value: string, options?: { requireProtocol?: boolean; allowedProtocols?: string[] }): ValidationResult {
  if (!value || value.trim() === '') {
    return {
      isValid: false,
      error: 'URL is required',
    };
  }

  const requireProtocol = options?.requireProtocol ?? true;
  const allowedProtocols = options?.allowedProtocols ?? ['http', 'https'];

  try {
    const url = new URL(value);

    // Check if protocol is allowed
    const protocol = url.protocol.slice(0, -1); // Remove trailing ':'
    if (requireProtocol && !allowedProtocols.includes(protocol)) {
      return {
        isValid: false,
        error: `URL must use one of the following protocols: ${allowedProtocols.join(', ')}`,
      };
    }

    return { isValid: true };
  } catch {
    if (requireProtocol) {
      return {
        isValid: false,
        error: 'Please enter a valid URL (e.g., https://example.com)',
      };
    }

    // Try adding https:// prefix if protocol not required
    try {
      new URL(`https://${value}`);
      return { isValid: true };
    } catch {
      return {
        isValid: false,
        error: 'Please enter a valid URL',
      };
    }
  }
}

/**
 * Validates a numeric value is within a specified range
 */
export function validateRange(value: string | number, options: { min?: number; max?: number }): ValidationResult {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(numValue)) {
    return {
      isValid: false,
      error: 'Please enter a valid number',
    };
  }

  if (options.min !== undefined && numValue < options.min) {
    return {
      isValid: false,
      error: `Value must be at least ${options.min}`,
    };
  }

  if (options.max !== undefined && numValue > options.max) {
    return {
      isValid: false,
      error: `Value must be at most ${options.max}`,
    };
  }

  return { isValid: true };
}

/**
 * Validates string length is within specified bounds
 */
export function validateLength(value: string, options: { minLength?: number; maxLength?: number }): ValidationResult {
  const length = value.length;

  if (options.minLength !== undefined && length < options.minLength) {
    return {
      isValid: false,
      error: `Must be at least ${options.minLength} characters`,
    };
  }

  if (options.maxLength !== undefined && length > options.maxLength) {
    return {
      isValid: false,
      error: `Must be at most ${options.maxLength} characters`,
    };
  }

  return { isValid: true };
}

/**
 * Validates a value against a regex pattern
 */
export function validatePattern(value: string, pattern: RegExp, errorMessage?: string): ValidationResult {
  if (!pattern.test(value)) {
    return {
      isValid: false,
      error: errorMessage || 'Value does not match required format',
    };
  }

  return { isValid: true };
}

/**
 * Validates that a required field is not empty
 */
export function validateRequired(value: string): ValidationResult {
  if (!value || value.trim() === '') {
    return {
      isValid: false,
      error: 'This field is required',
    };
  }

  return { isValid: true };
}

/**
 * Main validation function that applies all validation rules from FieldValidation config
 * Runs validators in sequence and returns first error encountered
 */
export function validateField(value: string, validation: FieldValidation): ValidationResult {
  // Check required first
  if (validation.required) {
    const requiredResult = validateRequired(value);
    if (!requiredResult.isValid) {
      return requiredResult;
    }
  }

  // If empty and not required, skip validation
  if (!value || value.trim() === '') {
    return { isValid: true };
  }

  // Type-specific validation
  switch (validation.type) {
    case 'email': {
      const emailResult = validateEmail(value);
      if (!emailResult.isValid) {
        return emailResult;
      }
      break;
    }
    case 'url': {
      const urlResult = validateUrl(value);
      if (!urlResult.isValid) {
        return urlResult;
      }
      break;
    }
    case 'number':
    case 'range': {
      const rangeResult = validateRange(value, {
        min: validation.min,
        max: validation.max,
      });
      if (!rangeResult.isValid) {
        return rangeResult;
      }
      break;
    }
  }

  // Length validation
  if (validation.minLength !== undefined || validation.maxLength !== undefined) {
    const lengthResult = validateLength(value, {
      minLength: validation.minLength,
      maxLength: validation.maxLength,
    });
    if (!lengthResult.isValid) {
      return lengthResult;
    }
  }

  // Pattern validation
  if (validation.pattern) {
    const patternResult = validatePattern(value, validation.pattern);
    if (!patternResult.isValid) {
      return patternResult;
    }
  }

  // Custom validator
  if (validation.customValidator) {
    return validation.customValidator(value);
  }

  return { isValid: true };
}
