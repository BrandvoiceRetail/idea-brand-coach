/**
 * ServiceProvider
 * Dependency injection container for all services
 */

import React, { createContext, useContext, ReactNode } from 'react';
import { IDiagnosticService } from './interfaces/IDiagnosticService';
import { IUserProfileService } from './interfaces/IUserProfileService';
import { IChatService } from './interfaces/IChatService';
import { IAuthService } from './interfaces/IAuthService';
import { SupabaseDiagnosticService } from './SupabaseDiagnosticService';
import { SupabaseUserProfileService } from './SupabaseUserProfileService';
import { SupabaseChatService } from './SupabaseChatService';
import { SupabaseAuthService } from './SupabaseAuthService';

interface Services {
  diagnosticService: IDiagnosticService;
  userProfileService: IUserProfileService;
  chatService: IChatService;
  authService: IAuthService;
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
  };

  return (
    <ServicesContext.Provider value={services}>
      {children}
    </ServicesContext.Provider>
  );
};
