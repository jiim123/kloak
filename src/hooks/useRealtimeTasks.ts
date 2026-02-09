import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTaskStore } from '@/stores/taskStore';
import { useAuthStore } from '@/stores/authStore';
import type { Task, TaskPriority, TaskStatus, User } from '@/types';

export const useRealtimeTasks = (channelId: string | null) => {
  const { user } = useAuthStore();
  const { tasks, isLoading, fetchTasks, addTask, updateTaskLocal, removeTask, clearTasks } = useTaskStore();
  const subscriptionRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Fetch tasks when channel changes
  useEffect(() => {
    if (!channelId || !user) {
      clearTasks();
      return;
    }

    fetchTasks(channelId, user.id);
  }, [channelId, user?.id]);

  // Setup realtime subscription
  useEffect(() => {
    if (!channelId) {
      return;
    }

    // Clean up previous subscription
    if (subscriptionRef.current) {
      supabase.removeChannel(subscriptionRef.current);
    }

    const channel = supabase
      .channel(`tasks:${channelId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'channel_tasks',
          filter: `channel_id=eq.${channelId}`,
        },
        async (payload) => {
          const { eventType } = payload;
          const newRecord = payload.new as Record<string, unknown> | undefined;
          const oldRecord = payload.old as Record<string, unknown> | undefined;

          if (eventType === 'INSERT' && newRecord) {
            // Create task from payload
            const task: Task = {
              id: newRecord.id as string,
              channel_id: newRecord.channel_id as string,
              created_by: newRecord.created_by as string,
              title: newRecord.title as string,
              description: newRecord.description as string | null,
              priority: newRecord.priority as TaskPriority,
              status: newRecord.status as TaskStatus,
              due_date: newRecord.due_date as string | null,
              position: newRecord.position as number,
              created_at: newRecord.created_at as string,
              updated_at: newRecord.updated_at as string,
              assignees: [],
            };
            addTask(task);
          } else if (eventType === 'UPDATE' && newRecord) {
            updateTaskLocal(newRecord.id as string, {
              title: newRecord.title as string,
              description: newRecord.description as string | null,
              priority: newRecord.priority as TaskPriority,
              status: newRecord.status as TaskStatus,
              due_date: newRecord.due_date as string | null,
              position: newRecord.position as number,
              updated_at: newRecord.updated_at as string,
            });
          } else if (eventType === 'DELETE' && oldRecord) {
            removeTask(oldRecord.id as string);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'task_assignees',
        },
        async (payload) => {
          // When assignees change, refetch the affected task
          const newRecord = payload.new as Record<string, unknown> | undefined;
          const oldRecord = payload.old as Record<string, unknown> | undefined;
          const taskId = (newRecord?.task_id || oldRecord?.task_id) as string | undefined;
          if (taskId && user) {
            // Check if this task is in our current channel
            const existingTask = useTaskStore.getState().tasks.find(t => t.id === taskId);
            if (existingTask && existingTask.channel_id === channelId) {
              // Refetch to get updated assignees
              fetchTasks(channelId, user.id);
            }
          }
        }
      )
      .subscribe();

    subscriptionRef.current = channel;

    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }
    };
  }, [channelId, user?.id]);

  // Refetch on visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && channelId && user) {
        fetchTasks(channelId, user.id);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [channelId, user?.id]);

  return {
    tasks,
    isLoading,
    refetch: () => channelId && user && fetchTasks(channelId, user.id),
  };
};
