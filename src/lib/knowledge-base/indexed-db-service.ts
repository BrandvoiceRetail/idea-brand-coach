/**
 * IndexedDB Service Implementation
 * Handles low-level database operations with proper error handling
 */

import type { KnowledgeEntry, KnowledgeBaseConfig } from './interfaces';

/**
 * Error types for better error handling
 */
export class IndexedDBError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'IndexedDBError';
  }
}

/**
 * IndexedDB service class - handles database operations
 * Single Responsibility: Managing IndexedDB connection and operations
 */
export class IndexedDBService {
  private db: IDBDatabase | null = null;
  private readonly dbName: string;
  private readonly dbVersion: number;
  private readonly storeName = 'knowledge_entries';

  constructor(config: KnowledgeBaseConfig) {
    this.dbName = config.dbName;
    this.dbVersion = config.dbVersion;
  }

  /**
   * Initialize the database connection
   */
  async initialize(): Promise<void> {
    try {
      this.db = await this.openDatabase();
    } catch (error) {
      throw new IndexedDBError(
        `Failed to initialize database: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'DB_INIT_ERROR'
      );
    }
  }

  /**
   * Open IndexedDB connection with proper schema setup
   */
  private openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        reject(new IndexedDBError('Failed to open database', 'DB_OPEN_ERROR'));
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, {
            keyPath: 'id',
            autoIncrement: false
          });

          // Create indexes for efficient queries
          store.createIndex('userId', 'userId', { unique: false });
          store.createIndex('fieldIdentifier', 'fieldIdentifier', { unique: false });
          store.createIndex('userField', ['userId', 'fieldIdentifier'], { unique: false });
          store.createIndex('category', 'category', { unique: false });
          store.createIndex('userCategory', ['userId', 'category'], { unique: false });
          store.createIndex('isCurrentVersion', 'isCurrentVersion', { unique: false });
          store.createIndex('localChanges', 'localChanges', { unique: false });
          store.createIndex('lastSyncedAt', 'lastSyncedAt', { unique: false });
        }
      };
    });
  }

  /**
   * Ensure database is connected
   */
  private ensureConnection(): void {
    if (!this.db) {
      throw new IndexedDBError('Database not initialized', 'DB_NOT_INITIALIZED');
    }
  }

  /**
   * Get a transaction for the store
   */
  private getTransaction(mode: IDBTransactionMode = 'readonly'): IDBTransaction {
    this.ensureConnection();
    return this.db!.transaction([this.storeName], mode);
  }

  /**
   * Get the object store from a transaction
   */
  private getStore(transaction: IDBTransaction): IDBObjectStore {
    return transaction.objectStore(this.storeName);
  }

  /**
   * Add or update an entry in the database
   */
  async put(entry: KnowledgeEntry): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const transaction = this.getTransaction('readwrite');
        const store = this.getStore(transaction);
        const request = store.put(entry);

        request.onsuccess = () => resolve();
        request.onerror = () => {
          reject(new IndexedDBError(
            `Failed to save entry: ${request.error?.message}`,
            'DB_WRITE_ERROR'
          ));
        };

        transaction.onerror = () => {
          reject(new IndexedDBError(
            'Transaction failed',
            'DB_TRANSACTION_ERROR'
          ));
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Get a single entry by ID
   */
  async get(id: string): Promise<KnowledgeEntry | null> {
    return new Promise((resolve, reject) => {
      try {
        const transaction = this.getTransaction();
        const store = this.getStore(transaction);
        const request = store.get(id);

        request.onsuccess = () => {
          resolve(request.result || null);
        };

        request.onerror = () => {
          reject(new IndexedDBError(
            `Failed to get entry: ${request.error?.message}`,
            'DB_READ_ERROR'
          ));
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Get entries by index
   */
  async getByIndex<T extends keyof KnowledgeEntry>(
    indexName: string,
    value: IDBValidKey | IDBKeyRange
  ): Promise<KnowledgeEntry[]> {
    return new Promise((resolve, reject) => {
      try {
        const transaction = this.getTransaction();
        const store = this.getStore(transaction);
        const index = store.index(indexName);
        const request = index.getAll(value);

        request.onsuccess = () => {
          resolve(request.result || []);
        };

        request.onerror = () => {
          reject(new IndexedDBError(
            `Failed to query by index ${indexName}: ${request.error?.message}`,
            'DB_QUERY_ERROR'
          ));
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Get current version of a field for a user
   */
  async getCurrentFieldEntry(
    userId: string,
    fieldIdentifier: string
  ): Promise<KnowledgeEntry | null> {
    try {
      // Get all entries for this user/field combination
      const entries = await this.getByIndex('userField', [userId, fieldIdentifier]);

      // Find the current version
      const currentEntry = entries.find(entry => entry.isCurrentVersion);
      return currentEntry || null;
    } catch (error) {
      throw new IndexedDBError(
        `Failed to get current field entry: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'DB_QUERY_ERROR'
      );
    }
  }

  /**
   * Delete an entry by ID
   */
  async delete(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const transaction = this.getTransaction('readwrite');
        const store = this.getStore(transaction);
        const request = store.delete(id);

        request.onsuccess = () => resolve();
        request.onerror = () => {
          reject(new IndexedDBError(
            `Failed to delete entry: ${request.error?.message}`,
            'DB_DELETE_ERROR'
          ));
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Get all entries matching a filter
   */
  async query(
    filter: (entry: KnowledgeEntry) => boolean
  ): Promise<KnowledgeEntry[]> {
    return new Promise((resolve, reject) => {
      try {
        const transaction = this.getTransaction();
        const store = this.getStore(transaction);
        const request = store.getAll();

        request.onsuccess = () => {
          const results = request.result || [];
          resolve(results.filter(filter));
        };

        request.onerror = () => {
          reject(new IndexedDBError(
            `Failed to query entries: ${request.error?.message}`,
            'DB_QUERY_ERROR'
          ));
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Batch update multiple entries
   */
  async batchUpdate(entries: KnowledgeEntry[]): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const transaction = this.getTransaction('readwrite');
        const store = this.getStore(transaction);

        // Add all entries to the transaction
        for (const entry of entries) {
          store.put(entry);
        }

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => {
          reject(new IndexedDBError(
            'Batch update failed',
            'DB_BATCH_ERROR'
          ));
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Clear all data from the store
   */
  async clear(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const transaction = this.getTransaction('readwrite');
        const store = this.getStore(transaction);
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = () => {
          reject(new IndexedDBError(
            'Failed to clear store',
            'DB_CLEAR_ERROR'
          ));
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  /**
   * Check if database is connected
   */
  isConnected(): boolean {
    return this.db !== null;
  }
}