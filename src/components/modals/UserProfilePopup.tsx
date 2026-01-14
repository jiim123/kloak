import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { MessageCircle, UserPlus, UserMinus, Loader2, Check, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useUIStore } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';
import { useServerStore } from '@/stores/serverStore';
import { useFriendStore } from '@/stores/friendStore';
import { useDMStore } from '@/stores/dmStore';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { User, UserStatus } from '@/types';

const statusColors: Record<UserStatus, string> = {
  online: 'bg-green-500',
  idle: 'bg-yellow-500',
  dnd: 'bg-red-500',
  offline: 'bg-gray-500',
};

export const UserProfilePopup = () => {
  const { activeModal, modalData, closeModal } = useUIStore();
  const { user: currentUser } = useAuthStore();
  const { servers, setCurrentServer, currentServer, members } = useServerStore();
  const { friends, pendingRequests, outgoingRequests, sendRequest, removeFriend, acceptRequest, declineRequest } = useFriendStore();
  const { openConversation, setCurrentConversation } = useDMStore();
  
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [sharedServers, setSharedServers] = useState<typeof servers>([]);

  const isOpen = activeModal === 'userProfile';
  const userId = modalData?.userId as string | undefined;

  // Fetch user profile
  useEffect(() => {
    if (!isOpen || !userId) return;

    const fetchProfile = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .single();

        if (error) throw error;
        
        setProfileUser({
          id: data.id,
          username: data.username,
          display_name: data.display_name,
          avatar_url: data.avatar_url,
          banner_color: data.banner_color || '#5865F2',
          bio: data.bio,
          status: data.status as UserStatus,
          custom_status: data.custom_status,
          created_at: data.created_at,
          last_seen: data.last_seen,
        });

        // Find shared servers
        const shared = servers.filter(s => 
          // In a real app, you'd check if both users are members
          // For now, just show current user's servers
          true
        );
        setSharedServers(shared.slice(0, 3));
      } catch (error) {
        console.error('Failed to fetch profile:', error);
        toast.error('Failed to load profile');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [isOpen, userId, servers]);

  const isSelf = currentUser?.id === userId;
  const isFriend = friends.some(f => f.id === userId);
  const hasPendingRequest = pendingRequests.some(f => f.id === userId);
  const hasSentRequest = outgoingRequests.some(f => f.id === userId);

  // Get user's roles in current server
  const userRoles = currentServer && userId
    ? members.find(m => m.user_id === userId && m.server_id === currentServer.id)?.roles || []
    : [];

  const handleMessage = async () => {
    if (!currentUser || !profileUser) return;
    
    try {
      const conversation = await openConversation(currentUser.id, profileUser.id);
      if (conversation) {
        // Clear current server to switch to DM view
        setCurrentServer(null);
        setCurrentConversation(conversation);
        closeModal();
      }
    } catch (error) {
      toast.error('Failed to open conversation');
    }
  };

  const handleFriendAction = async () => {
    if (!currentUser || !profileUser) return;
    
    if (isFriend) {
      const friendship = friends.find(f => f.id === profileUser.id);
      if (friendship) {
        await removeFriend(friendship.friendship_id, currentUser.id);
        toast.success('Friend removed');
      }
    } else if (!hasPendingRequest && !hasSentRequest) {
      await sendRequest(currentUser.id, profileUser.username);
      toast.success('Friend request sent!');
    }
  };

  const handleAcceptRequest = async () => {
    if (!currentUser) return;
    const pendingFriend = pendingRequests.find(f => f.id === userId);
    if (pendingFriend) {
      await acceptRequest(pendingFriend.friendship_id, currentUser.id);
      toast.success('Friend request accepted!');
    }
  };

  const handleDeclineRequest = async () => {
    if (!currentUser) return;
    const pendingFriend = pendingRequests.find(f => f.id === userId);
    if (pendingFriend) {
      await declineRequest(pendingFriend.friendship_id, currentUser.id);
      toast.success('Friend request declined');
    }
  };

  const handleClose = () => {
    setProfileUser(null);
    closeModal();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-sm p-0 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : profileUser ? (
          <>
            {/* Banner */}
            <div 
              className="h-24 w-full"
              style={{ backgroundColor: profileUser.banner_color }}
            />

            {/* Profile Content */}
            <div className="px-4 pb-4">
              {/* Avatar */}
              <div className="-mt-12 mb-3">
                <div className="relative inline-block">
                  <Avatar className="w-20 h-20 border-4 border-background">
                    <AvatarImage src={profileUser.avatar_url || undefined} />
                    <AvatarFallback style={{ backgroundColor: profileUser.banner_color }}>
                      {profileUser.username[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className={cn(
                    "absolute bottom-1 right-1 w-5 h-5 rounded-full border-4 border-background",
                    statusColors[profileUser.status]
                  )} />
                </div>
              </div>

              {/* Names */}
              <div className="mb-3">
                <h2 className="text-xl font-bold">
                  {profileUser.display_name || profileUser.username}
                </h2>
                <p className="text-sm text-muted-foreground">@{profileUser.username}</p>
              </div>

              {/* Custom Status */}
              {profileUser.custom_status && (
                <p className="text-sm text-muted-foreground mb-3">
                  {profileUser.custom_status}
                </p>
              )}

              {/* Bio */}
              {profileUser.bio && (
                <div className="bg-secondary rounded-lg p-3 mb-3">
                  <h3 className="text-xs font-bold uppercase text-muted-foreground mb-1">About Me</h3>
                  <p className="text-sm">{profileUser.bio}</p>
                </div>
              )}

              {/* Member Since */}
              <div className="bg-secondary rounded-lg p-3 mb-3">
                <h3 className="text-xs font-bold uppercase text-muted-foreground mb-1">Member Since</h3>
                <p className="text-sm">
                  {profileUser.created_at 
                    ? format(new Date(profileUser.created_at), 'MMM d, yyyy')
                    : 'Unknown'
                  }
                </p>
              </div>

              {/* Server Roles */}
              {currentServer && userId && userRoles.length > 0 && (
                <div className="bg-secondary rounded-lg p-3 mb-3">
                  <h3 className="text-xs font-bold uppercase text-muted-foreground mb-2">
                    Roles in {currentServer.name}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {userRoles.map((role) => (
                      <span
                        key={role.id}
                        className="text-xs font-medium px-2 py-1 rounded"
                        style={{ 
                          backgroundColor: `${role.color}20`,
                          color: role.color,
                          border: `1px solid ${role.color}40`
                        }}
                      >
                        {role.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Shared Servers */}
              {sharedServers.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-xs font-bold uppercase text-muted-foreground mb-2">
                    Shared Servers
                  </h3>
                  <ScrollArea className="max-h-20">
                    <div className="flex gap-2">
                      {sharedServers.map(server => (
                        <div 
                          key={server.id}
                          className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-sm font-medium"
                          title={server.name}
                        >
                          {server.icon_url ? (
                            <img src={server.icon_url} alt={server.name} className="w-full h-full rounded-full object-cover" />
                          ) : (
                            server.name.slice(0, 2).toUpperCase()
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {/* Action Buttons */}
              {!isSelf && (
                <div className="flex gap-2">
                  <Button onClick={handleMessage} className="flex-1">
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Message
                  </Button>
                  {hasPendingRequest ? (
                    // Show accept/decline buttons for pending requests
                    <>
                      <Button 
                        variant="default"
                        onClick={handleAcceptRequest}
                        size="icon"
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={handleDeclineRequest}
                        size="icon"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </>
                  ) : (
                    <Button 
                      variant={isFriend ? 'destructive' : 'secondary'}
                      onClick={handleFriendAction}
                      disabled={hasSentRequest}
                      className="flex-1"
                    >
                      {isFriend ? (
                        <>
                          <UserMinus className="w-4 h-4 mr-2" />
                          Remove
                        </>
                      ) : hasSentRequest ? (
                        'Request Sent'
                      ) : (
                        <>
                          <UserPlus className="w-4 h-4 mr-2" />
                          Add Friend
                        </>
                      )}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};