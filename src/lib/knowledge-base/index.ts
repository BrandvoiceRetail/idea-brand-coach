/**
 * Knowledge Base Library
 * Export all public interfaces and implementations
 */

// Interfaces
export type {
  KnowledgeEntry,
  KnowledgeMetadata,
  KnowledgeCategory,
  SyncStatus,
  ConflictInfo,
  IKnowledgeRepository,
  ISyncService,
  IEmbeddingService,
  KnowledgeBaseConfig,
  Result,
  IFieldObserver,
  IRepositoryFactory
} from './interfaces';

// Implementations
import { KnowledgeRepository } from './knowledge-repository';
import { IndexedDBService, IndexedDBError } from './indexed-db-service';
import { SupabaseSyncService } from './supabase-sync-service';

export { KnowledgeRepository, IndexedDBService, IndexedDBError, SupabaseSyncService };

// Factory for creating instances
export class KnowledgeBaseFactory {
  static async createRepository(config?: Partial<{
    dbName: string;
    dbVersion: number;
    syncInterval?: number;
    maxRetries?: number;
    conflictResolution?: 'local-first' | 'remote-first' | 'manual';
  }>): Promise<KnowledgeRepository> {
    const defaultConfig = {
      dbName: 'idea-brand-coach',
      dbVersion: 1,
      syncInterval: 30000,
      maxRetries: 3,
      conflictResolution: 'local-first' as const
    };

    const repository = new KnowledgeRepository({
      ...defaultConfig,
      ...config
    });

    await repository.initialize();
    return repository;
  }

  static createSyncService(repository: KnowledgeRepository): SupabaseSyncService {
    return new SupabaseSyncService(repository);
  }
}