/**
 * Psychographics Value Object
 *
 * Immutable value object representing target audience psychographic data.
 * Captures values, interests, lifestyle attributes, and personality traits.
 */

import { Result, success, failure } from '../../shared/types';

export interface PsychographicsProps {
  values: string[];
  interests: string[];
  lifestyle: string[];
  personalityTraits?: string[];
  mediaConsumption?: string[];
  purchaseBehavior?: string;
}

const MAX_VALUES = 15;
const MAX_INTERESTS = 20;
const MAX_LIFESTYLE = 15;
const MAX_PERSONALITY_TRAITS = 10;
const MAX_MEDIA_CONSUMPTION = 10;
const MAX_ITEM_LENGTH = 200;

export class Psychographics {
  readonly values: readonly string[];
  readonly interests: readonly string[];
  readonly lifestyle: readonly string[];
  readonly personalityTraits?: readonly string[];
  readonly mediaConsumption?: readonly string[];
  readonly purchaseBehavior?: string;

  private constructor(props: PsychographicsProps) {
    this.values = Object.freeze([...props.values]);
    this.interests = Object.freeze([...props.interests]);
    this.lifestyle = Object.freeze([...props.lifestyle]);
    this.personalityTraits = props.personalityTraits
      ? Object.freeze([...props.personalityTraits])
      : undefined;
    this.mediaConsumption = props.mediaConsumption
      ? Object.freeze([...props.mediaConsumption])
      : undefined;
    this.purchaseBehavior = props.purchaseBehavior;
  }

  static create(props: PsychographicsProps): Result<Psychographics> {
    const errors = Psychographics.validate(props);
    if (errors.length > 0) {
      return failure(errors.join('; '));
    }
    return success(new Psychographics(props));
  }

  static validate(props: PsychographicsProps): string[] {
    const errors: string[] = [];

    if (!Array.isArray(props.values) || props.values.length === 0) {
      errors.push('values must be a non-empty array');
    } else if (props.values.length > MAX_VALUES) {
      errors.push(`values cannot exceed ${MAX_VALUES} items`);
    } else {
      props.values.forEach((v, i) => {
        if (typeof v !== 'string' || v.trim().length === 0) {
          errors.push(`values[${i}] must be a non-empty string`);
        } else if (v.length > MAX_ITEM_LENGTH) {
          errors.push(`values[${i}] exceeds max length of ${MAX_ITEM_LENGTH}`);
        }
      });
    }

    if (!Array.isArray(props.interests) || props.interests.length === 0) {
      errors.push('interests must be a non-empty array');
    } else if (props.interests.length > MAX_INTERESTS) {
      errors.push(`interests cannot exceed ${MAX_INTERESTS} items`);
    } else {
      props.interests.forEach((v, i) => {
        if (typeof v !== 'string' || v.trim().length === 0) {
          errors.push(`interests[${i}] must be a non-empty string`);
        } else if (v.length > MAX_ITEM_LENGTH) {
          errors.push(`interests[${i}] exceeds max length of ${MAX_ITEM_LENGTH}`);
        }
      });
    }

    if (!Array.isArray(props.lifestyle) || props.lifestyle.length === 0) {
      errors.push('lifestyle must be a non-empty array');
    } else if (props.lifestyle.length > MAX_LIFESTYLE) {
      errors.push(`lifestyle cannot exceed ${MAX_LIFESTYLE} items`);
    } else {
      props.lifestyle.forEach((v, i) => {
        if (typeof v !== 'string' || v.trim().length === 0) {
          errors.push(`lifestyle[${i}] must be a non-empty string`);
        } else if (v.length > MAX_ITEM_LENGTH) {
          errors.push(`lifestyle[${i}] exceeds max length of ${MAX_ITEM_LENGTH}`);
        }
      });
    }

    if (props.personalityTraits) {
      if (!Array.isArray(props.personalityTraits)) {
        errors.push('personalityTraits must be an array');
      } else if (props.personalityTraits.length > MAX_PERSONALITY_TRAITS) {
        errors.push(`personalityTraits cannot exceed ${MAX_PERSONALITY_TRAITS} items`);
      }
    }

    if (props.mediaConsumption) {
      if (!Array.isArray(props.mediaConsumption)) {
        errors.push('mediaConsumption must be an array');
      } else if (props.mediaConsumption.length > MAX_MEDIA_CONSUMPTION) {
        errors.push(`mediaConsumption cannot exceed ${MAX_MEDIA_CONSUMPTION} items`);
      }
    }

    return errors;
  }

  equals(other: Psychographics): boolean {
    const arraysEqual = (a: readonly string[], b: readonly string[]): boolean =>
      a.length === b.length && a.every((val, idx) => val === b[idx]);

    return (
      arraysEqual(this.values, other.values) &&
      arraysEqual(this.interests, other.interests) &&
      arraysEqual(this.lifestyle, other.lifestyle) &&
      this.purchaseBehavior === other.purchaseBehavior
    );
  }

  toPlainObject(): PsychographicsProps {
    return {
      values: [...this.values],
      interests: [...this.interests],
      lifestyle: [...this.lifestyle],
      personalityTraits: this.personalityTraits ? [...this.personalityTraits] : undefined,
      mediaConsumption: this.mediaConsumption ? [...this.mediaConsumption] : undefined,
      purchaseBehavior: this.purchaseBehavior,
    };
  }
}
