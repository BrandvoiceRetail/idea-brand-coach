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
 *
 * @property {string} dbName - IndexedDB database name
 * @property {number} dbVersion - Database schema version for migrations
 * @property {number} [syncInterval] - Interval in milliseconds for periodic sync (default: 30000)
 * @property {'local-first' | 'remote-first' | 'manual'} [conflictResolution] - Strategy for handling sync conflicts (default: 'local-first')
 */
export interface FieldSyncConfig {
  dbName: string;
  dbVersion: number;
  syncInterval?: number;
  conflictResolution?: 'local-first' | 'remote-first' | 'manual';
}

/**
 * Callback for connection state changes
 *
 * @callback ConnectionCallback
 * @param {boolean} online - True if connection is online, false if offline
 */
type ConnectionCallback = (online: boolean) => void;

/**
 * Callback for sync status changes
 *
 * @callback SyncStatusCallback
 * @param {SyncStatus} status - Current sync status ('synced' | 'syncing' | 'offline' | 'error')
 */
type SyncStatusCallback = (status: SyncStatus) => void;

/**
 * Field Sync Service
 *
 * Singleton service that manages field synchronization between local IndexedDB storage
 * and remote Supabase backend. Provides automatic online/offline detection and
 * handles background sync operations.
 *
 * @class
 * @example
 * // Initialize the service
 * const syncService = FieldSyncService.getInstance({
 *   dbName: 'idea-brand-coach',
 *   dbVersion: 1,
 *   syncInterval: 30000,
 *   conflictResolution: 'local-first'
 * });
 *
 * @example
 * // Save and sync a field
 * await syncService.saveField(
 *   userId,
 *   'brand-name',
 *   'My Brand',
 *   'brand-basics',
 *   (status) => console.log('Sync status:', status)
 * );
 *
 * @example
 * // Listen for connection changes
 * const unsubscribe = syncService.onConnectionChange((online) => {
 *   console.log('Connection status:', online ? 'online' : 'offline');
 * });
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
   *
   * @param {FieldSyncConfig} [config] - Configuration (required on first call)
   * @returns {FieldSyncService} The singleton instance
   * @throws {Error} If config is not provided on first initialization
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
   *
   * Creates and initializes the IndexedDB repository and Supabase sync service.
   * Safe to call multiple times - will only initialize once.
   *
   * @returns {Promise<void>}
   * @throws {Error} If initialization fails
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
   *
   * @returns {Promise<KnowledgeRepository>} The initialized repository
   * @throws {Error} If repository initialization fails
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
   *
   * @returns {Promise<SupabaseSyncService>} The initialized sync service
   * @throws {Error} If sync service initialization fails
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
   *
   * @returns {boolean} True if online, false if offline
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
   *
   * @param {ConnectionCallback} callback - Function to call when connection state changes
   * @returns {() => void} Unsubscribe function to remove the listener
   * @example
   * const unsubscribe = syncService.onConnectionChange((online) => {
   *   if (online) {
   *     console.log('Back online - syncing...');
   *   }
   * });
   * // Later: unsubscribe();
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
   *
   * Saves immediately to IndexedDB and queues background sync to Supabase.
   * Does not throw on sync errors - local save always succeeds.
   *
   * @param {string} userId - User ID who owns the field
   * @param {string} fieldIdentifier - Unique identifier for the field
   * @param {string} content - Serialized field content to save
   * @param {KnowledgeCategory} category - Category for organizing fields
   * @param {SyncStatusCallback} [onStatusChange] - Optional callback for sync status updates
   * @returns {Promise<void>}
   * @example
   * await syncService.saveField(
   *   userId,
   *   'brand-name',
   *   'Acme Corp',
   *   'brand-basics',
   *   (status) => {
   *     console.log('Sync status:', status);
   *   }
   * );
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
   * Load a field value from local repository
   *
   * @param {string} userId - User ID who owns the field
   * @param {string} fieldIdentifier - Unique identifier for the field
   * @returns {Promise<string | null>} The field content, or null if not found
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
   *
   * @param {string} userId - User ID who owns the field
   * @param {string} fieldIdentifier - Unique identifier for the field
   * @returns {Promise<string | null>} The field content from remote, or null if not found
   * @throws {Error} If remote fetch fails
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
   *
   * Performs full bidirectional sync of all fields between local and remote.
   *
   * @param {string} userId - User ID whose fields to sync
   * @returns {Promise<void>}
   * @throws {Error} If sync fails
   */
  public async syncAllFields(userId: string): Promise<void> {
    const sync = await this.getSyncService();
    await sync.syncAllFields(userId);
  }

  /**
   * Set up periodic sync for a user
   *
   * @param {string} userId - User ID whose fields to sync
   * @param {number} [interval=30000] - Interval in milliseconds (default: 30 seconds)
   * @returns {() => void} Cleanup function to stop the periodic sync
   * @example
   * const stopSync = syncService.setupPeriodicSync(userId, 60000); // Every 60 seconds
   * // Later: stopSync();
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
 *
 * @constant
 * @type {FieldSyncConfig}
 */
export const DEFAULT_FIELD_SYNC_CONFIG: FieldSyncConfig = {
  dbName: 'idea-brand-coach',
  dbVersion: 1,
  syncInterval: 30000,
  conflictResolution: 'local-first'
};

/**
 * Helper function to get or create field sync service
 *
 * @param {FieldSyncConfig} [config] - Optional configuration (uses DEFAULT_FIELD_SYNC_CONFIG if not provided)
 * @returns {FieldSyncService} The singleton FieldSyncService instance
 * @example
 * const syncService = getFieldSyncService();
 * await syncService.initialize();
 */
export function getFieldSyncService(config?: FieldSyncConfig): FieldSyncService {
  return FieldSyncService.getInstance(config || DEFAULT_FIELD_SYNC_CONFIG);
}
