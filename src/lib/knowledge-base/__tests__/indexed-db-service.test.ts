/**
 * Unit Tests for IndexedDB Service
 * Following TDD principles and comprehensive test coverage
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IndexedDBService, IndexedDBError } from '../indexed-db-service';
import type { KnowledgeEntry, KnowledgeBaseConfig } from '../interfaces';

// Mock IndexedDB for testing
import 'fake-indexeddb/auto';

describe('IndexedDBService', () => {
  let service: IndexedDBService;
  const config: KnowledgeBaseConfig = {
    dbName: 'test-db',
    dbVersion: 1
  };

  beforeEach(() => {
    service = new IndexedDBService(config);
  });

  afterEach(async () => {
    service.close();
    // Clean up database
    await indexedDB.deleteDatabase(config.dbName);
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await expect(service.initialize()).resolves.toBeUndefined();
      expect(service.isConnected()).toBe(true);
    });

    it('should handle initialization errors', async () => {
      // Mock indexedDB.open to fail
      const originalOpen = indexedDB.open;
      indexedDB.open = vi.fn().mockImplementation(() => {
        const request = new IDBOpenDBRequest();
        setTimeout(() => {
          const event = new Event('error');
          Object.defineProperty(request, 'error', {
            value: new Error('Failed to open'),
            writable: false
          });
          request.dispatchEvent(event);
        }, 0);
        return request;
      });

      await expect(service.initialize()).rejects.toThrow(IndexedDBError);

      // Restore original
      indexedDB.open = originalOpen;
    });

    it('should not reinitialize if already connected', async () => {
      await service.initialize();
      const firstDb = service['db'];

      await service.initialize();
      const secondDb = service['db'];

      expect(firstDb).toBe(secondDb);
    });
  });

  describe('put operation', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should store an entry successfully', async () => {
      const entry: KnowledgeEntry = {
        id: 'test-1',
        userId: 'user-1',
        fieldIdentifier: 'field-1',
        category: 'avatar',
        content: 'Test content',
        version: 1,
        isCurrentVersion: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        localChanges: true
      };

      await expect(service.put(entry)).resolves.toBeUndefined();
    });

    it('should update an existing entry', async () => {
      const entry: KnowledgeEntry = {
        id: 'test-1',
        userId: 'user-1',
        fieldIdentifier: 'field-1',
        category: 'avatar',
        content: 'Original content',
        version: 1,
        isCurrentVersion: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        localChanges: true
      };

      await service.put(entry);

      // Update the entry
      entry.content = 'Updated content';
      entry.version = 2;

      await expect(service.put(entry)).resolves.toBeUndefined();

      // Verify update
      const retrieved = await service.get('test-1');
      expect(retrieved?.content).toBe('Updated content');
      expect(retrieved?.version).toBe(2);
    });

    it('should throw error when database not initialized', async () => {
      service.close();
      const entry: KnowledgeEntry = {
        id: 'test-1',
        userId: 'user-1',
        fieldIdentifier: 'field-1',
        category: 'avatar',
        content: 'Test',
        version: 1,
        isCurrentVersion: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        localChanges: true
      };

      await expect(service.put(entry)).rejects.toThrow(IndexedDBError);
    });
  });

  describe('get operation', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should retrieve an entry by ID', async () => {
      const entry: KnowledgeEntry = {
        id: 'test-1',
        userId: 'user-1',
        fieldIdentifier: 'field-1',
        category: 'avatar',
        content: 'Test content',
        version: 1,
        isCurrentVersion: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        localChanges: true
      };

      await service.put(entry);

      const retrieved = await service.get('test-1');
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe('test-1');
      expect(retrieved?.content).toBe('Test content');
    });

    it('should return null for non-existent entry', async () => {
      const retrieved = await service.get('non-existent');
      expect(retrieved).toBeNull();
    });
  });

  describe('getByIndex operation', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should retrieve entries by userId index', async () => {
      const entries: KnowledgeEntry[] = [
        {
          id: 'test-1',
          userId: 'user-1',
          fieldIdentifier: 'field-1',
          category: 'avatar',
          content: 'Content 1',
          version: 1,
          isCurrentVersion: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          localChanges: true
        },
        {
          id: 'test-2',
          userId: 'user-1',
          fieldIdentifier: 'field-2',
          category: 'canvas',
          content: 'Content 2',
          version: 1,
          isCurrentVersion: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          localChanges: true
        },
        {
          id: 'test-3',
          userId: 'user-2',
          fieldIdentifier: 'field-1',
          category: 'avatar',
          content: 'Content 3',
          version: 1,
          isCurrentVersion: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          localChanges: true
        }
      ];

      for (const entry of entries) {
        await service.put(entry);
      }

      const user1Entries = await service.getByIndex('userId', 'user-1');
      expect(user1Entries).toHaveLength(2);
      expect(user1Entries[0].userId).toBe('user-1');
      expect(user1Entries[1].userId).toBe('user-1');
    });

    it('should retrieve entries by compound index', async () => {
      const entry: KnowledgeEntry = {
        id: 'test-1',
        userId: 'user-1',
        fieldIdentifier: 'field-1',
        category: 'avatar',
        content: 'Test',
        version: 1,
        isCurrentVersion: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        localChanges: true
      };

      await service.put(entry);

      const results = await service.getByIndex('userField', ['user-1', 'field-1']);
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('test-1');
    });
  });

  describe('getCurrentFieldEntry operation', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should return current version of a field', async () => {
      const entries: KnowledgeEntry[] = [
        {
          id: 'test-1',
          userId: 'user-1',
          fieldIdentifier: 'field-1',
          category: 'avatar',
          content: 'Version 1',
          version: 1,
          isCurrentVersion: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          localChanges: false
        },
        {
          id: 'test-2',
          userId: 'user-1',
          fieldIdentifier: 'field-1',
          category: 'avatar',
          content: 'Version 2',
          version: 2,
          isCurrentVersion: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          localChanges: true
        }
      ];

      for (const entry of entries) {
        await service.put(entry);
      }

      const current = await service.getCurrentFieldEntry('user-1', 'field-1');
      expect(current).toBeDefined();
      expect(current?.version).toBe(2);
      expect(current?.content).toBe('Version 2');
    });

    it('should return null if no current version exists', async () => {
      const current = await service.getCurrentFieldEntry('user-1', 'non-existent');
      expect(current).toBeNull();
    });
  });

  describe('delete operation', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should delete an entry', async () => {
      const entry: KnowledgeEntry = {
        id: 'test-1',
        userId: 'user-1',
        fieldIdentifier: 'field-1',
        category: 'avatar',
        content: 'Test',
        version: 1,
        isCurrentVersion: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        localChanges: true
      };

      await service.put(entry);
      await expect(service.delete('test-1')).resolves.toBeUndefined();

      const retrieved = await service.get('test-1');
      expect(retrieved).toBeNull();
    });

    it('should handle deleting non-existent entry', async () => {
      await expect(service.delete('non-existent')).resolves.toBeUndefined();
    });
  });

  describe('query operation', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should filter entries based on predicate', async () => {
      const entries: KnowledgeEntry[] = [
        {
          id: 'test-1',
          userId: 'user-1',
          fieldIdentifier: 'field-1',
          category: 'avatar',
          content: 'Content 1',
          version: 1,
          isCurrentVersion: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          localChanges: true
        },
        {
          id: 'test-2',
          userId: 'user-1',
          fieldIdentifier: 'field-2',
          category: 'canvas',
          content: 'Content 2',
          version: 1,
          isCurrentVersion: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          localChanges: false
        }
      ];

      for (const entry of entries) {
        await service.put(entry);
      }

      const unsyncedEntries = await service.query(
        entry => entry.localChanges === true
      );

      expect(unsyncedEntries).toHaveLength(1);
      expect(unsyncedEntries[0].id).toBe('test-1');
    });
  });

  describe('batchUpdate operation', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should update multiple entries in a batch', async () => {
      const entries: KnowledgeEntry[] = [
        {
          id: 'test-1',
          userId: 'user-1',
          fieldIdentifier: 'field-1',
          category: 'avatar',
          content: 'Content 1',
          version: 1,
          isCurrentVersion: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          localChanges: true
        },
        {
          id: 'test-2',
          userId: 'user-1',
          fieldIdentifier: 'field-2',
          category: 'canvas',
          content: 'Content 2',
          version: 1,
          isCurrentVersion: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          localChanges: true
        }
      ];

      await expect(service.batchUpdate(entries)).resolves.toBeUndefined();

      const entry1 = await service.get('test-1');
      const entry2 = await service.get('test-2');

      expect(entry1).toBeDefined();
      expect(entry2).toBeDefined();
    });
  });

  describe('clear operation', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should clear all entries from store', async () => {
      const entries: KnowledgeEntry[] = [
        {
          id: 'test-1',
          userId: 'user-1',
          fieldIdentifier: 'field-1',
          category: 'avatar',
          content: 'Content 1',
          version: 1,
          isCurrentVersion: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          localChanges: true
        },
        {
          id: 'test-2',
          userId: 'user-1',
          fieldIdentifier: 'field-2',
          category: 'canvas',
          content: 'Content 2',
          version: 1,
          isCurrentVersion: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          localChanges: true
        }
      ];

      for (const entry of entries) {
        await service.put(entry);
      }

      await expect(service.clear()).resolves.toBeUndefined();

      const all = await service.query(() => true);
      expect(all).toHaveLength(0);
    });
  });

  describe('connection management', () => {
    it('should report connection status', async () => {
      expect(service.isConnected()).toBe(false);

      await service.initialize();
      expect(service.isConnected()).toBe(true);

      service.close();
      expect(service.isConnected()).toBe(false);
    });
  });
});