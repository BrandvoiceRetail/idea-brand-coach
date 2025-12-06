/**
 * Supabase Sync Service
 * Handles synchronization between local IndexedDB and remote Supabase
 */

import { supabase } from '@/integrations/supabase/client';
import type {
  ISyncService,
  IKnowledgeRepository,
  ConflictInfo,
  SyncStatus,
  KnowledgeEntry
} from './interfaces';

/**
 * Queue for managing sync operations
 */
interface SyncQueueItem {
  userId: string;
  fieldIdentifier: string;
  content: string;
  retryCount: number;
  timestamp: Date;
}

/**
 * Supabase sync service implementation
 * Handles background sync, conflict detection, and retry logic
 */
export class SupabaseSyncService implements ISyncService {
  private syncQueue: Map<string, SyncQueueItem> = new Map();
  private isSyncing = false;
  private maxRetries = 3;
  private retryDelay = 1000; // Start with 1 second
  private onlineListeners: Set<(online: boolean) => void> = new Set();

  constructor(private repository: IKnowledgeRepository) {
    // Start processing queue periodically
    this.startQueueProcessor();
  }

  /**
   * Start background queue processor
   */
  private startQueueProcessor(): void {
    setInterval(() => {
      if (!this.isSyncing && this.isOnline() && this.syncQueue.size > 0) {
        this.processQueue();
      }
    }, 5000); // Process every 5 seconds
  }

  /**
   * Process sync queue
   */
  private async processQueue(): Promise<void> {
    console.log('[SupabaseSyncService] processQueue called, queue size:', this.syncQueue.size);
    if (this.isSyncing || !this.isOnline()) {
      console.log('[SupabaseSyncService] Skipping processQueue:', { isSyncing: this.isSyncing, isOnline: this.isOnline() });
      return;
    }

    this.isSyncing = true;
    console.log('[SupabaseSyncService] Starting queue processing...');

    for (const [key, item] of this.syncQueue.entries()) {
      try {
        await this.performSync(item);
        this.syncQueue.delete(key);
      } catch (error) {
        console.error('Sync failed for item:', item, error);

        // Handle retry logic
        if (item.retryCount < this.maxRetries) {
          item.retryCount++;
          // Exponential backoff
          await this.delay(this.retryDelay * Math.pow(2, item.retryCount));
        } else {
          // Max retries reached, remove from queue
          this.syncQueue.delete(key);
          console.error('Max retries reached for:', item.fieldIdentifier);
        }
      }
    }

    this.isSyncing = false;
  }

  /**
   * Perform actual sync operation
   */
  private async performSync(item: SyncQueueItem): Promise<void> {
    const { userId, fieldIdentifier, content } = item;
    console.log('[SupabaseSyncService] performSync starting for:', { userId, fieldIdentifier });

    // Check for existing remote entry
    console.log('[SupabaseSyncService] Checking for existing entry...');
    const { data: existingData, error: fetchError } = await supabase
      .from('user_knowledge_base')
      .select('*')
      .eq('user_id', userId)
      .eq('field_identifier', fieldIdentifier)
      .eq('is_current', true)
      .single();

    console.log('[SupabaseSyncService] Query result:', { existingData, fetchError });

    if (fetchError && fetchError.code !== 'PGRST116') {
      // PGRST116 means no rows found, which is okay
      console.error('[SupabaseSyncService] Failed to check remote:', fetchError);
      throw new Error(`Failed to check remote: ${fetchError.message}`);
    }

    // Get local entry for metadata
    const localEntry = await this.repository.getFieldEntry(userId, fieldIdentifier);
    if (!localEntry) {
      throw new Error('Local entry not found');
    }

    if (existingData) {
      // Update existing entry
      console.log('[SupabaseSyncService] Updating existing entry:', existingData.id);
      const { error: updateError } = await supabase
        .from('user_knowledge_base')
        .update({
          content,
          structured_data: localEntry.structuredData as unknown as import('@/integrations/supabase/types').Json,
          metadata: localEntry.metadata as unknown as import('@/integrations/supabase/types').Json,
          version: localEntry.version,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingData.id);

      if (updateError) {
        console.error('[SupabaseSyncService] Update failed:', updateError);
        throw new Error(`Failed to update: ${updateError.message}`);
      }
      console.log('[SupabaseSyncService] Update successful');
    } else {
      // Insert new entry
      console.log('[SupabaseSyncService] Inserting new entry for:', fieldIdentifier);
      const insertData = {
        user_id: userId,
        field_identifier: fieldIdentifier,
        category: localEntry.category as string,
        subcategory: localEntry.subcategory,
        content,
        structured_data: localEntry.structuredData as unknown as import('@/integrations/supabase/types').Json,
        metadata: localEntry.metadata as unknown as import('@/integrations/supabase/types').Json,
        version: localEntry.version,
        is_current: true,
        created_at: localEntry.createdAt.toISOString(),
        updated_at: new Date().toISOString()
      };
      console.log('[SupabaseSyncService] Insert data:', insertData);

      const { error: insertError } = await supabase
        .from('user_knowledge_base')
        .insert([insertData]);

      if (insertError) {
        console.error('[SupabaseSyncService] Insert failed:', insertError);
        throw new Error(`Failed to insert: ${insertError.message}`);
      }
      console.log('[SupabaseSyncService] Insert successful');
    }

    // Mark local entry as synced
    await this.repository.markAsSynced(localEntry.id, new Date());

    // Trigger OpenAI vector store sync (non-blocking)
    this.triggerOpenAISync(userId, fieldIdentifier).catch(err => {
      console.warn('OpenAI sync queued for retry:', err);
    });
  }

  /**
   * Trigger sync to OpenAI vector store
   * Non-blocking - failures will be caught by periodic backfill
   */
  private async triggerOpenAISync(userId: string, fieldIdentifier: string): Promise<void> {
    try {
      // Get the entry ID for syncing
      const { data: entry, error: fetchError } = await supabase
        .from('user_knowledge_base')
        .select('id')
        .eq('user_id', userId)
        .eq('field_identifier', fieldIdentifier)
        .eq('is_current', true)
        .single();

      if (fetchError || !entry) {
        console.warn('Could not find entry for OpenAI sync:', fieldIdentifier);
        return;
      }

      // Call the sync edge function
      const { error } = await supabase.functions.invoke('sync-to-openai-vector-store', {
        body: { entry_id: entry.id }
      });

      if (error) {
        console.warn('OpenAI sync failed, will retry:', error);
      } else {
        console.log('OpenAI sync triggered for:', fieldIdentifier);
      }
    } catch (error) {
      // Non-fatal - backfill will catch unsynced entries
      console.warn('OpenAI sync error (will retry):', error);
    }
  }

  /**
   * Queue a field for sync
   */
  async queueSync(userId: string, fieldIdentifier: string, content: string): Promise<void> {
    const key = `${userId}-${fieldIdentifier}`;
    console.log('[SupabaseSyncService] queueSync called for:', { userId, fieldIdentifier, key });

    this.syncQueue.set(key, {
      userId,
      fieldIdentifier,
      content,
      retryCount: 0,
      timestamp: new Date()
    });

    console.log('[SupabaseSyncService] Queue size after adding:', this.syncQueue.size);

    // Try to process immediately if online
    if (this.isOnline() && !this.isSyncing) {
      console.log('[SupabaseSyncService] Triggering immediate processQueue');
      this.processQueue();  // Note: Not awaited - returns Promise immediately
    } else {
      console.log('[SupabaseSyncService] Not processing queue:', { isOnline: this.isOnline(), isSyncing: this.isSyncing });
    }
  }

  /**
   * Sync a single field
   */
  async syncField(userId: string, fieldIdentifier: string, content: string): Promise<SyncStatus> {
    if (!this.isOnline()) {
      await this.queueSync(userId, fieldIdentifier, content);
      return 'offline';
    }

    try {
      await this.performSync({
        userId,
        fieldIdentifier,
        content,
        retryCount: 0,
        timestamp: new Date()
      });
      return 'synced';
    } catch (error) {
      console.error('Sync failed:', error);
      await this.queueSync(userId, fieldIdentifier, content);
      return 'error';
    }
  }

  /**
   * Sync all unsynced fields for a user
   */
  async syncAllFields(userId: string): Promise<void> {
    const unsyncedEntries = await this.repository.getUnsyncedEntries(userId);

    for (const entry of unsyncedEntries) {
      await this.queueSync(userId, entry.fieldIdentifier, entry.content);
    }

    if (this.isOnline() && !this.isSyncing) {
      await this.processQueue();
    }
  }

  /**
   * Force immediate sync of all unsynced fields and wait for completion
   * Use this before operations that need guaranteed sync (like chat)
   */
  async forceSyncAll(userId: string): Promise<void> {
    if (!this.isOnline()) {
      console.log('[SupabaseSyncService] Offline - cannot force sync');
      return;
    }

    console.log('[SupabaseSyncService] Force sync starting for user:', userId);

    // Queue all unsynced entries
    const unsyncedEntries = await this.repository.getUnsyncedEntries(userId);
    console.log('[SupabaseSyncService] Found unsynced entries:', unsyncedEntries.length);

    for (const entry of unsyncedEntries) {
      await this.queueSync(userId, entry.fieldIdentifier, entry.content);
    }

    // Process queue and wait for completion
    await this.waitForQueueEmpty(30000); // 30 second timeout

    console.log('[SupabaseSyncService] Force sync completed');
  }

  /**
   * Wait for sync queue to be empty
   */
  private async waitForQueueEmpty(timeoutMs: number = 30000): Promise<void> {
    const startTime = Date.now();

    while (this.syncQueue.size > 0 || this.isSyncing) {
      if (Date.now() - startTime > timeoutMs) {
        throw new Error('Sync timeout - queue did not empty in time');
      }

      // Trigger processing if not already running
      if (!this.isSyncing && this.syncQueue.size > 0) {
        this.processQueue();
      }

      // Wait a bit before checking again
      await this.delay(100);
    }
  }

  /**
   * Check for conflicts between local and remote
   */
  async checkForConflicts(userId: string): Promise<ConflictInfo[]> {
    const conflicts: ConflictInfo[] = [];
    const localEntries = await this.repository.getAllUserData(userId);

    for (const localEntry of localEntries) {
      const { data: remoteEntry, error } = await supabase
        .from('user_knowledge_base')
        .select('*')
        .eq('user_id', userId)
        .eq('field_identifier', localEntry.fieldIdentifier)
        .eq('is_current', true)
        .single();

      if (error || !remoteEntry) continue;

      // Check if versions differ
      if (remoteEntry.version !== localEntry.version &&
          remoteEntry.content !== localEntry.content) {
        conflicts.push({
          fieldIdentifier: localEntry.fieldIdentifier,
          localVersion: localEntry,
          remoteVersion: {
            id: remoteEntry.id,
            userId: remoteEntry.user_id,
            fieldIdentifier: remoteEntry.field_identifier,
            category: remoteEntry.category as import('./interfaces').KnowledgeCategory,
            subcategory: remoteEntry.subcategory || undefined,
            content: remoteEntry.content,
            version: remoteEntry.version,
            isCurrentVersion: remoteEntry.is_current || false,
            createdAt: new Date(remoteEntry.created_at || ''),
            updatedAt: new Date(remoteEntry.updated_at || ''),
            lastSyncedAt: remoteEntry.last_synced_at ? new Date(remoteEntry.last_synced_at) : undefined
          },
          suggestedResolution: this.suggestResolution(localEntry, remoteEntry)
        });
      }
    }

    return conflicts;
  }

  /**
   * Suggest conflict resolution based on timestamps and content
   */
  private suggestResolution(local: KnowledgeEntry, remote: any): string {
    const localTime = local.updatedAt.getTime();
    const remoteTime = new Date(remote.updated_at).getTime();

    // If local is newer and has more content, suggest local
    if (localTime > remoteTime && local.content.length >= remote.content.length) {
      return local.content;
    }

    // Otherwise suggest remote
    return remote.content;
  }

  /**
   * Fetch field value from Supabase
   */
  async fetchFromSupabase(userId: string, fieldIdentifier: string): Promise<string | null> {
    try {
      console.log('[SupabaseSyncService] fetchFromSupabase:', { userId, fieldIdentifier });
      const { data, error } = await supabase
        .from('user_knowledge_base')
        .select('content')
        .eq('user_id', userId)
        .eq('field_identifier', fieldIdentifier)
        .eq('is_current', true)
        .maybeSingle(); // Use maybeSingle to avoid error on no rows

      console.log('[SupabaseSyncService] fetchFromSupabase result:', { data, error });

      if (error) {
        // 406 means schema cache issue - return null and let local data be used
        if (error.code === 'PGRST406' || error.message?.includes('406')) {
          console.warn('[SupabaseSyncService] 406 error - schema cache issue, using local data');
          return null;
        }
        if (error.code === 'PGRST116') {
          // No rows found
          return null;
        }
        throw error;
      }

      return data?.content || null;
    } catch (error) {
      console.error('Failed to fetch from Supabase:', error);
      return null;
    }
  }

  /**
   * Check if online
   */
  isOnline(): boolean {
    return navigator.onLine;
  }

  /**
   * Register connection change listener
   */
  onConnectionChange(callback: (online: boolean) => void): () => void {
    this.onlineListeners.add(callback);

    const handleOnline = () => callback(true);
    const handleOffline = () => callback(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Return cleanup function
    return () => {
      this.onlineListeners.delete(callback);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }

  /**
   * Delay utility for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clear sync queue
   */
  clearQueue(): void {
    this.syncQueue.clear();
  }

  /**
   * Get queue size
   */
  getQueueSize(): number {
    return this.syncQueue.size;
  }
}