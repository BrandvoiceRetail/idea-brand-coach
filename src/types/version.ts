/**
 * Version preference types for the V1/V2 version management system.
 */

export type AppVersion = 'v1' | 'v2';

export interface VersionSwitchEvent {
  from: AppVersion;
  to: AppVersion;
  timestamp: string;
}

export interface VersionPreference {
  version: AppVersion;
  hasSeenIntroduction: boolean;
  switchHistory: VersionSwitchEvent[];
  lastUpdated: string;
}

export interface VersionContextValue {
  currentVersion: AppVersion;
  hasSeenIntroduction: boolean;
  switchHistory: VersionSwitchEvent[];
  setVersion: (version: AppVersion) => void;
  markIntroductionSeen: () => void;
  isNewUser: boolean;
}
