/**
 * Knowledge Repository Implementation
 * Implements the IKnowledgeRepository interface using IndexedDB
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  IKnowledgeRepository,
  KnowledgeEntry,
  KnowledgeCategory,
  ConflictInfo,
  KnowledgeBaseConfig
} from './interfaces';
import { IndexedDBService, IndexedDBError } from './indexed-db-service';

/**
 * Repository implementation for managing user knowledge entries
 * Uses IndexedDB for local storage with fast access
 */
export class KnowledgeRepository implements IKnowledgeRepository {
  private dbService: IndexedDBService;
  private isInitialized = false;

  constructor(config: KnowledgeBaseConfig) {
    this.dbService = new IndexedDBService(config);
  }

  /**
   * Initialize the repository
   */
  async initialize(): Promise<void> {
    if (!this.isInitialized) {
      await this.dbService.initialize();
      this.isInitialized = true;
    }
  }

  /**
   * Ensure repository is initialized before operations
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  /**
   * Get field content by identifier
   */
  async getField(userId: string, fieldIdentifier: string): Promise<string | null> {
    await this.ensureInitialized();

    try {
      const entry = await this.dbService.getCurrentFieldEntry(userId, fieldIdentifier);
      return entry?.content || null;
    } catch (error) {
      console.error('Failed to get field:', error);
      return null;
    }
  }

  /**
   * Get complete field entry with metadata
   */
  async getFieldEntry(userId: string, fieldIdentifier: string): Promise<KnowledgeEntry | null> {
    await this.ensureInitialized();

    try {
      return await this.dbService.getCurrentFieldEntry(userId, fieldIdentifier);
    } catch (error) {
      console.error('Failed to get field entry:', error);
      return null;
    }
  }

  /**
   * Get all entries for a category
   */
  async getCategoryData(userId: string, category: KnowledgeCategory): Promise<KnowledgeEntry[]> {
    await this.ensureInitialized();

    try {
      const entries = await this.dbService.getByIndex('userCategory', [userId, category]);
      // Return only current versions
      return entries.filter(entry => entry.isCurrentVersion);
    } catch (error) {
      console.error('Failed to get category data:', error);
      return [];
    }
  }

  /**
   * Get all user data
   */
  async getAllUserData(userId: string): Promise<KnowledgeEntry[]> {
    await this.ensureInitialized();

    try {
      const entries = await this.dbService.getByIndex('userId', userId);
      // Return only current versions
      return entries.filter(entry => entry.isCurrentVersion);
    } catch (error) {
      console.error('Failed to get all user data:', error);
      return [];
    }
  }

  /**
   * Save a field with content
   */
  async saveField(
    userId: string,
    fieldIdentifier: string,
    content: string,
    category: KnowledgeCategory
  ): Promise<void> {
    await this.ensureInitialized();

    try {
      // Check if field exists
      const existingEntry = await this.dbService.getCurrentFieldEntry(userId, fieldIdentifier);

      if (existingEntry) {
        // Mark existing as old version
        existingEntry.isCurrentVersion = false;
        await this.dbService.put(existingEntry);

        // Create new version
        const newEntry: KnowledgeEntry = {
          ...existingEntry,
          id: uuidv4(),
          content,
          version: existingEntry.version + 1,
          isCurrentVersion: true,
          updatedAt: new Date(),
          localChanges: true,
          lastSyncedAt: undefined
        };

        await this.dbService.put(newEntry);
      } else {
        // Create new entry
        const newEntry: KnowledgeEntry = {
          id: uuidv4(),
          userId,
          fieldIdentifier,
          category,
          content,
          version: 1,
          isCurrentVersion: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          localChanges: true
        };

        await this.dbService.put(newEntry);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to save field: ${message}`);
    }
  }

  /**
   * Save field with complete metadata
   */
  async saveFieldWithMetadata(
    entry: Omit<KnowledgeEntry, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<void> {
    await this.ensureInitialized();

    try {
      const existingEntry = await this.dbService.getCurrentFieldEntry(
        entry.userId,
        entry.fieldIdentifier
      );

      if (existingEntry) {
        // Mark existing as old version
        existingEntry.isCurrentVersion = false;
        await this.dbService.put(existingEntry);
      }

      // Create new entry with full metadata
      const newEntry: KnowledgeEntry = {
        ...entry,
        id: uuidv4(),
        createdAt: existingEntry?.createdAt || new Date(),
        updatedAt: new Date(),
        localChanges: true
      };

      await this.dbService.put(newEntry);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to save field with metadata: ${message}`);
    }
  }

  /**
   * Get field history (all versions)
   */
  async getFieldHistory(userId: string, fieldIdentifier: string): Promise<KnowledgeEntry[]> {
    await this.ensureInitialized();

    try {
      const entries = await this.dbService.getByIndex('userField', [userId, fieldIdentifier]);
      // Sort by version descending
      return entries.sort((a, b) => b.version - a.version);
    } catch (error) {
      console.error('Failed to get field history:', error);
      return [];
    }
  }

  /**
   * Mark a specific version as current
   */
  async markAsCurrentVersion(entryId: string): Promise<void> {
    await this.ensureInitialized();

    try {
      const entry = await this.dbService.get(entryId);
      if (!entry) {
        throw new Error('Entry not found');
      }

      // Mark all other versions as non-current
      const allVersions = await this.dbService.getByIndex(
        'userField',
        [entry.userId, entry.fieldIdentifier]
      );

      const updates = allVersions.map(version => ({
        ...version,
        isCurrentVersion: version.id === entryId
      }));

      await this.dbService.batchUpdate(updates);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to mark as current version: ${message}`);
    }
  }

  /**
   * Get entries that need syncing
   */
  async getUnsyncedEntries(userId: string): Promise<KnowledgeEntry[]> {
    await this.ensureInitialized();

    try {
      const entries = await this.dbService.query(
        entry => entry.userId === userId && entry.localChanges === true
      );
      return entries;
    } catch (error) {
      console.error('Failed to get unsynced entries:', error);
      return [];
    }
  }

  /**
   * Mark entry as synced
   */
  async markAsSynced(entryId: string, syncedAt: Date): Promise<void> {
    await this.ensureInitialized();

    try {
      const entry = await this.dbService.get(entryId);
      if (entry) {
        entry.localChanges = false;
        entry.lastSyncedAt = syncedAt;
        await this.dbService.put(entry);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to mark as synced: ${message}`);
    }
  }

  /**
   * Resolve conflict between local and remote versions
   */
  async resolveConflict(conflict: ConflictInfo, resolution: string): Promise<void> {
    await this.ensureInitialized();

    try {
      const { fieldIdentifier, localVersion } = conflict;

      // Save the resolution as the new current version
      await this.saveField(
        localVersion.userId,
        fieldIdentifier,
        resolution,
        localVersion.category
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to resolve conflict: ${message}`);
    }
  }

  /**
   * Clear all data for a user
   */
  async clearUserData(userId: string): Promise<void> {
    await this.ensureInitialized();

    try {
      const entries = await this.dbService.getByIndex('userId', userId);
      for (const entry of entries) {
        await this.dbService.delete(entry.id);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to clear user data: ${message}`);
    }
  }

  /**
   * Close the repository connection
   */
  close(): void {
    this.dbService.close();
    this.isInitialized = false;
  }
}