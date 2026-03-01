/**
 * Avatar Entity
 *
 * Core domain entity representing a target audience avatar.
 * Must belong to a brand. Demographics required. Pain points max 20.
 */

import { Result, success, failure, AvatarId, BrandId, ChatMessage } from '../../shared/types';
import { Demographics } from '../value-objects/Demographics';
import { Psychographics } from '../value-objects/Psychographics';

export interface AvatarProps {
  id: AvatarId;
  brandId: BrandId;
  name: string;
  demographics: Demographics;
  psychographics: Psychographics;
  painPoints: string[];
  goals: string[];
  chatHistory?: ChatMessage[];
}

const MAX_NAME_LENGTH = 100;
const MAX_PAIN_POINTS = 20;
const MAX_GOALS = 20;
const MAX_ITEM_LENGTH = 500;

export class Avatar {
  readonly id: AvatarId;
  readonly brandId: BrandId;
  private _name: string;
  private _demographics: Demographics;
  private _psychographics: Psychographics;
  private _painPoints: string[];
  private _goals: string[];
  private _chatHistory: ChatMessage[];

  private constructor(props: AvatarProps) {
    this.id = props.id;
    this.brandId = props.brandId;
    this._name = props.name;
    this._demographics = props.demographics;
    this._psychographics = props.psychographics;
    this._painPoints = [...props.painPoints];
    this._goals = [...props.goals];
    this._chatHistory = props.chatHistory ? [...props.chatHistory] : [];
  }

  get name(): string {
    return this._name;
  }

  get demographics(): Demographics {
    return this._demographics;
  }

  get psychographics(): Psychographics {
    return this._psychographics;
  }

  get painPoints(): readonly string[] {
    return this._painPoints;
  }

  get goals(): readonly string[] {
    return this._goals;
  }

  get chatHistory(): readonly ChatMessage[] {
    return this._chatHistory;
  }

  static create(props: AvatarProps): Result<Avatar> {
    const errors = Avatar.validate(props);
    if (errors.length > 0) {
      return failure(errors.join('; '));
    }
    return success(new Avatar(props));
  }

  static validate(props: AvatarProps): string[] {
    const errors: string[] = [];

    if (!props.id || props.id.trim().length === 0) {
      errors.push('id is required');
    }

    if (!props.brandId || props.brandId.trim().length === 0) {
      errors.push('brandId is required');
    }

    if (!props.name || props.name.trim().length === 0) {
      errors.push('name is required');
    } else if (props.name.length > MAX_NAME_LENGTH) {
      errors.push(`name cannot exceed ${MAX_NAME_LENGTH} characters`);
    }

    if (!props.demographics) {
      errors.push('demographics is required');
    }

    if (!props.psychographics) {
      errors.push('psychographics is required');
    }

    if (!Array.isArray(props.painPoints)) {
      errors.push('painPoints must be an array');
    } else if (props.painPoints.length > MAX_PAIN_POINTS) {
      errors.push(`painPoints cannot exceed ${MAX_PAIN_POINTS} items`);
    } else {
      props.painPoints.forEach((p, i) => {
        if (typeof p !== 'string' || p.trim().length === 0) {
          errors.push(`painPoints[${i}] must be a non-empty string`);
        } else if (p.length > MAX_ITEM_LENGTH) {
          errors.push(`painPoints[${i}] exceeds max length of ${MAX_ITEM_LENGTH}`);
        }
      });
    }

    if (!Array.isArray(props.goals)) {
      errors.push('goals must be an array');
    } else if (props.goals.length > MAX_GOALS) {
      errors.push(`goals cannot exceed ${MAX_GOALS} items`);
    } else {
      props.goals.forEach((g, i) => {
        if (typeof g !== 'string' || g.trim().length === 0) {
          errors.push(`goals[${i}] must be a non-empty string`);
        } else if (g.length > MAX_ITEM_LENGTH) {
          errors.push(`goals[${i}] exceeds max length of ${MAX_ITEM_LENGTH}`);
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
    return success(undefined);
  }

  updateDemographics(demographics: Demographics): Result<void> {
    this._demographics = demographics;
    return success(undefined);
  }

  updatePsychographics(psychographics: Psychographics): Result<void> {
    this._psychographics = psychographics;
    return success(undefined);
  }

  addPainPoint(painPoint: string): Result<void> {
    if (!painPoint || painPoint.trim().length === 0) {
      return failure('painPoint must be a non-empty string');
    }
    if (painPoint.length > MAX_ITEM_LENGTH) {
      return failure(`painPoint exceeds max length of ${MAX_ITEM_LENGTH}`);
    }
    if (this._painPoints.length >= MAX_PAIN_POINTS) {
      return failure(`cannot exceed ${MAX_PAIN_POINTS} pain points`);
    }
    this._painPoints.push(painPoint);
    return success(undefined);
  }

  removePainPoint(index: number): Result<void> {
    if (index < 0 || index >= this._painPoints.length) {
      return failure('pain point index out of bounds');
    }
    this._painPoints.splice(index, 1);
    return success(undefined);
  }

  addGoal(goal: string): Result<void> {
    if (!goal || goal.trim().length === 0) {
      return failure('goal must be a non-empty string');
    }
    if (goal.length > MAX_ITEM_LENGTH) {
      return failure(`goal exceeds max length of ${MAX_ITEM_LENGTH}`);
    }
    if (this._goals.length >= MAX_GOALS) {
      return failure(`cannot exceed ${MAX_GOALS} goals`);
    }
    this._goals.push(goal);
    return success(undefined);
  }

  removeGoal(index: number): Result<void> {
    if (index < 0 || index >= this._goals.length) {
      return failure('goal index out of bounds');
    }
    this._goals.splice(index, 1);
    return success(undefined);
  }

  addChatMessage(message: ChatMessage): void {
    this._chatHistory.push(message);
  }

  toPlainObject(): AvatarProps {
    return {
      id: this.id,
      brandId: this.brandId,
      name: this._name,
      demographics: this._demographics,
      psychographics: this._psychographics,
      painPoints: [...this._painPoints],
      goals: [...this._goals],
      chatHistory: [...this._chatHistory],
    };
  }
}
