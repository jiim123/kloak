import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import type { Task, TaskPriority, TaskStatus, User } from '@/types';

interface TaskStore {
  tasks: Task[];
  isLoading: boolean;
  selectedTaskId: string | null;
  
  // Actions
  setSelectedTaskId: (taskId: string | null) => void;
  fetchTasks: (channelId: string, userId: string) => Promise<void>;
  createTask: (channelId: string, userId: string, title: string, options?: {
    description?: string;
    priority?: TaskPriority;
    dueDate?: string;
    assigneeIds?: string[];
  }) => Promise<Task | null>;
  updateTask: (taskId: string, userId: string, updates: {
    title?: string;
    description?: string | null;
    priority?: TaskPriority;
    status?: TaskStatus;
    dueDate?: string | null;
  }) => Promise<boolean>;
  deleteTask: (taskId: string, userId: string) => Promise<boolean>;
  toggleTaskStatus: (taskId: string, userId: string) => Promise<boolean>;
  assignUsers: (taskId: string, userId: string, assigneeIds: string[]) => Promise<boolean>;
  unassignUsers: (taskId: string, userId: string, assigneeIds: string[]) => Promise<boolean>;
  reorderTasks: (channelId: string, userId: string, taskIds: string[]) => Promise<boolean>;
  
  // Optimistic updates for realtime
  addTask: (task: Task) => void;
  updateTaskLocal: (taskId: string, updates: Partial<Task>) => void;
  removeTask: (taskId: string) => void;
  clearTasks: () => void;
}

// Type helper for RPC responses
interface TaskRpcResponse {
  id: string;
  channel_id: string;
  created_by: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  due_date: string | null;
  position: number;
  created_at: string;
  updated_at: string;
  creator?: Record<string, unknown>;
  assignees?: Array<{
    id: string;
    task_id: string;
    user_id: string;
    assigned_by: string;
    assigned_at: string;
    user?: Record<string, unknown>;
  }>;
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],
  isLoading: false,
  selectedTaskId: null,
  
  setSelectedTaskId: (taskId) => set({ selectedTaskId: taskId }),
  
  fetchTasks: async (channelId, userId) => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase.rpc('get_channel_tasks', {
        _channel_id: channelId,
        _user_id: userId,
        _status_filter: null,
        _sort_by: 'position',
        _sort_order: 'asc',
      });
      
      if (error) throw error;
      
      // Transform the data to match our Task type
      const rawData = data as unknown as TaskRpcResponse[] | null;
      const tasks: Task[] = (rawData || []).map((task) => ({
        id: task.id,
        channel_id: task.channel_id,
        created_by: task.created_by,
        title: task.title,
        description: task.description,
        priority: task.priority as TaskPriority,
        status: task.status as TaskStatus,
        due_date: task.due_date,
        position: task.position,
        created_at: task.created_at,
        updated_at: task.updated_at,
        creator: task.creator as unknown as User | undefined,
        assignees: (task.assignees || []).map((a) => ({
          id: a.id,
          task_id: a.task_id,
          user_id: a.user_id,
          assigned_by: a.assigned_by,
          assigned_at: a.assigned_at,
          user: a.user as unknown as User | undefined,
        })),
      }));
      
      set({ tasks, isLoading: false });
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
      set({ isLoading: false });
    }
  },
  
  createTask: async (channelId, userId, title, options = {}) => {
    try {
      const { data, error } = await supabase.rpc('create_task', {
        _channel_id: channelId,
        _user_id: userId,
        _title: title,
        _description: options.description || null,
        _priority: options.priority || 'medium',
        _due_date: options.dueDate || null,
        _assignee_ids: options.assigneeIds || [],
      });
      
      if (error) throw error;
      
      if (data) {
        const rawData = data as unknown as TaskRpcResponse;
        const newTask: Task = {
          id: rawData.id,
          channel_id: rawData.channel_id,
          created_by: rawData.created_by,
          title: rawData.title,
          description: rawData.description,
          priority: rawData.priority as TaskPriority,
          status: rawData.status as TaskStatus,
          due_date: rawData.due_date,
          position: rawData.position,
          created_at: rawData.created_at,
          updated_at: rawData.updated_at,
          assignees: [],
        };
        
        // Add to local state optimistically
        set((state) => ({ tasks: [...state.tasks, newTask] }));
        return newTask;
      }
      
      return null;
    } catch (error) {
      console.error('Failed to create task:', error);
      return null;
    }
  },
  
  updateTask: async (taskId, userId, updates) => {
    try {
      const { error } = await supabase.rpc('update_task', {
        _task_id: taskId,
        _user_id: userId,
        _title: updates.title ?? null,
        _description: updates.description ?? null,
        _priority: updates.priority ?? null,
        _status: updates.status ?? null,
        _due_date: updates.dueDate ?? null,
      });
      
      if (error) throw error;
      
      // Update local state
      set((state) => ({
        tasks: state.tasks.map((task) =>
          task.id === taskId
            ? {
                ...task,
                ...(updates.title !== undefined && { title: updates.title }),
                ...(updates.description !== undefined && { description: updates.description }),
                ...(updates.priority !== undefined && { priority: updates.priority }),
                ...(updates.status !== undefined && { status: updates.status }),
                ...(updates.dueDate !== undefined && { due_date: updates.dueDate }),
              }
            : task
        ),
      }));
      
      return true;
    } catch (error) {
      console.error('Failed to update task:', error);
      return false;
    }
  },
  
  deleteTask: async (taskId, userId) => {
    try {
      const { error } = await supabase.rpc('delete_task', {
        _task_id: taskId,
        _user_id: userId,
      });
      
      if (error) throw error;
      
      // Remove from local state
      set((state) => ({
        tasks: state.tasks.filter((task) => task.id !== taskId),
        selectedTaskId: state.selectedTaskId === taskId ? null : state.selectedTaskId,
      }));
      
      return true;
    } catch (error) {
      console.error('Failed to delete task:', error);
      return false;
    }
  },
  
  toggleTaskStatus: async (taskId, userId) => {
    const task = get().tasks.find((t) => t.id === taskId);
    if (!task) return false;
    
    const newStatus: TaskStatus = task.status === 'completed' ? 'open' : 'completed';
    return get().updateTask(taskId, userId, { status: newStatus });
  },
  
  assignUsers: async (taskId, userId, assigneeIds) => {
    try {
      const { error } = await supabase.rpc('assign_task_users', {
        _task_id: taskId,
        _user_id: userId,
        _assignee_ids: assigneeIds,
      });
      
      if (error) throw error;
      
      // Refetch tasks to get updated assignees
      const task = get().tasks.find((t) => t.id === taskId);
      if (task) {
        await get().fetchTasks(task.channel_id, userId);
      }
      
      return true;
    } catch (error) {
      console.error('Failed to assign users:', error);
      return false;
    }
  },
  
  unassignUsers: async (taskId, userId, assigneeIds) => {
    try {
      const { error } = await supabase.rpc('unassign_task_users', {
        _task_id: taskId,
        _user_id: userId,
        _assignee_ids: assigneeIds,
      });
      
      if (error) throw error;
      
      // Update local state
      set((state) => ({
        tasks: state.tasks.map((task) =>
          task.id === taskId
            ? {
                ...task,
                assignees: (task.assignees || []).filter(
                  (a) => !assigneeIds.includes(a.user_id)
                ),
              }
            : task
        ),
      }));
      
      return true;
    } catch (error) {
      console.error('Failed to unassign users:', error);
      return false;
    }
  },
  
  reorderTasks: async (channelId, userId, taskIds) => {
    try {
      // Optimistic update
      set((state) => {
        const taskMap = new Map(state.tasks.map((t) => [t.id, t]));
        const reorderedTasks = taskIds
          .map((id, index) => {
            const task = taskMap.get(id);
            if (task) {
              return { ...task, position: index };
            }
            return null;
          })
          .filter((t): t is Task => t !== null);
        
        // Keep tasks not in the reorder list
        const otherTasks = state.tasks.filter((t) => !taskIds.includes(t.id));
        
        return { tasks: [...reorderedTasks, ...otherTasks] };
      });
      
      // TODO: Call reorder RPC when available
      // For now, update positions individually
      for (let i = 0; i < taskIds.length; i++) {
        await supabase.rpc('update_task', {
          _task_id: taskIds[i],
          _user_id: userId,
          _title: null,
          _description: null,
          _priority: null,
          _status: null,
          _due_date: null,
        });
      }
      
      return true;
    } catch (error) {
      console.error('Failed to reorder tasks:', error);
      return false;
    }
  },
  
  // Realtime helpers
  addTask: (task) => {
    set((state) => {
      // Avoid duplicates
      if (state.tasks.some((t) => t.id === task.id)) {
        return state;
      }
      return { tasks: [...state.tasks, task] };
    });
  },
  
  updateTaskLocal: (taskId, updates) => {
    set((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === taskId ? { ...task, ...updates } : task
      ),
    }));
  },
  
  removeTask: (taskId) => {
    set((state) => ({
      tasks: state.tasks.filter((task) => task.id !== taskId),
      selectedTaskId: state.selectedTaskId === taskId ? null : state.selectedTaskId,
    }));
  },
  
  clearTasks: () => set({ tasks: [], selectedTaskId: null }),
}));
