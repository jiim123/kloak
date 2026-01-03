/**
 * Types for optimistic updates and sync systems
 */

export type OptimisticStatus = 'pending' | 'confirmed' | 'failed';

export interface OptimisticMessage {
  id: string;
  tempId: string; // Client-generated ID for tracking
  status: OptimisticStatus;
  retryCount: number;
  error?: string;
}

export interface SyncState {
  isConnected: boolean;
  lastSyncAt: string | null;
  pendingOperations: number;
  syncStatus: 'idle' | 'syncing' | 'error';
}

export interface QueuedOperation {
  id: string;
  type: 'message' | 'reaction' | 'edit' | 'delete';
  payload: unknown;
  timestamp: string;
  retries: number;
  maxRetries: number;
}

export interface ConnectionState {
  status: 'connected' | 'connecting' | 'disconnected' | 'reconnecting';
  lastConnectedAt: string | null;
  reconnectAttempts: number;
  latency: number | null;
}
