/**
 * Field Sync Service
 * Manages shared synchronization logic for field persistence
 * Provides singleton repository/sync service instances and connection handling
 */

import { KnowledgeRepository } from '@/lib/knowledge-base/knowledge-repository';
import { SupabaseSyncService } from '@/lib/knowledge-base/supabase-sync-service';
import type {
  KnowledgeBaseConfig,
  SyncStatus,
  KnowledgeCategory
} from '@/lib/knowledge-base/interfaces';

/**
 * Configuration for field sync service
 */
export interface FieldSyncConfig {
  dbName: string;
  dbVersion: number;
  syncInterval?: number;
  conflictResolution?: 'local-first' | 'remote-first' | 'manual';
}

/**
 * Callback for connection state changes
 */
type ConnectionCallback = (online: boolean) => void;

/**
 * Callback for sync status changes
 */
type SyncStatusCallback = (status: SyncStatus) => void;

/**
 * Field Sync Service
 * Handles repository initialization, sync service management,
 * and online/offline state tracking
 */
export class FieldSyncService {
  private static instance: FieldSyncService | null = null;
  private repository: KnowledgeRepository | null = null;
  private syncService: SupabaseSyncService | null = null;
  private isInitialized = false;
  private connectionListeners: Set<ConnectionCallback> = new Set();
  private config: FieldSyncConfig;
  private onlineStatus = navigator.onLine;

  /**
   * Private constructor for singleton pattern
   */
  private constructor(config: FieldSyncConfig) {
    this.config = config;
    this.setupConnectionListeners();
  }

  /**
   * Get or create the singleton instance
   */
  public static getInstance(config?: FieldSyncConfig): FieldSyncService {
    if (!FieldSyncService.instance) {
      if (!config) {
        throw new Error('FieldSyncService requires config on first initialization');
      }
      FieldSyncService.instance = new FieldSyncService(config);
    }
    return FieldSyncService.instance;
  }

  /**
   * Reset singleton instance (useful for testing)
   */
  public static resetInstance(): void {
    if (FieldSyncService.instance) {
      FieldSyncService.instance.cleanup();
      FieldSyncService.instance = null;
    }
  }

  /**
   * Initialize repository and sync service
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    console.log('[FieldSyncService] Initializing repository...');

    try {
      // Create repository
      const repoConfig: KnowledgeBaseConfig = {
        dbName: this.config.dbName,
        dbVersion: this.config.dbVersion,
        syncInterval: this.config.syncInterval || 30000,
        conflictResolution: this.config.conflictResolution || 'local-first'
      };

      this.repository = new KnowledgeRepository(repoConfig);
      await this.repository.initialize();

      // Create sync service
      this.syncService = new SupabaseSyncService(this.repository);

      this.isInitialized = true;
      console.log('[FieldSyncService] Initialization complete');
    } catch (error) {
      console.error('[FieldSyncService] Initialization failed:', error);
      throw new Error(
        `Failed to initialize FieldSyncService: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get repository instance (ensures initialization)
   */
  public async getRepository(): Promise<KnowledgeRepository> {
    if (!this.repository) {
      await this.initialize();
    }
    if (!this.repository) {
      throw new Error('Repository initialization failed');
    }
    return this.repository;
  }

  /**
   * Get sync service instance (ensures initialization)
   */
  public async getSyncService(): Promise<SupabaseSyncService> {
    if (!this.syncService) {
      await this.initialize();
    }
    if (!this.syncService) {
      throw new Error('Sync service initialization failed');
    }
    return this.syncService;
  }

  /**
   * Check if currently online
   */
  public isOnline(): boolean {
    return this.onlineStatus;
  }

  /**
   * Set up browser online/offline event listeners
   */
  private setupConnectionListeners(): void {
    const handleOnline = (): void => {
      console.log('[FieldSyncService] Connection restored');
      this.onlineStatus = true;
      this.notifyConnectionListeners(true);
    };

    const handleOffline = (): void => {
      console.log('[FieldSyncService] Connection lost');
      this.onlineStatus = false;
      this.notifyConnectionListeners(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Store handlers for cleanup
    this.cleanupHandlers = { handleOnline, handleOffline };
  }

  /**
   * Cleanup handlers for event listeners
   */
  private cleanupHandlers: {
    handleOnline: () => void;
    handleOffline: () => void;
  } | null = null;

  /**
   * Register callback for connection state changes
   * Returns unsubscribe function
   */
  public onConnectionChange(callback: ConnectionCallback): () => void {
    this.connectionListeners.add(callback);

    // Return unsubscribe function
    return () => {
      this.connectionListeners.delete(callback);
    };
  }

  /**
   * Notify all connection listeners
   */
  private notifyConnectionListeners(online: boolean): void {
    this.connectionListeners.forEach(listener => {
      try {
        listener(online);
      } catch (error) {
        console.error('[FieldSyncService] Error in connection listener:', error);
      }
    });
  }

  /**
   * Save a field value locally and queue for sync
   */
  public async saveField(
    userId: string,
    fieldIdentifier: string,
    content: string,
    category: KnowledgeCategory,
    onStatusChange?: SyncStatusCallback
  ): Promise<void> {
    const repo = await this.getRepository();
    const sync = await this.getSyncService();

    // Save locally immediately
    await repo.saveField(userId, fieldIdentifier, content, category);

    // Queue for background sync
    if (onStatusChange) {
      onStatusChange('syncing');
    }

    try {
      await sync.queueSync(userId, fieldIdentifier, content);
      if (onStatusChange) {
        onStatusChange('synced');
      }
    } catch (error) {
      console.error('[FieldSyncService] Sync error:', error);
      if (onStatusChange) {
        onStatusChange('offline');
      }
      // Don't throw - local save succeeded
    }
  }

  /**
   * Load a field value from repository
   */
  public async loadField(
    userId: string,
    fieldIdentifier: string
  ): Promise<string | null> {
    const repo = await this.getRepository();
    return repo.getField(userId, fieldIdentifier);
  }

  /**
   * Fetch field from remote (Supabase)
   */
  public async fetchFromRemote(
    userId: string,
    fieldIdentifier: string
  ): Promise<string | null> {
    const sync = await this.getSyncService();
    return sync.fetchFromSupabase(userId, fieldIdentifier);
  }

  /**
   * Sync all fields for a user
   */
  public async syncAllFields(userId: string): Promise<void> {
    const sync = await this.getSyncService();
    await sync.syncAllFields(userId);
  }

  /**
   * Set up periodic sync for a user
   * Returns cleanup function to stop the interval
   */
  public setupPeriodicSync(
    userId: string,
    interval: number = 30000
  ): () => void {
    const intervalId = setInterval(async () => {
      try {
        await this.syncAllFields(userId);
      } catch (error) {
        console.error('[FieldSyncService] Periodic sync failed:', error);
      }
    }, interval);

    // Return cleanup function
    return () => {
      clearInterval(intervalId);
    };
  }

  /**
   * Cleanup resources
   */
  public cleanup(): void {
    // Remove event listeners
    if (this.cleanupHandlers) {
      window.removeEventListener('online', this.cleanupHandlers.handleOnline);
      window.removeEventListener('offline', this.cleanupHandlers.handleOffline);
    }

    // Clear connection listeners
    this.connectionListeners.clear();

    // Reset state
    this.repository = null;
    this.syncService = null;
    this.isInitialized = false;
  }
}

/**
 * Default configuration for field sync
 */
export const DEFAULT_FIELD_SYNC_CONFIG: FieldSyncConfig = {
  dbName: 'idea-brand-coach',
  dbVersion: 1,
  syncInterval: 30000,
  conflictResolution: 'local-first'
};

/**
 * Helper function to get or create field sync service
 */
export function getFieldSyncService(config?: FieldSyncConfig): FieldSyncService {
  return FieldSyncService.getInstance(config || DEFAULT_FIELD_SYNC_CONFIG);
}
