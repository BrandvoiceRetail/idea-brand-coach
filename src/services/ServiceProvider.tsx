/**
 * ServiceProvider
 * Dependency injection container for all services
 */

import React, { createContext, useContext, ReactNode } from 'react';
import { IDiagnosticService } from './interfaces/IDiagnosticService';
import { IUserProfileService } from './interfaces/IUserProfileService';
import { IChatService } from './interfaces/IChatService';
import { IAuthService } from './interfaces/IAuthService';
import { IAvatarService } from './interfaces/IAvatarService';
import { IProductDataService } from './interfaces/IProductDataService';
import { ISignatureService } from './interfaces/ISignatureService';
import { ICompetitorInsightsService } from './interfaces/ICompetitorInsightsService';
import { ITrustGapSnapshotService } from './interfaces/ITrustGapSnapshotService';
import { INotificationChannel } from './interfaces/INotificationChannel';
import { SupabaseDiagnosticService } from './SupabaseDiagnosticService';
import { SupabaseUserProfileService } from './SupabaseUserProfileService';
import { SupabaseChatService } from './SupabaseChatService';
import { SupabaseAuthService } from './SupabaseAuthService';
import { SupabaseAvatarService } from './SupabaseAvatarService';
import { SupabaseProductDataService } from './SupabaseProductDataService';
import { SupabaseSignatureService } from './SupabaseSignatureService';
import { SupabaseCompetitorInsightsService } from './SupabaseCompetitorInsightsService';
import { SupabaseTrustGapSnapshotService } from './SupabaseTrustGapSnapshotService';
import { SupabaseInAppNotificationChannel } from './SupabaseInAppNotificationChannel';

interface Services {
  diagnosticService: IDiagnosticService;
  userProfileService: IUserProfileService;
  chatService: IChatService;
  authService: IAuthService;
  avatarService: IAvatarService;
  productDataService: IProductDataService;
  signatureService: ISignatureService;
  competitorInsightsService: ICompetitorInsightsService;
  trustGapSnapshotService: ITrustGapSnapshotService;
  notificationChannel: INotificationChannel;
}

const ServicesContext = createContext<Services | null>(null);

export const useServices = (): Services => {
  const context = useContext(ServicesContext);
  if (!context) {
    throw new Error('useServices must be used within ServiceProvider');
  }
  return context;
};

interface ServiceProviderProps {
  children: ReactNode;
}

export const ServiceProvider: React.FC<ServiceProviderProps> = ({ children }) => {
  // Instantiate all services
  const services: Services = {
    diagnosticService: new SupabaseDiagnosticService(),
    userProfileService: new SupabaseUserProfileService(),
    chatService: new SupabaseChatService(),
    authService: new SupabaseAuthService(),
    avatarService: new SupabaseAvatarService(),
    productDataService: new SupabaseProductDataService(),
    signatureService: new SupabaseSignatureService(),
    competitorInsightsService: new SupabaseCompetitorInsightsService(),
    trustGapSnapshotService: new SupabaseTrustGapSnapshotService(),
    notificationChannel: new SupabaseInAppNotificationChannel(),
  };

  return (
    <ServicesContext.Provider value={services}>
      {children}
    </ServicesContext.Provider>
  );
};
