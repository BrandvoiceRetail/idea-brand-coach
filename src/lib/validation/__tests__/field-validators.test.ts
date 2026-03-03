/**
 * Unit Tests for Field Validators
 * Following TDD principles and comprehensive test coverage
 */

import { describe, it, expect } from 'vitest';
import {
  validateEmail,
  validateUrl,
  validateRange,
  validateLength,
  validatePattern,
  validateRequired,
  validateField,
} from '../field-validators';
import type { FieldValidation, ValidationResult } from '@/types/field-metadata';

describe('Field Validators', () => {
  describe('validateEmail', () => {
    it('should validate a correct email address', () => {
      const result = validateEmail('test@example.com');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should validate email with subdomain', () => {
      const result = validateEmail('user@mail.example.com');
      expect(result.isValid).toBe(true);
    });

    it('should validate email with plus addressing', () => {
      const result = validateEmail('user+tag@example.com');
      expect(result.isValid).toBe(true);
    });

    it('should reject empty email', () => {
      const result = validateEmail('');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Email is required');
    });

    it('should reject whitespace-only email', () => {
      const result = validateEmail('   ');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Email is required');
    });

    it('should reject email without @', () => {
      const result = validateEmail('testexample.com');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Please enter a valid email address');
    });

    it('should reject email without domain', () => {
      const result = validateEmail('test@');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Please enter a valid email address');
    });

    it('should reject email without top-level domain', () => {
      const result = validateEmail('test@example');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Please enter a valid email address');
    });

    it('should reject email with spaces', () => {
      const result = validateEmail('test @example.com');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Please enter a valid email address');
    });

    it('should reject email longer than 255 characters', () => {
      const longEmail = 'a'.repeat(250) + '@example.com';
      const result = validateEmail(longEmail);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Email must be less than 255 characters');
    });
  });

  describe('validateUrl', () => {
    it('should validate HTTPS URL', () => {
      const result = validateUrl('https://example.com');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should validate HTTP URL', () => {
      const result = validateUrl('http://example.com');
      expect(result.isValid).toBe(true);
    });

    it('should validate URL with path', () => {
      const result = validateUrl('https://example.com/path/to/page');
      expect(result.isValid).toBe(true);
    });

    it('should validate URL with query parameters', () => {
      const result = validateUrl('https://example.com?foo=bar&baz=qux');
      expect(result.isValid).toBe(true);
    });

    it('should validate URL with port', () => {
      const result = validateUrl('https://example.com:8080');
      expect(result.isValid).toBe(true);
    });

    it('should reject empty URL', () => {
      const result = validateUrl('');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('URL is required');
    });

    it('should reject whitespace-only URL', () => {
      const result = validateUrl('   ');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('URL is required');
    });

    it('should reject invalid URL format', () => {
      const result = validateUrl('not a url');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Please enter a valid URL (e.g., https://example.com)');
    });

    it('should reject URL with disallowed protocol', () => {
      const result = validateUrl('ftp://example.com');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('URL must use one of the following protocols: http, https');
    });

    it('should allow custom protocols when specified', () => {
      const result = validateUrl('ftp://example.com', {
        allowedProtocols: ['ftp', 'ftps'],
      });
      expect(result.isValid).toBe(true);
    });

    it('should allow URL without protocol when requireProtocol is false', () => {
      const result = validateUrl('example.com', {
        requireProtocol: false,
      });
      expect(result.isValid).toBe(true);
    });

    it('should reject invalid URL even without protocol requirement', () => {
      const result = validateUrl('not valid url', {
        requireProtocol: false,
      });
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Please enter a valid URL');
    });
  });

  describe('validateRange', () => {
    it('should validate number within range', () => {
      const result = validateRange(5, { min: 0, max: 10 });
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should validate number at minimum boundary', () => {
      const result = validateRange(0, { min: 0, max: 10 });
      expect(result.isValid).toBe(true);
    });

    it('should validate number at maximum boundary', () => {
      const result = validateRange(10, { min: 0, max: 10 });
      expect(result.isValid).toBe(true);
    });

    it('should validate string number within range', () => {
      const result = validateRange('5', { min: 0, max: 10 });
      expect(result.isValid).toBe(true);
    });

    it('should validate number with only minimum constraint', () => {
      const result = validateRange(100, { min: 0 });
      expect(result.isValid).toBe(true);
    });

    it('should validate number with only maximum constraint', () => {
      const result = validateRange(-100, { max: 0 });
      expect(result.isValid).toBe(true);
    });

    it('should validate decimal numbers', () => {
      const result = validateRange(5.5, { min: 0, max: 10 });
      expect(result.isValid).toBe(true);
    });

    it('should reject non-numeric string', () => {
      const result = validateRange('abc', { min: 0, max: 10 });
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Please enter a valid number');
    });

    it('should reject number below minimum', () => {
      const result = validateRange(-5, { min: 0, max: 10 });
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Value must be at least 0');
    });

    it('should reject number above maximum', () => {
      const result = validateRange(15, { min: 0, max: 10 });
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Value must be at most 10');
    });

    it('should reject string number below minimum', () => {
      const result = validateRange('-5', { min: 0 });
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Value must be at least 0');
    });

    it('should reject string number above maximum', () => {
      const result = validateRange('15', { max: 10 });
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Value must be at most 10');
    });
  });

  describe('validateLength', () => {
    it('should validate string within length range', () => {
      const result = validateLength('hello', { minLength: 3, maxLength: 10 });
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should validate string at minimum length boundary', () => {
      const result = validateLength('abc', { minLength: 3, maxLength: 10 });
      expect(result.isValid).toBe(true);
    });

    it('should validate string at maximum length boundary', () => {
      const result = validateLength('abcdefghij', { minLength: 3, maxLength: 10 });
      expect(result.isValid).toBe(true);
    });

    it('should validate string with only minLength constraint', () => {
      const result = validateLength('hello world', { minLength: 5 });
      expect(result.isValid).toBe(true);
    });

    it('should validate string with only maxLength constraint', () => {
      const result = validateLength('hi', { maxLength: 10 });
      expect(result.isValid).toBe(true);
    });

    it('should validate empty string with no constraints', () => {
      const result = validateLength('', {});
      expect(result.isValid).toBe(true);
    });

    it('should reject string shorter than minimum', () => {
      const result = validateLength('ab', { minLength: 3 });
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Must be at least 3 characters');
    });

    it('should reject string longer than maximum', () => {
      const result = validateLength('hello world', { maxLength: 5 });
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Must be at most 5 characters');
    });

    it('should reject empty string when minLength is set', () => {
      const result = validateLength('', { minLength: 1 });
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Must be at least 1 characters');
    });
  });

  describe('validatePattern', () => {
    it('should validate string matching pattern', () => {
      const pattern = /^[A-Z][a-z]+$/;
      const result = validatePattern('Hello', pattern);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should validate numeric pattern', () => {
      const pattern = /^\d{3}-\d{3}-\d{4}$/;
      const result = validatePattern('123-456-7890', pattern);
      expect(result.isValid).toBe(true);
    });

    it('should reject string not matching pattern', () => {
      const pattern = /^[A-Z][a-z]+$/;
      const result = validatePattern('hello', pattern);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Value does not match required format');
    });

    it('should use custom error message when provided', () => {
      const pattern = /^\d{3}-\d{3}-\d{4}$/;
      const result = validatePattern('invalid', pattern, 'Please enter a valid phone number');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Please enter a valid phone number');
    });

    it('should validate complex regex pattern', () => {
      const pattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{8,}$/;
      const result = validatePattern('Password123', pattern);
      expect(result.isValid).toBe(true);
    });

    it('should reject empty string for non-optional pattern', () => {
      const pattern = /^.+$/;
      const result = validatePattern('', pattern);
      expect(result.isValid).toBe(false);
    });
  });

  describe('validateRequired', () => {
    it('should validate non-empty string', () => {
      const result = validateRequired('hello');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should validate string with spaces and text', () => {
      const result = validateRequired('  hello  ');
      expect(result.isValid).toBe(true);
    });

    it('should reject empty string', () => {
      const result = validateRequired('');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('This field is required');
    });

    it('should reject whitespace-only string', () => {
      const result = validateRequired('   ');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('This field is required');
    });

    it('should reject string with only tabs', () => {
      const result = validateRequired('\t\t');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('This field is required');
    });

    it('should reject string with only newlines', () => {
      const result = validateRequired('\n\n');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('This field is required');
    });
  });

  describe('validateField', () => {
    it('should validate required text field', () => {
      const validation: FieldValidation = {
        type: 'text',
        required: true,
      };
      const result = validateField('hello', validation);
      expect(result.isValid).toBe(true);
    });

    it('should reject empty required field', () => {
      const validation: FieldValidation = {
        type: 'text',
        required: true,
      };
      const result = validateField('', validation);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('This field is required');
    });

    it('should allow empty non-required field', () => {
      const validation: FieldValidation = {
        type: 'text',
        required: false,
      };
      const result = validateField('', validation);
      expect(result.isValid).toBe(true);
    });

    it('should validate email field type', () => {
      const validation: FieldValidation = {
        type: 'email',
      };
      const result = validateField('test@example.com', validation);
      expect(result.isValid).toBe(true);
    });

    it('should reject invalid email in email field', () => {
      const validation: FieldValidation = {
        type: 'email',
      };
      const result = validateField('invalid-email', validation);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Please enter a valid email address');
    });

    it('should validate url field type', () => {
      const validation: FieldValidation = {
        type: 'url',
      };
      const result = validateField('https://example.com', validation);
      expect(result.isValid).toBe(true);
    });

    it('should reject invalid url in url field', () => {
      const validation: FieldValidation = {
        type: 'url',
      };
      const result = validateField('not-a-url', validation);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Please enter a valid URL (e.g., https://example.com)');
    });

    it('should validate number field type', () => {
      const validation: FieldValidation = {
        type: 'number',
        min: 0,
        max: 100,
      };
      const result = validateField('50', validation);
      expect(result.isValid).toBe(true);
    });

    it('should reject number out of range', () => {
      const validation: FieldValidation = {
        type: 'number',
        min: 0,
        max: 100,
      };
      const result = validateField('150', validation);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Value must be at most 100');
    });

    it('should validate range field type', () => {
      const validation: FieldValidation = {
        type: 'range',
        min: 1,
        max: 10,
      };
      const result = validateField('5', validation);
      expect(result.isValid).toBe(true);
    });

    it('should validate minLength constraint', () => {
      const validation: FieldValidation = {
        type: 'text',
        minLength: 5,
      };
      const result = validateField('hello', validation);
      expect(result.isValid).toBe(true);
    });

    it('should reject string shorter than minLength', () => {
      const validation: FieldValidation = {
        type: 'text',
        minLength: 10,
      };
      const result = validateField('short', validation);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Must be at least 10 characters');
    });

    it('should validate maxLength constraint', () => {
      const validation: FieldValidation = {
        type: 'text',
        maxLength: 10,
      };
      const result = validateField('hello', validation);
      expect(result.isValid).toBe(true);
    });

    it('should reject string longer than maxLength', () => {
      const validation: FieldValidation = {
        type: 'text',
        maxLength: 5,
      };
      const result = validateField('hello world', validation);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Must be at most 5 characters');
    });

    it('should validate pattern constraint', () => {
      const validation: FieldValidation = {
        type: 'text',
        pattern: /^[A-Z][a-z]+$/,
      };
      const result = validateField('Hello', validation);
      expect(result.isValid).toBe(true);
    });

    it('should reject value not matching pattern', () => {
      const validation: FieldValidation = {
        type: 'text',
        pattern: /^[A-Z][a-z]+$/,
      };
      const result = validateField('hello', validation);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Value does not match required format');
    });

    it('should use custom validator when provided', () => {
      const customValidator = (value: string): ValidationResult => {
        if (value === 'forbidden') {
          return { isValid: false, error: 'This value is not allowed' };
        }
        return { isValid: true };
      };

      const validation: FieldValidation = {
        type: 'text',
        customValidator,
      };

      const result = validateField('forbidden', validation);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('This value is not allowed');
    });

    it('should pass custom validator with valid value', () => {
      const customValidator = (value: string): ValidationResult => {
        if (value === 'forbidden') {
          return { isValid: false, error: 'This value is not allowed' };
        }
        return { isValid: true };
      };

      const validation: FieldValidation = {
        type: 'text',
        customValidator,
      };

      const result = validateField('allowed', validation);
      expect(result.isValid).toBe(true);
    });

    it('should apply validations in correct order: required first', () => {
      const validation: FieldValidation = {
        type: 'email',
        required: true,
        minLength: 5,
      };

      const result = validateField('', validation);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('This field is required');
    });

    it('should skip type validation for empty non-required field', () => {
      const validation: FieldValidation = {
        type: 'email',
        required: false,
      };

      const result = validateField('', validation);
      expect(result.isValid).toBe(true);
    });

    it('should apply all validations for valid required email with length constraints', () => {
      const validation: FieldValidation = {
        type: 'email',
        required: true,
        minLength: 10,
        maxLength: 50,
      };

      const result = validateField('valid@example.com', validation);
      expect(result.isValid).toBe(true);
    });

    it('should fail on first validation error (type before length)', () => {
      const validation: FieldValidation = {
        type: 'email',
        minLength: 3,
      };

      const result = validateField('not-email', validation);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Please enter a valid email address');
    });

    it('should validate textarea type same as text', () => {
      const validation: FieldValidation = {
        type: 'textarea',
        maxLength: 100,
      };

      const result = validateField('This is a longer text that might go in a textarea', validation);
      expect(result.isValid).toBe(true);
    });

    it('should validate richtext type same as text', () => {
      const validation: FieldValidation = {
        type: 'richtext',
        minLength: 5,
      };

      const result = validateField('Hello world', validation);
      expect(result.isValid).toBe(true);
    });
  });
});
