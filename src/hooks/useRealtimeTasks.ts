import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Task, TaskAssignee, TaskComment } from '@/types';

interface UseRealtimeTasksOptions {
  channelId: string | null;
  onTaskChange?: (task: Task) => void;
  onTaskDelete?: (taskId: string) => void;
  onAssigneeChange?: (taskId: string, assignees: TaskAssignee[]) => void;
  onCommentChange?: (comment: TaskComment) => void;
  onCommentDelete?: (commentId: string) => void;
}

export const useRealtimeTasks = ({
  channelId,
  onTaskChange,
  onTaskDelete,
  onAssigneeChange,
  onCommentChange,
  onCommentDelete,
}: UseRealtimeTasksOptions) => {
  const callbacksRef = useRef({
    onTaskChange,
    onTaskDelete,
    onAssigneeChange,
    onCommentChange,
    onCommentDelete,
  });

  // Keep callbacks updated
  useEffect(() => {
    callbacksRef.current = {
      onTaskChange,
      onTaskDelete,
      onAssigneeChange,
      onCommentChange,
      onCommentDelete,
    };
  }, [onTaskChange, onTaskDelete, onAssigneeChange, onCommentChange, onCommentDelete]);

  useEffect(() => {
    if (!channelId) return;

    const channel = supabase
      .channel(`tasks:${channelId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'tasks',
          filter: `channel_id=eq.${channelId}`,
        },
        async (payload) => {
          const task = payload.new as any;
          // Fetch assignees for the new task
          const { data: assignees } = await supabase
            .from('task_assignees')
            .select('*')
            .eq('task_id', task.id);
          
          const taskWithAssignees: Task = {
            ...task,
            assignees: assignees || [],
          };
          
          callbacksRef.current.onTaskChange?.(taskWithAssignees);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tasks',
          filter: `channel_id=eq.${channelId}`,
        },
        async (payload) => {
          const task = payload.new as any;
          // Fetch assignees for the updated task
          const { data: assignees } = await supabase
            .from('task_assignees')
            .select('*')
            .eq('task_id', task.id);
          
          const taskWithAssignees: Task = {
            ...task,
            assignees: assignees || [],
          };
          
          callbacksRef.current.onTaskChange?.(taskWithAssignees);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'tasks',
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => {
          const oldTask = payload.old as { id: string };
          callbacksRef.current.onTaskDelete?.(oldTask.id);
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
          const assignee = payload.new as any;
          if (!assignee?.task_id) return;
          
          // Fetch all assignees for this task
          const { data: assignees } = await supabase
            .from('task_assignees')
            .select('*')
            .eq('task_id', assignee.task_id);
          
          callbacksRef.current.onAssigneeChange?.(assignee.task_id, assignees || []);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'task_comments',
        },
        (payload) => {
          const comment = payload.new as any;
          callbacksRef.current.onCommentChange?.(comment as TaskComment);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'task_comments',
        },
        (payload) => {
          const comment = payload.new as any;
          callbacksRef.current.onCommentChange?.(comment as TaskComment);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'task_comments',
        },
        (payload) => {
          const oldComment = payload.old as { id: string };
          callbacksRef.current.onCommentDelete?.(oldComment.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelId]);
};
