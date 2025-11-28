/**
 * Sync Service Singleton
 * Provides global access to the sync service for operations like chat
 */

import { KnowledgeRepository } from './knowledge-repository';
import { SupabaseSyncService } from './supabase-sync-service';
import type { ISyncService } from './interfaces';

let syncServiceInstance: ISyncService | null = null;
let repositoryInstance: KnowledgeRepository | null = null;

/**
 * Initialize and get the sync service instance
 */
export async function getSyncService(): Promise<ISyncService> {
  if (!syncServiceInstance) {
    // Initialize repository first
    if (!repositoryInstance) {
      repositoryInstance = new KnowledgeRepository({
        dbName: 'idea-brand-coach',
        dbVersion: 1,
        syncInterval: 30000,
        conflictResolution: 'local-first'
      });
      await repositoryInstance.initialize();
    }

    // Create sync service
    syncServiceInstance = new SupabaseSyncService(repositoryInstance);
  }

  return syncServiceInstance;
}

/**
 * Force sync all unsynced data for a user
 * Use before operations that need guaranteed sync (like chat)
 */
export async function forceSyncUserData(userId: string): Promise<void> {
  const syncService = await getSyncService();
  await syncService.forceSyncAll(userId);
}
