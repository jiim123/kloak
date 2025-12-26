import { useEffect, useState } from 'react';
import { Search, Users, X, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useDMStore } from '@/stores/dmStore';
import { useAuthStore } from '@/stores/authStore';
import { formatRelativeTime } from '@/lib/format';
import { ConversationItemSkeleton } from '@/components/ui/skeletons';
import type { DMConversation } from '@/types';

interface DMSidebarProps {
  showFriends: boolean;
  onShowFriendsChange: (show: boolean) => void;
}

export const DMSidebar = ({ showFriends, onShowFriendsChange }: DMSidebarProps) => {
  const { user } = useAuthStore();
  const { conversations, currentConversation, fetchConversations, setCurrentConversation, isLoading } = useDMStore();
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (user?.id) {
      fetchConversations(user.id);
    }
  }, [user?.id, fetchConversations]);

  const filteredConversations = conversations.filter((conv) => {
    if (!searchQuery) return true;
    const username = conv.other_user?.username?.toLowerCase() || '';
    const displayName = conv.other_user?.display_name?.toLowerCase() || '';
    return username.includes(searchQuery.toLowerCase()) || displayName.includes(searchQuery.toLowerCase());
  });

  const handleSelectConversation = (conversation: DMConversation) => {
    setCurrentConversation(conversation);
    onShowFriendsChange(false);
  };

  const handleCloseConversation = (e: React.MouseEvent, conversationId: string) => {
    e.stopPropagation();
    // For now, just deselect if it's the current one
    if (currentConversation?.id === conversationId) {
      setCurrentConversation(null);
    }
  };

  const getStatusClass = (status?: string) => {
    switch (status) {
      case 'online': return 'status-online';
      case 'idle': return 'status-idle';
      case 'dnd': return 'status-dnd';
      default: return 'status-offline';
    }
  };

  return (
    <div className="h-full flex flex-col bg-layout-sidebar-secondary">
      {/* Header */}
      <div className="h-12 px-4 flex items-center border-b border-border shadow-sm">
        <h2 className="font-semibold text-foreground">Direct Messages</h2>
      </div>

      {/* Search */}
      <div className="p-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Find or start a conversation"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 bg-secondary/50 border-0 text-sm"
          />
        </div>
      </div>

      {/* Friends Button */}
      <div className="px-2 mb-2">
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start gap-3 h-11",
            showFriends && "bg-secondary"
          )}
          onClick={() => onShowFriendsChange(true)}
        >
          <Users className="w-5 h-5" />
          <span>Friends</span>
        </Button>
      </div>

      {/* Section header */}
      <div className="px-4 py-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Direct Messages
        </h3>
      </div>

      {/* Conversations list */}
      <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
        {/* Loading state */}
        {isLoading && conversations.length === 0 && (
          <>
            <ConversationItemSkeleton />
            <ConversationItemSkeleton />
            <ConversationItemSkeleton />
          </>
        )}

        {/* Empty state */}
        {!isLoading && filteredConversations.length === 0 && (
          <div className="px-2 py-8 text-center">
            <div className="w-12 h-12 rounded-full bg-secondary/50 flex items-center justify-center mx-auto mb-3">
              <MessageSquare className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              {searchQuery ? 'No conversations found' : 'No direct messages yet'}
            </p>
            {!searchQuery && (
              <p className="text-xs text-muted-foreground mt-1">
                Start a conversation with a friend!
              </p>
            )}
          </div>
        )}

        {/* Conversations */}
        {filteredConversations.map((conversation) => (
            <div
              key={conversation.id}
              className={cn(
                "group flex items-center gap-3 px-2 py-2 rounded cursor-pointer transition-smooth",
                currentConversation?.id === conversation.id && !showFriends
                  ? "bg-secondary"
                  : "hover:bg-secondary/50"
              )}
              onClick={() => handleSelectConversation(conversation)}
            >
              {/* Avatar with status */}
              <div className="relative flex-shrink-0">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                  style={{ backgroundColor: conversation.other_user?.banner_color || '#5865F2' }}
                >
                  {conversation.other_user?.avatar_url ? (
                    <img
                      src={conversation.other_user.avatar_url}
                      alt={conversation.other_user.username}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    (conversation.other_user?.username?.[0] || '?').toUpperCase()
                  )}
                </div>
                <div
                  className={cn(
                    'absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-layout-sidebar-secondary',
                    getStatusClass(conversation.other_user?.status)
                  )}
                />
              </div>

              {/* Name and last message */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground truncate">
                    {conversation.other_user?.display_name || conversation.other_user?.username || 'Unknown'}
                  </span>
                  {conversation.last_message && (
                    <span className="text-xs text-muted-foreground">
                      {formatRelativeTime(conversation.last_message.created_at || '')}
                    </span>
                  )}
                </div>
                {conversation.last_message && (
                  <p className="text-xs text-muted-foreground truncate">
                    {conversation.last_message.content}
                  </p>
                )}
              </div>

              {/* Close button */}
              <button
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-secondary rounded transition-opacity"
                onClick={(e) => handleCloseConversation(e, conversation.id)}
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
        ))}
      </div>
    </div>
  );
};