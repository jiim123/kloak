import { format } from "date-fns";
import { Loader2, Pin, X } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUIStore } from "@/stores/uiStore";
import { useServerStore } from "@/stores/serverStore";
import { useMessageStore } from "@/stores/messageStore";
import { useAuthStore } from "@/stores/authStore";
import { useUserCacheStore } from "@/stores/userCacheStore";
import { useRealtimePinnedMessages } from "@/hooks/useRealtimePinnedMessages";
import { useMemberPermissions } from "@/hooks/useMemberPermissions";
import { toast } from "sonner";
import { PollMessage } from "@/components/chat/PollMessage";
import { MessageContent } from "@/components/chat/MessageContent";
import { getPollIdFromContent } from "@/lib/poll";

export const PinnedMessagesPanel = () => {
  const { activeModal, closeModal } = useUIStore();
  const { currentChannel } = useServerStore();
  const { pinMessage } = useMessageStore();
  const { user } = useAuthStore();

  const isOpen = activeModal === "pinned-messages";
  const { pinnedMessages, isLoading, refetch } = useRealtimePinnedMessages(
    isOpen && currentChannel ? currentChannel.id : null
  );

  const { hasPermission } = useMemberPermissions();
  const canManageMessages = hasPermission("manage_messages");

  const handleClose = () => {
    closeModal();
  };

  const handleUnpin = async (messageId: string) => {
    if (!user) return;

    try {
      await pinMessage(messageId, false, user.id);
      refetch();
      toast.success("Message unpinned");
    } catch {
      toast.error("Failed to unpin message");
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <SheetContent
        side="right"
        className="app-shell-theme-scope w-[min(440px,calc(100vw-1rem))] max-w-[calc(100vw-1rem)] gap-0 overflow-hidden border-l border-border bg-background p-0 text-foreground shadow-2xl sm:w-[560px] sm:max-w-[560px]"
        hideCloseButton
      >
        <div className="flex h-full flex-col overflow-hidden">
          <div className="border-b border-border bg-card px-5 py-3">
            <div className="flex items-center gap-2">
              <Pin className="h-4 w-4 text-foreground" />
              <div className="text-base font-medium leading-none tracking-tight">Pinned Messages</div>
            </div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {currentChannel ? `#${currentChannel.name}` : "No channel selected"}
              {pinnedMessages.length > 0 ? ` | ${pinnedMessages.length} pinned` : ""}
            </p>
          </div>

          <ScrollArea className="flex-1">
            <div className="space-y-4 px-6 py-4">
              {isLoading ? (
                <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-[6px] border border-border bg-card">
                    <Loader2 className="h-5 w-5 animate-spin text-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Loading pinned messages</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Fetching saved messages for this channel.
                    </p>
                  </div>
                </div>
              ) : pinnedMessages.length > 0 ? (
                <div className="space-y-3">
                  {pinnedMessages.map((message) => {
                    const msgUser = useUserCacheStore.getState().getUser(message.user_id);

                    return (
                      <div
                        key={message.id}
                        className="group rounded-[4px] border border-border bg-card p-4 transition-colors hover:border-muted-foreground/35 hover:bg-muted/70"
                      >
                        <div className="flex items-start gap-3">
                          <Avatar className="h-9 w-9 flex-shrink-0 rounded-full">
                            <AvatarImage src={msgUser?.avatar_url || undefined} />
                            <AvatarFallback style={{ backgroundColor: msgUser?.banner_color || "#5865F2" }}>
                              {msgUser?.username?.[0]?.toUpperCase() || "?"}
                            </AvatarFallback>
                          </Avatar>

                          <div className="min-w-0 flex-1">
                            <div className="mb-2 flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                  <span className="text-sm font-medium text-foreground">
                                    {msgUser?.display_name || msgUser?.username || "Unknown user"}
                                  </span>
                                  {message.created_at && (
                                    <span className="text-xs text-muted-foreground">
                                      {format(new Date(message.created_at), "MMM d, h:mm a")}
                                    </span>
                                  )}
                                </div>
                                <div className="mt-1 flex items-center gap-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                                  <Pin className="h-3 w-3" />
                                  Pinned message
                                </div>
                              </div>

                              {canManageMessages && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 flex-shrink-0 rounded-[3px] text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100"
                                  onClick={() => handleUnpin(message.id)}
                                  aria-label="Unpin message"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              )}
                            </div>

                            {(() => {
                              const pollId = getPollIdFromContent(message.content);
                              if (pollId) {
                                return <PollMessage pollId={pollId} />;
                              }

                              return (
                                <div className="text-sm leading-6 text-foreground">
                                  <MessageContent
                                    content={message.content}
                                    currentUserId={user?.id}
                                    messageId={message.id}
                                    messageUser={
                                      msgUser
                                        ? {
                                            id: msgUser.id,
                                            username: msgUser.username,
                                            display_name: msgUser.display_name,
                                          }
                                        : undefined
                                    }
                                  />
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex min-h-[320px] flex-col items-center justify-center px-6 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-[6px] border border-border bg-card">
                    <Pin className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="mt-4 text-sm font-medium text-foreground">No pinned messages</p>
                  <p className="mt-1 max-w-[280px] text-xs leading-5 text-muted-foreground">
                    Pin important messages here so they stay easy to find later.
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="flex items-center justify-end gap-3 border-t border-border bg-card px-5 py-3">
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
              className="h-9 rounded-[3px] px-4 text-muted-foreground hover:bg-transparent hover:text-foreground"
            >
              Close
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
