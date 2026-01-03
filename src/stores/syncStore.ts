import { create } from 'zustand';
import type { ConnectionState, SyncState, QueuedOperation, OptimisticStatus } from '@/types/optimistic';

interface OptimisticItem {
  id: string;
  tempId: string;
  status: OptimisticStatus;
  retryCount: number;
  error?: string;
  timestamp: number;
}

interface SyncStoreState {
  // Connection state
  connection: ConnectionState;
  
  // Sync state
  sync: SyncState;
  
  // Optimistic items tracking
  optimisticItems: Map<string, OptimisticItem>;
  
  // Queued operations for offline/retry
  operationQueue: QueuedOperation[];
  
  // Actions
  setConnectionStatus: (status: ConnectionState['status']) => void;
  updateLatency: (latency: number) => void;
  incrementReconnectAttempts: () => void;
  resetReconnectAttempts: () => void;
  
  // Optimistic tracking
  addOptimisticItem: (tempId: string, id?: string) => void;
  confirmOptimisticItem: (tempId: string, realId: string) => void;
  failOptimisticItem: (tempId: string, error: string) => void;
  removeOptimisticItem: (tempId: string) => void;
  getOptimisticStatus: (tempId: string) => OptimisticStatus | null;
  
  // Operation queue
  enqueueOperation: (operation: Omit<QueuedOperation, 'id' | 'timestamp' | 'retries'>) => string;
  dequeueOperation: (id: string) => void;
  retryOperation: (id: string) => boolean;
  clearFailedOperations: () => void;
  
  // Sync actions
  setSyncStatus: (status: SyncState['syncStatus']) => void;
  updateLastSync: () => void;
}

export const useSyncStore = create<SyncStoreState>((set, get) => ({
  connection: {
    status: 'connected',
    lastConnectedAt: new Date().toISOString(),
    reconnectAttempts: 0,
    latency: null,
  },
  
  sync: {
    isConnected: true,
    lastSyncAt: null,
    pendingOperations: 0,
    syncStatus: 'idle',
  },
  
  optimisticItems: new Map(),
  operationQueue: [],
  
  // Connection management
  setConnectionStatus: (status) => {
    set((state) => ({
      connection: {
        ...state.connection,
        status,
        lastConnectedAt: status === 'connected' ? new Date().toISOString() : state.connection.lastConnectedAt,
      },
      sync: {
        ...state.sync,
        isConnected: status === 'connected',
      },
    }));
  },
  
  updateLatency: (latency) => {
    set((state) => ({
      connection: { ...state.connection, latency },
    }));
  },
  
  incrementReconnectAttempts: () => {
    set((state) => ({
      connection: {
        ...state.connection,
        reconnectAttempts: state.connection.reconnectAttempts + 1,
      },
    }));
  },
  
  resetReconnectAttempts: () => {
    set((state) => ({
      connection: { ...state.connection, reconnectAttempts: 0 },
    }));
  },
  
  // Optimistic item tracking
  addOptimisticItem: (tempId, id) => {
    const items = new Map(get().optimisticItems);
    items.set(tempId, {
      id: id || tempId,
      tempId,
      status: 'pending',
      retryCount: 0,
      timestamp: Date.now(),
    });
    set({ 
      optimisticItems: items,
      sync: { ...get().sync, pendingOperations: items.size },
    });
  },
  
  confirmOptimisticItem: (tempId, realId) => {
    const items = new Map(get().optimisticItems);
    const item = items.get(tempId);
    if (item) {
      items.set(tempId, { ...item, id: realId, status: 'confirmed' });
      // Remove after a short delay to allow UI updates
      setTimeout(() => {
        const currentItems = new Map(get().optimisticItems);
        currentItems.delete(tempId);
        set({ 
          optimisticItems: currentItems,
          sync: { ...get().sync, pendingOperations: currentItems.size },
        });
      }, 1000);
    }
    set({ optimisticItems: items });
  },
  
  failOptimisticItem: (tempId, error) => {
    const items = new Map(get().optimisticItems);
    const item = items.get(tempId);
    if (item) {
      items.set(tempId, { 
        ...item, 
        status: 'failed', 
        error,
        retryCount: item.retryCount + 1,
      });
    }
    set({ optimisticItems: items });
  },
  
  removeOptimisticItem: (tempId) => {
    const items = new Map(get().optimisticItems);
    items.delete(tempId);
    set({ 
      optimisticItems: items,
      sync: { ...get().sync, pendingOperations: items.size },
    });
  },
  
  getOptimisticStatus: (tempId) => {
    return get().optimisticItems.get(tempId)?.status || null;
  },
  
  // Operation queue management
  enqueueOperation: (operation) => {
    const id = `op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const fullOperation: QueuedOperation = {
      ...operation,
      id,
      timestamp: new Date().toISOString(),
      retries: 0,
    };
    
    set((state) => ({
      operationQueue: [...state.operationQueue, fullOperation],
      sync: { ...state.sync, pendingOperations: state.operationQueue.length + 1 },
    }));
    
    return id;
  },
  
  dequeueOperation: (id) => {
    set((state) => ({
      operationQueue: state.operationQueue.filter((op) => op.id !== id),
      sync: { 
        ...state.sync, 
        pendingOperations: Math.max(0, state.operationQueue.length - 1),
      },
    }));
  },
  
  retryOperation: (id) => {
    const queue = get().operationQueue;
    const opIndex = queue.findIndex((op) => op.id === id);
    
    if (opIndex === -1) return false;
    
    const op = queue[opIndex];
    if (op.retries >= op.maxRetries) return false;
    
    const updatedQueue = [...queue];
    updatedQueue[opIndex] = { ...op, retries: op.retries + 1 };
    set({ operationQueue: updatedQueue });
    
    return true;
  },
  
  clearFailedOperations: () => {
    set((state) => ({
      operationQueue: state.operationQueue.filter((op) => op.retries < op.maxRetries),
    }));
  },
  
  // Sync status
  setSyncStatus: (syncStatus) => {
    set((state) => ({
      sync: { ...state.sync, syncStatus },
    }));
  },
  
  updateLastSync: () => {
    set((state) => ({
      sync: { ...state.sync, lastSyncAt: new Date().toISOString() },
    }));
  },
}));
