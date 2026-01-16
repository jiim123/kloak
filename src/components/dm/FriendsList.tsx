import { useEffect, useState } from 'react';
import { Check, X, MessageSquare, MoreHorizontal, UserPlus, Ban, UserX, Users, Search, Inbox, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useFriendStore } from '@/stores/friendStore';
import { useDMStore } from '@/stores/dmStore';
import { useAuthStore } from '@/stores/authStore';
import { FriendItemSkeleton } from '@/components/ui/skeletons';
import { toast } from 'sonner';
import type { FriendWithUser } from '@/types';

interface FriendsListProps {
  onOpenDM: () => void;
}

export const FriendsList = ({ onOpenDM }: FriendsListProps) => {
  const { user } = useAuthStore();
  const {
    friends,
    pendingRequests,
    outgoingRequests,
    blockedUsers,
    isLoading,
    error,
    fetchFriends,
    sendRequest,
    acceptRequest,
    declineRequest,
    removeFriend,
    unblockUser
  } = useFriendStore();
  const { openConversation, setCurrentConversation } = useDMStore();

  const [activeTab, setActiveTab] = useState('online');
  const [addFriendInput, setAddFriendInput] = useState('');
  const [isAddingFriend, setIsAddingFriend] = useState(false);
  const [showAddFriend, setShowAddFriend] = useState(false);

  useEffect(() => {
    if (user?.id) {
      fetchFriends(user.id);
    }
  }, [user?.id, fetchFriends]);

  const onlineFriends = friends.filter((f) => f.status === 'online' || f.status === 'idle');
  const allFriends = friends;

  const handleSendRequest = async () => {
    if (!user?.id || !addFriendInput.trim()) return;

    setIsAddingFriend(true);
    const success = await sendRequest(user.id, addFriendInput.trim());
    setIsAddingFriend(false);

    if (success) {
      toast.success('Friend request sent!');
      setAddFriendInput('');
      setShowAddFriend(false);
    } else if (error) {
      toast.error(error);
    }
  };

  const handleMessage = async (friend: FriendWithUser) => {
    if (!user?.id) return;
    const conversation = await openConversation(user.id, friend.id);
    if (conversation) {
      setCurrentConversation(conversation);
      onOpenDM();
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

  const FriendItem = ({ friend, showActions = true }: { friend: FriendWithUser; showActions?: boolean }) => (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/30 rounded-lg transition-smooth">
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium"
          style={{ backgroundColor: friend.banner_color || '#5865F2' }}
        >
          {friend.avatar_url ? (
            <img
              src={friend.avatar_url}
              alt={friend.username}
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            (friend.username?.[0] || '?').toUpperCase()
          )}
        </div>
        <div
          className={cn(
            'absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-layout-chat',
            getStatusClass(friend.status)
          )}
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground">
            {friend.display_name || friend.username}
          </span>
          <span className="text-sm text-muted-foreground">
            {friend.username}
          </span>
        </div>
        {friend.custom_status ? (
          <p className="text-sm text-muted-foreground truncate">{friend.custom_status}</p>
        ) : (
          <p className="text-sm text-muted-foreground capitalize">{friend.status || 'Offline'}</p>
        )}
      </div>

      {/* Actions */}
      {showActions && (
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="secondary"
            className="w-9 h-9 rounded-full"
            onClick={() => handleMessage(friend)}
          >
            <MessageSquare className="w-4 h-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="secondary" className="w-9 h-9 rounded-full">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleMessage(friend)}>
                <MessageSquare className="w-4 h-4 mr-2" />
                Message
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => user?.id && removeFriend(friend.friendship_id, user.id)}
                className="text-destructive focus:text-destructive"
              >
                <UserX className="w-4 h-4 mr-2" />
                Remove Friend
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );

  const PendingItem = ({ request, isOutgoing }: { request: FriendWithUser; isOutgoing: boolean }) => (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/30 rounded-lg transition-smooth">
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium"
          style={{ backgroundColor: request.banner_color || '#5865F2' }}
        >
          {request.avatar_url ? (
            <img
              src={request.avatar_url}
              alt={request.username}
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            (request.username?.[0] || '?').toUpperCase()
          )}
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <span className="font-medium text-foreground">
          {request.display_name || request.username}
        </span>
        <p className="text-sm text-muted-foreground">
          {isOutgoing ? 'Outgoing Friend Request' : 'Incoming Friend Request'}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {!isOutgoing && (
          <Button
            size="icon"
            variant="secondary"
            className="w-9 h-9 rounded-full bg-green-500/20 hover:bg-green-500/30 text-green-500"
            onClick={() => user?.id && acceptRequest(request.friendship_id, user.id)}
          >
            <Check className="w-4 h-4" />
          </Button>
        )}
        <Button
          size="icon"
          variant="secondary"
          className="w-9 h-9 rounded-full bg-destructive/20 hover:bg-destructive/30 text-destructive"
          onClick={() => user?.id && declineRequest(request.friendship_id, user.id)}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );

  const BlockedItem = ({ blocked }: { blocked: FriendWithUser }) => (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/30 rounded-lg transition-smooth">
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium opacity-50"
          style={{ backgroundColor: blocked.banner_color || '#5865F2' }}
        >
          {blocked.avatar_url ? (
            <img
              src={blocked.avatar_url}
              alt={blocked.username}
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            (blocked.username?.[0] || '?').toUpperCase()
          )}
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <span className="font-medium text-muted-foreground">
          {blocked.display_name || blocked.username}
        </span>
        <p className="text-sm text-muted-foreground">Blocked</p>
      </div>

      {/* Unblock */}
      <Button
        size="sm"
        variant="outline"
        onClick={() => user?.id && unblockUser(user.id, blocked.id)}
      >
        Unblock
      </Button>
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-layout-chat">
      {/* Header - hidden on mobile since we have MobileHeader */}
      <div className="h-12 px-4 hidden md:flex items-center justify-between border-b border-border shadow-sm">
        <div className="flex items-center gap-4">
          <h2 className="font-semibold text-foreground">Friends</h2>
        </div>
        <Button
          size="sm"
          variant={showAddFriend ? "secondary" : "default"}
          onClick={() => setShowAddFriend(!showAddFriend)}
          className="gap-2"
        >
          <UserPlus className="w-4 h-4" />
          Add Friend
        </Button>
      </div>

      {/* Mobile add friend button */}
      <div className="md:hidden p-2 border-b border-border">
        <Button
          size="sm"
          variant={showAddFriend ? "secondary" : "default"}
          onClick={() => setShowAddFriend(!showAddFriend)}
          className="w-full gap-2"
        >
          <UserPlus className="w-4 h-4" />
          Add Friend
        </Button>
      </div>

      {/* Add Friend Form */}
      {showAddFriend && (
        <div className="p-4 border-b border-border bg-secondary/20">
          <h3 className="font-semibold text-foreground mb-2">Add Friend</h3>
          <p className="text-sm text-muted-foreground mb-3">
            You can add a friend with their username.
          </p>
          <div className="flex gap-2">
            <Input
              placeholder="Enter a username"
              value={addFriendInput}
              onChange={(e) => setAddFriendInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendRequest()}
              className="flex-1"
            />
            <Button
              onClick={handleSendRequest}
              disabled={!addFriendInput.trim() || isAddingFriend}
            >
              {isAddingFriend ? 'Sending...' : 'Send Request'}
            </Button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="px-4 pt-4">
          <TabsList className="bg-secondary/50">
            <TabsTrigger value="online">
              Online
              {onlineFriends.length > 0 && (
                <span className="ml-1.5 text-xs">— {onlineFriends.length}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="all">
              All
              {allFriends.length > 0 && (
                <span className="ml-1.5 text-xs">— {allFriends.length}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="pending">
              Pending
              {(pendingRequests.length + outgoingRequests.length) > 0 && (
                <span className="ml-1.5 text-xs bg-destructive text-destructive-foreground px-1.5 py-0.5 rounded-full">
                  {pendingRequests.length + outgoingRequests.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="blocked">Blocked</TabsTrigger>
            <TabsTrigger value="info">Info</TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <TabsContent value="online" className="m-0">
            {isLoading ? (
              <div className="space-y-1">
                <FriendItemSkeleton />
                <FriendItemSkeleton />
                <FriendItemSkeleton />
              </div>
            ) : onlineFriends.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-secondary/50 flex items-center justify-center mb-4">
                  <Users className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="font-medium text-foreground mb-1">No one's around...</h3>
                <p className="text-sm text-muted-foreground">
                  {friends.length > 0 ? 'None of your friends are online right now.' : 'Add some friends to see who\'s online!'}
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {onlineFriends.map((friend) => (
                  <FriendItem key={friend.id} friend={friend} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="all" className="m-0">
            {isLoading ? (
              <div className="space-y-1">
                <FriendItemSkeleton />
                <FriendItemSkeleton />
                <FriendItemSkeleton />
              </div>
            ) : allFriends.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-secondary/50 flex items-center justify-center mb-4">
                  <UserPlus className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="font-medium text-foreground mb-1">No friends yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Wumpus is waiting for you to add a friend!
                </p>
                <Button onClick={() => setShowAddFriend(true)} className="gap-2">
                  <UserPlus className="w-4 h-4" />
                  Add Friend
                </Button>
              </div>
            ) : (
              <div className="space-y-1">
                {allFriends.map((friend) => (
                  <FriendItem key={friend.id} friend={friend} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="pending" className="m-0">
            {pendingRequests.length === 0 && outgoingRequests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-secondary/50 flex items-center justify-center mb-4">
                  <Inbox className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="font-medium text-foreground mb-1">No pending requests</h3>
                <p className="text-sm text-muted-foreground">
                  Friend requests will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {pendingRequests.map((request) => (
                  <PendingItem key={request.id} request={request} isOutgoing={false} />
                ))}
                {outgoingRequests.map((request) => (
                  <PendingItem key={request.id} request={request} isOutgoing />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="blocked" className="m-0">
            {blockedUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-secondary/50 flex items-center justify-center mb-4">
                  <Ban className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="font-medium text-foreground mb-1">No blocked users</h3>
                <p className="text-sm text-muted-foreground">
                  You haven't blocked anyone.
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {blockedUsers.map((blocked) => (
                  <BlockedItem key={blocked.id} blocked={blocked} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="info" className="m-0">
            <div className="max-w-3xl mx-auto py-8 px-4 space-y-8">
              <div className="text-center space-y-4">
                <h2 className="text-3xl font-bold text-foreground">Welcome to Kloak</h2>
                <p className="text-muted-foreground max-w-lg mx-auto">
                  Privacy isn't a feature. It's the architecture.
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="p-6 rounded-lg border border-border/40 bg-card/30 hover:border-primary/30 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <Users className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Zero Data Collection</h3>
                  <p className="text-sm text-muted-foreground">
                    We don't ask for your email, phone number, or identity. We collect only what is essential.
                  </p>
                </div>

                <div className="p-6 rounded-lg border border-border/40 bg-card/30 hover:border-primary/30 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <Check className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Key-Based Auth</h3>
                  <p className="text-sm text-muted-foreground">
                    Your account is secured by a cryptographic key only you possess. We cannot access it.
                  </p>
                </div>

                <div className="p-6 rounded-lg border border-border/40 bg-card/30 hover:border-primary/30 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <Ban className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">No Tracking</h3>
                  <p className="text-sm text-muted-foreground">
                    No ads, no behavior tracking, no profiling. Your data is yours alone.
                  </p>
                </div>

                <div className="p-6 rounded-lg border border-border/40 bg-card/30 hover:border-primary/30 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <Info className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Open Architecture</h3>
                  <p className="text-sm text-muted-foreground">
                    Transparent approach. We tell you exactly what we do and don't do.
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};