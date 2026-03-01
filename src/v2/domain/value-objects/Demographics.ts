/**
 * Demographics Value Object
 *
 * Immutable value object representing target audience demographic data.
 * Enforces validation rules for age range, income, and location format.
 */

import { Result, success, failure } from '../../shared/types';

export interface DemographicsProps {
  ageMin: number;
  ageMax: number;
  gender?: string;
  income?: string;
  education?: string;
  occupation?: string;
  location?: string;
  maritalStatus?: string;
}

const MIN_AGE = 18;
const MAX_AGE = 120;

const VALID_GENDERS = ['male', 'female', 'non-binary', 'other', 'all'];
const VALID_EDUCATION_LEVELS = [
  'high-school',
  'some-college',
  'associates',
  'bachelors',
  'masters',
  'doctorate',
  'trade-school',
  'other',
];
const VALID_MARITAL_STATUSES = ['single', 'married', 'divorced', 'widowed', 'partnered', 'other'];

export class Demographics {
  readonly ageMin: number;
  readonly ageMax: number;
  readonly gender?: string;
  readonly income?: string;
  readonly education?: string;
  readonly occupation?: string;
  readonly location?: string;
  readonly maritalStatus?: string;

  private constructor(props: DemographicsProps) {
    this.ageMin = props.ageMin;
    this.ageMax = props.ageMax;
    this.gender = props.gender;
    this.income = props.income;
    this.education = props.education;
    this.occupation = props.occupation;
    this.location = props.location;
    this.maritalStatus = props.maritalStatus;
  }

  static create(props: DemographicsProps): Result<Demographics> {
    const errors = Demographics.validate(props);
    if (errors.length > 0) {
      return failure(errors.join('; '));
    }
    return success(new Demographics(props));
  }

  static validate(props: DemographicsProps): string[] {
    const errors: string[] = [];

    if (!Number.isInteger(props.ageMin) || props.ageMin < MIN_AGE || props.ageMin > MAX_AGE) {
      errors.push(`ageMin must be an integer between ${MIN_AGE} and ${MAX_AGE}`);
    }

    if (!Number.isInteger(props.ageMax) || props.ageMax < MIN_AGE || props.ageMax > MAX_AGE) {
      errors.push(`ageMax must be an integer between ${MIN_AGE} and ${MAX_AGE}`);
    }

    if (props.ageMin > props.ageMax) {
      errors.push('ageMin must be less than or equal to ageMax');
    }

    if (props.gender && !VALID_GENDERS.includes(props.gender.toLowerCase())) {
      errors.push(`gender must be one of: ${VALID_GENDERS.join(', ')}`);
    }

    if (props.income && props.income.trim().length === 0) {
      errors.push('income cannot be empty if provided');
    }

    if (props.education && !VALID_EDUCATION_LEVELS.includes(props.education.toLowerCase())) {
      errors.push(`education must be one of: ${VALID_EDUCATION_LEVELS.join(', ')}`);
    }

    if (props.occupation && props.occupation.trim().length === 0) {
      errors.push('occupation cannot be empty if provided');
    }

    if (props.location && props.location.trim().length === 0) {
      errors.push('location cannot be empty if provided');
    }

    if (props.maritalStatus && !VALID_MARITAL_STATUSES.includes(props.maritalStatus.toLowerCase())) {
      errors.push(`maritalStatus must be one of: ${VALID_MARITAL_STATUSES.join(', ')}`);
    }

    return errors;
  }

  equals(other: Demographics): boolean {
    return (
      this.ageMin === other.ageMin &&
      this.ageMax === other.ageMax &&
      this.gender === other.gender &&
      this.income === other.income &&
      this.education === other.education &&
      this.occupation === other.occupation &&
      this.location === other.location &&
      this.maritalStatus === other.maritalStatus
    );
  }

  toPlainObject(): DemographicsProps {
    return {
      ageMin: this.ageMin,
      ageMax: this.ageMax,
      gender: this.gender,
      income: this.income,
      education: this.education,
      occupation: this.occupation,
      location: this.location,
      maritalStatus: this.maritalStatus,
    };
  }
}
