import { useMemo } from "react";
import { MessageContent } from "@/components/chat/MessageContent";
import { useServerStore } from "@/stores/serverStore";
import { useAuthStore } from "@/stores/authStore";

interface AnnouncementPreviewProps {
  title: string;
  content: string;
}

export const AnnouncementPreview = ({ title, content }: AnnouncementPreviewProps) => {
  const { user } = useAuthStore();
  const { members, channels } = useServerStore();

  // Combine title and content for preview
  const fullContent = useMemo(() => {
    if (!content.trim()) return title || "";
    return title ? `${title}\n\n${content}` : content;
  }, [title, content]);

  if (!fullContent.trim()) {
    return (
      <div className="text-sm text-muted-foreground italic p-4 border border-dashed border-border rounded-lg">
        Preview will appear here...
      </div>
    );
  }

  return (
    <div className="p-4 border border-border rounded-lg bg-background/50">
      {title && (
        <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      )}
      <div className="text-sm">
        <MessageContent
          content={content || ""}
          currentUserId={user?.id}
          messageUser={user ? {
            id: user.id,
            username: user.username,
            display_name: user.display_name,
          } : undefined}
        />
      </div>
    </div>
  );
};
