import { formatDistanceToNow } from "date-fns";
import { Calendar, Users, AlertCircle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Task } from "@/types";

interface TaskCardProps {
  task: Task;
  onClick: () => void;
}

const statusColors = {
  open: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  in_progress: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  completed: "bg-green-500/10 text-green-500 border-green-500/20",
  archived: "bg-gray-500/10 text-gray-500 border-gray-500/20",
};

const priorityColors = {
  low: "bg-gray-500/10 text-gray-500",
  medium: "bg-yellow-500/10 text-yellow-500",
  high: "bg-red-500/10 text-red-500",
};

export const TaskCard = ({ task, onClick }: TaskCardProps) => {
  const isOverdue =
    task.due_date && new Date(task.due_date) < new Date() && task.status !== "completed";

  return (
    <div
      onClick={onClick}
      className={cn(
        "p-4 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors",
        task.status === "completed" && "opacity-60"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h4 className="font-semibold text-sm truncate">{task.title}</h4>
            <Badge
              variant="outline"
              className={cn("text-xs", statusColors[task.status])}
            >
              {task.status.replace("_", " ")}
            </Badge>
            {task.priority && (
              <Badge variant="outline" className={cn("text-xs", priorityColors[task.priority])}>
                {task.priority}
              </Badge>
            )}
          </div>

          {task.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
              {task.description}
            </p>
          )}

          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {task.due_date && (
              <div className={cn("flex items-center gap-1", isOverdue && "text-red-500")}>
                <Calendar className="w-3 h-3" />
                <span>
                  {isOverdue && "Overdue: "}
                  {formatDistanceToNow(new Date(task.due_date), { addSuffix: true })}
                </span>
              </div>
            )}

            {task.assignees && task.assignees.length > 0 && (
              <div className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                <span>{task.assignees.length} assignee{task.assignees.length !== 1 ? "s" : ""}</span>
                <div className="flex -space-x-2 ml-1">
                  {task.assignees.slice(0, 3).map((assignee) => (
                    <Avatar key={assignee.id} className="w-5 h-5 border-2 border-background">
                      <AvatarImage src={assignee.user?.avatar_url} />
                      <AvatarFallback
                        style={{ backgroundColor: assignee.user?.banner_color || "#5865F2" }}
                        className="text-[8px]"
                      >
                        {assignee.user?.username?.[0]?.toUpperCase() || "?"}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                  {task.assignees.length > 3 && (
                    <div className="w-5 h-5 rounded-full bg-muted border-2 border-background flex items-center justify-center text-[8px]">
                      +{task.assignees.length - 3}
                    </div>
                  )}
                </div>
              </div>
            )}

            <span>Updated {formatDistanceToNow(new Date(task.updated_at), { addSuffix: true })}</span>
          </div>
        </div>

        {isOverdue && (
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
        )}
      </div>
    </div>
  );
};
