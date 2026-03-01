/**
 * Brand Entity
 *
 * Core domain entity representing a brand in the IDEA Brand Coach system.
 * Enforces business rules: name is required, vision/mission max 500 chars,
 * values array max 10 items.
 */

import { Result, success, failure, BrandId, UserId } from '../../shared/types';

export interface BrandProps {
  id: BrandId;
  userId: UserId;
  name: string;
  vision?: string;
  mission?: string;
  values?: string[];
  positioning?: string;
  createdAt: Date;
  updatedAt: Date;
}

const MAX_NAME_LENGTH = 100;
const MAX_VISION_LENGTH = 500;
const MAX_MISSION_LENGTH = 500;
const MAX_POSITIONING_LENGTH = 500;
const MAX_VALUES_COUNT = 10;
const MAX_VALUE_ITEM_LENGTH = 100;

export class Brand {
  readonly id: BrandId;
  readonly userId: UserId;
  private _name: string;
  private _vision?: string;
  private _mission?: string;
  private _values: string[];
  private _positioning?: string;
  readonly createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: BrandProps) {
    this.id = props.id;
    this.userId = props.userId;
    this._name = props.name;
    this._vision = props.vision;
    this._mission = props.mission;
    this._values = props.values ? [...props.values] : [];
    this._positioning = props.positioning;
    this.createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  get name(): string {
    return this._name;
  }

  get vision(): string | undefined {
    return this._vision;
  }

  get mission(): string | undefined {
    return this._mission;
  }

  get values(): readonly string[] {
    return this._values;
  }

  get positioning(): string | undefined {
    return this._positioning;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  static create(props: BrandProps): Result<Brand> {
    const errors = Brand.validate(props);
    if (errors.length > 0) {
      return failure(errors.join('; '));
    }
    return success(new Brand(props));
  }

  static validate(props: BrandProps): string[] {
    const errors: string[] = [];

    if (!props.id || props.id.trim().length === 0) {
      errors.push('id is required');
    }

    if (!props.userId || props.userId.trim().length === 0) {
      errors.push('userId is required');
    }

    if (!props.name || props.name.trim().length === 0) {
      errors.push('name is required');
    } else if (props.name.length > MAX_NAME_LENGTH) {
      errors.push(`name cannot exceed ${MAX_NAME_LENGTH} characters`);
    }

    if (props.vision && props.vision.length > MAX_VISION_LENGTH) {
      errors.push(`vision cannot exceed ${MAX_VISION_LENGTH} characters`);
    }

    if (props.mission && props.mission.length > MAX_MISSION_LENGTH) {
      errors.push(`mission cannot exceed ${MAX_MISSION_LENGTH} characters`);
    }

    if (props.positioning && props.positioning.length > MAX_POSITIONING_LENGTH) {
      errors.push(`positioning cannot exceed ${MAX_POSITIONING_LENGTH} characters`);
    }

    if (props.values) {
      if (props.values.length > MAX_VALUES_COUNT) {
        errors.push(`values cannot exceed ${MAX_VALUES_COUNT} items`);
      }
      props.values.forEach((v, i) => {
        if (typeof v !== 'string' || v.trim().length === 0) {
          errors.push(`values[${i}] must be a non-empty string`);
        } else if (v.length > MAX_VALUE_ITEM_LENGTH) {
          errors.push(`values[${i}] exceeds max length of ${MAX_VALUE_ITEM_LENGTH}`);
        }
      });
    }

    return errors;
  }

  updateName(name: string): Result<void> {
    if (!name || name.trim().length === 0) {
      return failure('name is required');
    }
    if (name.length > MAX_NAME_LENGTH) {
      return failure(`name cannot exceed ${MAX_NAME_LENGTH} characters`);
    }
    this._name = name;
    this._updatedAt = new Date();
    return success(undefined);
  }

  updateVision(vision: string): Result<void> {
    if (vision.length > MAX_VISION_LENGTH) {
      return failure(`vision cannot exceed ${MAX_VISION_LENGTH} characters`);
    }
    this._vision = vision;
    this._updatedAt = new Date();
    return success(undefined);
  }

  updateMission(mission: string): Result<void> {
    if (mission.length > MAX_MISSION_LENGTH) {
      return failure(`mission cannot exceed ${MAX_MISSION_LENGTH} characters`);
    }
    this._mission = mission;
    this._updatedAt = new Date();
    return success(undefined);
  }

  updatePositioning(positioning: string): Result<void> {
    if (positioning.length > MAX_POSITIONING_LENGTH) {
      return failure(`positioning cannot exceed ${MAX_POSITIONING_LENGTH} characters`);
    }
    this._positioning = positioning;
    this._updatedAt = new Date();
    return success(undefined);
  }

  addValue(value: string): Result<void> {
    if (!value || value.trim().length === 0) {
      return failure('value must be a non-empty string');
    }
    if (value.length > MAX_VALUE_ITEM_LENGTH) {
      return failure(`value exceeds max length of ${MAX_VALUE_ITEM_LENGTH}`);
    }
    if (this._values.length >= MAX_VALUES_COUNT) {
      return failure(`cannot exceed ${MAX_VALUES_COUNT} values`);
    }
    if (this._values.includes(value)) {
      return failure('value already exists');
    }
    this._values.push(value);
    this._updatedAt = new Date();
    return success(undefined);
  }

  removeValue(value: string): Result<void> {
    const index = this._values.indexOf(value);
    if (index === -1) {
      return failure('value not found');
    }
    this._values.splice(index, 1);
    this._updatedAt = new Date();
    return success(undefined);
  }

  toPlainObject(): BrandProps {
    return {
      id: this.id,
      userId: this.userId,
      name: this._name,
      vision: this._vision,
      mission: this._mission,
      values: [...this._values],
      positioning: this._positioning,
      createdAt: this.createdAt,
      updatedAt: this._updatedAt,
    };
  }
}
