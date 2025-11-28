/**
 * Knowledge Base Interfaces
 * Following SOLID principles and clean architecture patterns
 */

/**
 * Represents a single knowledge entry for a user field
 */
export interface KnowledgeEntry {
  id: string;
  userId: string;
  fieldIdentifier: string;
  category: KnowledgeCategory;
  subcategory?: string;
  content: string;
  structuredData?: Record<string, unknown>;
  metadata?: KnowledgeMetadata;
  version: number;
  isCurrentVersion: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastSyncedAt?: Date;
  localChanges?: boolean;
}

/**
 * Metadata for knowledge entries
 */
export interface KnowledgeMetadata {
  sessionId?: string;
  deviceId?: string;
  generationModel?: string;
  parentEntryId?: string;
  confidence?: number;
  source?: string;
}

/**
 * Categories of knowledge in the system
 */
export type KnowledgeCategory =
  | 'diagnostic'
  | 'avatar'
  | 'insights'
  | 'canvas'
  | 'copy';

/**
 * Sync status for field data
 */
export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'error';

/**
 * Conflict information when multiple versions exist
 */
export interface ConflictInfo {
  fieldIdentifier: string;
  localVersion: KnowledgeEntry;
  remoteVersion: KnowledgeEntry;
  suggestedResolution?: string;
}

/**
 * Repository interface for knowledge base operations
 * Single Responsibility: Managing knowledge entries
 */
export interface IKnowledgeRepository {
  // Read operations
  getField(userId: string, fieldIdentifier: string): Promise<string | null>;
  getFieldEntry(userId: string, fieldIdentifier: string): Promise<KnowledgeEntry | null>;
  getCategoryData(userId: string, category: KnowledgeCategory): Promise<KnowledgeEntry[]>;
  getAllUserData(userId: string): Promise<KnowledgeEntry[]>;

  // Write operations
  saveField(userId: string, fieldIdentifier: string, content: string, category: KnowledgeCategory): Promise<void>;
  saveFieldWithMetadata(entry: Omit<KnowledgeEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<void>;

  // Version management
  getFieldHistory(userId: string, fieldIdentifier: string): Promise<KnowledgeEntry[]>;
  markAsCurrentVersion(entryId: string): Promise<void>;

  // Sync operations
  getUnsyncedEntries(userId: string): Promise<KnowledgeEntry[]>;
  markAsSynced(entryId: string, syncedAt: Date): Promise<void>;

  // Conflict resolution
  resolveConflict(conflict: ConflictInfo, resolution: string): Promise<void>;
}

/**
 * Service interface for synchronization operations
 * Single Responsibility: Managing sync between local and remote
 */
export interface ISyncService {
  // Sync operations
  syncField(userId: string, fieldIdentifier: string, content: string): Promise<SyncStatus>;
  syncAllFields(userId: string): Promise<void>;
  forceSyncAll(userId: string): Promise<void>;

  // Conflict detection
  checkForConflicts(userId: string): Promise<ConflictInfo[]>;

  // Connection management
  isOnline(): boolean;
  onConnectionChange(callback: (online: boolean) => void): () => void;
}

/**
 * Service interface for embedding generation
 * Single Responsibility: Converting text to vector embeddings
 */
export interface IEmbeddingService {
  generateEmbedding(text: string): Promise<number[]>;
  generateBatchEmbeddings(texts: string[]): Promise<number[][]>;
}

/**
 * Configuration for the knowledge base
 */
export interface KnowledgeBaseConfig {
  dbName: string;
  dbVersion: number;
  syncInterval?: number; // milliseconds
  maxRetries?: number;
  conflictResolution?: 'local-first' | 'remote-first' | 'manual';
}

/**
 * Result type for operations that may fail
 */
export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

/**
 * Observer pattern for field changes
 */
export interface IFieldObserver {
  onFieldChange(fieldIdentifier: string, newValue: string, syncStatus: SyncStatus): void;
}

/**
 * Factory interface for creating repository instances
 * Following the Factory pattern for flexibility
 */
export interface IRepositoryFactory {
  createKnowledgeRepository(config: KnowledgeBaseConfig): IKnowledgeRepository;
  createSyncService(repository: IKnowledgeRepository, remoteUrl?: string): ISyncService;
}