import { useState, useMemo, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { ChevronDown, ChevronRight, ListTodo, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ChannelHeader } from '@/components/chat/ChannelHeader';
import { TaskItem } from './TaskItem';
import { CreateTaskInput } from './CreateTaskInput';
import { TaskDetailsPanel } from './TaskDetailsPanel';
import { useRealtimeTasks } from '@/hooks/useRealtimeTasks';
import { useTaskStore } from '@/stores/taskStore';
import { useServerStore } from '@/stores/serverStore';
import { useAuthStore } from '@/stores/authStore';
import { useMemberPermissions } from '@/hooks/useMemberPermissions';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { motion, AnimatePresence } from 'framer-motion';
import type { Task } from '@/types';

export const TasksChannelArea = () => {
  const { currentChannel, currentServer, members } = useServerStore();
  const { user } = useAuthStore();
  const { selectedTaskId, setSelectedTaskId, createTask, updateTask, deleteTask, toggleTaskStatus, assignUsers, unassignUsers, reorderTasks } = useTaskStore();
  const { tasks, isLoading } = useRealtimeTasks(currentChannel?.id || null);
  const { hasPermission } = useMemberPermissions(currentChannel?.id);
  
  const [completedCollapsed, setCompletedCollapsed] = useState(true);
  const [draggingTask, setDraggingTask] = useState<Task | null>(null);

  // Permission checks
  const canViewTasks = hasPermission('view_tasks');
  const canCreateTasks = hasPermission('create_tasks');
  const canEditOwnTasks = hasPermission('edit_own_tasks');
  const canEditAllTasks = hasPermission('edit_all_tasks');
  const canAssignTasks = hasPermission('assign_tasks');
  const canChangeTaskStatus = hasPermission('change_task_status');
  const canDeleteTasks = hasPermission('delete_tasks');

  // Split tasks into open and completed
  const { openTasks, completedTasks } = useMemo(() => {
    const open: Task[] = [];
    const completed: Task[] = [];
    
    for (const task of tasks) {
      if (task.status === 'completed') {
        completed.push(task);
      } else {
        open.push(task);
      }
    }
    
    // Sort by position
    open.sort((a, b) => a.position - b.position);
    completed.sort((a, b) => b.position - a.position); // Newest completed first
    
    return { openTasks: open, completedTasks: completed };
  }, [tasks]);

  // Get selected task
  const selectedTask = useMemo(() => {
    if (!selectedTaskId) return null;
    return tasks.find(t => t.id === selectedTaskId) || null;
  }, [selectedTaskId, tasks]);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Check if user can edit a specific task
  const canEditTask = useCallback((task: Task) => {
    if (canEditAllTasks) return true;
    if (canEditOwnTasks && task.created_by === user?.id) return true;
    return false;
  }, [canEditAllTasks, canEditOwnTasks, user?.id]);

  // Check if user can toggle task status
  const canToggleStatus = useCallback((task: Task) => {
    if (canChangeTaskStatus) return true;
    // Assignees can mark their assigned tasks as completed
    if (task.assignees?.some(a => a.user_id === user?.id)) return true;
    return false;
  }, [canChangeTaskStatus, user?.id]);

  // Check if user can delete a specific task
  const canDeleteTask = useCallback((task: Task) => {
    if (canDeleteTasks) return true;
    // Task creators can delete their own tasks
    if (task.created_by === user?.id) return true;
    return false;
  }, [canDeleteTasks, user?.id]);

  // Handle task creation
  const handleCreateTask = async (title: string) => {
    if (!currentChannel || !user) return;
    await createTask(currentChannel.id, user.id, title);
  };

  // Handle task update
  const handleUpdateTask = async (taskId: string, updates: Parameters<typeof updateTask>[2]) => {
    if (!user) return false;
    return updateTask(taskId, user.id, updates);
  };

  // Handle task delete
  const handleDeleteTask = async (taskId: string) => {
    if (!user) return false;
    return deleteTask(taskId, user.id);
  };

  // Handle toggle status
  const handleToggleStatus = async (taskId: string) => {
    if (!user) return;
    await toggleTaskStatus(taskId, user.id);
  };

  // Handle assign users
  const handleAssignUsers = async (taskId: string, userIds: string[]) => {
    if (!user) return false;
    return assignUsers(taskId, user.id, userIds);
  };

  // Handle unassign users
  const handleUnassignUsers = async (taskId: string, userIds: string[]) => {
    if (!user) return false;
    return unassignUsers(taskId, user.id, userIds);
  };

  // Drag handlers
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const task = openTasks.find(t => t.id === active.id);
    if (task) setDraggingTask(task);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setDraggingTask(null);

    if (!over || active.id === over.id || !currentChannel || !user) return;

    const oldIndex = openTasks.findIndex(t => t.id === active.id);
    const newIndex = openTasks.findIndex(t => t.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const newOrder = arrayMove(openTasks, oldIndex, newIndex);
      await reorderTasks(currentChannel.id, user.id, newOrder.map(t => t.id));
    }
  };

  if (!currentChannel) return null;

  if (!canViewTasks) {
    return (
      <div className="h-full flex flex-col">
        <ChannelHeader channel={currentChannel} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <ListTodo className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium">Access Denied</h3>
            <p className="text-sm text-muted-foreground mt-1">
              You don't have permission to view tasks in this channel.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      <ChannelHeader channel={currentChannel} />
      
      <div className="flex-1 flex min-h-0">
        {/* Task list */}
        <div className="flex-1 flex flex-col min-w-0">
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-2">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                >
                  {/* Open tasks */}
                  <SortableContext
                    items={openTasks.map(t => t.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <AnimatePresence mode="popLayout">
                      {openTasks.map((task) => (
                        <motion.div
                          key={task.id}
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -10 }}
                          transition={{ duration: 0.15 }}
                        >
                          <TaskItem
                            task={task}
                            canToggleStatus={canToggleStatus(task)}
                            canEdit={canEditTask(task)}
                            canDelete={canDeleteTask(task)}
                            canAssign={canAssignTasks}
                            onToggleStatus={() => handleToggleStatus(task.id)}
                            onEdit={() => setSelectedTaskId(task.id)}
                            onDelete={() => handleDeleteTask(task.id)}
                            onAssign={() => setSelectedTaskId(task.id)}
                            onSelect={() => setSelectedTaskId(task.id)}
                            onUpdateTitle={(title) => handleUpdateTask(task.id, { title })}
                            isDraggable={canEditTask(task)}
                          />
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </SortableContext>

                  {/* Drag overlay */}
                  <DragOverlay>
                    {draggingTask && (
                      <div className="bg-card shadow-lg rounded-lg border border-primary/30">
                        <TaskItem
                          task={draggingTask}
                          canToggleStatus={false}
                          canEdit={false}
                          canDelete={false}
                          canAssign={false}
                          onToggleStatus={() => {}}
                          onEdit={() => {}}
                          onDelete={() => {}}
                          onAssign={() => {}}
                          onSelect={() => {}}
                          onUpdateTitle={() => {}}
                          isDraggable={false}
                        />
                      </div>
                    )}
                  </DragOverlay>
                </DndContext>
              )}

              {/* Create task input */}
              {canCreateTasks && (
                <CreateTaskInput
                  onCreateTask={handleCreateTask}
                  disabled={isLoading}
                />
              )}

              {/* Empty state */}
              {!isLoading && openTasks.length === 0 && (
                <div className="text-center py-8">
                  <ListTodo className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
                  <h3 className="text-lg font-medium text-muted-foreground">No tasks yet</h3>
                  <p className="text-sm text-muted-foreground/60 mt-1">
                    {canCreateTasks
                      ? 'Create a task to get started'
                      : 'Tasks will appear here when they are created'}
                  </p>
                </div>
              )}

              {/* Completed tasks */}
              {completedTasks.length > 0 && (
                <Collapsible
                  open={!completedCollapsed}
                  onOpenChange={(open) => setCompletedCollapsed(!open)}
                  className="mt-6"
                >
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className="w-full justify-start gap-2 h-8 px-2 text-muted-foreground hover:text-foreground"
                    >
                      {completedCollapsed ? (
                        <ChevronRight className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                      <span className="text-xs font-medium uppercase tracking-wider">
                        {completedTasks.length} Completed
                      </span>
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-2 space-y-1">
                      <AnimatePresence>
                        {completedTasks.map((task) => (
                          <motion.div
                            key={task.id}
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.15 }}
                          >
                            <TaskItem
                              task={task}
                              canToggleStatus={canToggleStatus(task)}
                              canEdit={canEditTask(task)}
                              canDelete={canDeleteTask(task)}
                              canAssign={canAssignTasks}
                              onToggleStatus={() => handleToggleStatus(task.id)}
                              onEdit={() => setSelectedTaskId(task.id)}
                              onDelete={() => handleDeleteTask(task.id)}
                              onAssign={() => setSelectedTaskId(task.id)}
                              onSelect={() => setSelectedTaskId(task.id)}
                              onUpdateTitle={(title) => handleUpdateTask(task.id, { title })}
                              isDraggable={false}
                            />
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Details panel */}
        {selectedTask && (
          <TaskDetailsPanel
            task={selectedTask}
            members={members}
            canEdit={canEditTask(selectedTask)}
            canDelete={canDeleteTask(selectedTask)}
            canAssign={canAssignTasks}
            onClose={() => setSelectedTaskId(null)}
            onUpdate={(updates) => handleUpdateTask(selectedTask.id, updates)}
            onDelete={() => handleDeleteTask(selectedTask.id)}
            onAssign={(userIds) => handleAssignUsers(selectedTask.id, userIds)}
            onUnassign={(userIds) => handleUnassignUsers(selectedTask.id, userIds)}
          />
        )}
      </div>
    </div>
  );
};
