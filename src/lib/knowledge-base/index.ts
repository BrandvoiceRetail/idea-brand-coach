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
export { KnowledgeRepository } from './knowledge-repository';
export { IndexedDBService, IndexedDBError } from './indexed-db-service';
export { SupabaseSyncService } from './supabase-sync-service';

// Factory for creating instances
export class KnowledgeBaseFactory {
  static createRepository(config?: Partial<KnowledgeBaseConfig>): KnowledgeRepository {
    const defaultConfig: KnowledgeBaseConfig = {
      dbName: 'idea-brand-coach',
      dbVersion: 1,
      syncInterval: 30000,
      maxRetries: 3,
      conflictResolution: 'local-first'
    };

    return new KnowledgeRepository({
      ...defaultConfig,
      ...config
    });
  }

  static createSyncService(repository: KnowledgeRepository): SupabaseSyncService {
    return new SupabaseSyncService(repository);
  }
}