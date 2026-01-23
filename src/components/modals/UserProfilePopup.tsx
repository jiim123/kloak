import { useEffect, useState, useCallback } from 'react';
import { format } from 'date-fns';
import { MessageCircle, UserPlus, UserMinus, Loader2, Check, X, Clock } from 'lucide-react';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AvatarWithDecoration } from '@/components/ui/avatar-with-decoration';
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

const COOLDOWN_MINUTES = 5;

const withAlpha = (hex: string, alphaHex: string) => {
  // Supports "#RRGGBB" -> "#RRGGBBAA"
  if (!hex || !hex.startsWith('#') || hex.length !== 7) return hex;
  return `${hex}${alphaHex}`;
};

const hexToRgb = (hex: string) => {
  const h = hex.trim().toLowerCase();
  if (!h.startsWith('#') || h.length !== 7) return null;
  const r = parseInt(h.slice(1, 3), 16);
  const g = parseInt(h.slice(3, 5), 16);
  const b = parseInt(h.slice(5, 7), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return null;
  return { r, g, b };
};

const relLuminance = (hex: string) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const srgb = [rgb.r, rgb.g, rgb.b].map((v) => v / 255);
  const lin = srgb.map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
};

const isLightTheme = (primary?: string | null, accent?: string | null, fallback?: string | null) => {
  const lums: number[] = [];
  if (primary) {
    const l = relLuminance(primary);
    if (l !== null) lums.push(l);
  }
  if (accent) {
    const l = relLuminance(accent);
    if (l !== null) lums.push(l);
  }
  if (lums.length === 0 && fallback) {
    const l = relLuminance(fallback);
    if (l !== null) lums.push(l);
  }
  if (lums.length === 0) return false;
  const avg = lums.reduce((a, b) => a + b, 0) / lums.length;
  return avg > 0.62;
};

export const UserProfilePopup = () => {
  const { activeModal, modalData, closeModal } = useUIStore();
  const { user: currentUser } = useAuthStore();
  const { servers, setCurrentServer, currentServer, members } = useServerStore();
  const { friends, pendingRequests, outgoingRequests, sendRequest, removeFriend, acceptRequest, declineRequest, error: friendError } = useFriendStore();
  const { openConversation, setCurrentConversation } = useDMStore();

  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [sharedServers, setSharedServers] = useState<typeof servers>([]);
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);
  const [isSendingRequest, setIsSendingRequest] = useState(false);

  const isOpen = activeModal === 'userProfile';
  const userId = modalData?.userId as string | undefined;

  // Check for cooldown from declined requests
  const checkCooldown = useCallback(async () => {
    if (!currentUser?.id || !userId || currentUser.id === userId) return;

    try {
      const { data, error } = await supabase
        .from('declined_friend_requests')
        .select('declined_at')
        .eq('requester_id', currentUser.id)
        .eq('addressee_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
        console.error('Failed to check cooldown:', error);
        return;
      }

      if (data?.declined_at) {
        const declinedAt = new Date(data.declined_at);
        const cooldownEnd = new Date(declinedAt.getTime() + COOLDOWN_MINUTES * 60 * 1000);
        const now = new Date();
        const remainingMs = cooldownEnd.getTime() - now.getTime();
        
        if (remainingMs > 0) {
          setCooldownSeconds(Math.ceil(remainingMs / 1000));
        } else {
          setCooldownSeconds(0);
        }
      } else {
        setCooldownSeconds(0);
      }
    } catch (err) {
      console.error('Error checking cooldown:', err);
    }
  }, [currentUser?.id, userId]);

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
          banner_url: data.banner_url ?? null,
          avatar_decoration: data.avatar_decoration,
          banner_color: data.banner_color || '#5865F2',
          profile_theme_primary: data.profile_theme_primary ?? null,
          profile_theme_accent: data.profile_theme_accent ?? null,
          bio: data.bio,
          status: data.status as UserStatus,
          custom_status: data.custom_status,
          created_at: data.created_at,
          last_seen: data.last_seen,
        });

        // Find shared servers by checking which of the current user's servers the profile user is also in
        if (servers.length > 0) {
          const { data: membershipData, error: membershipError } = await supabase
            .from('server_members')
            .select('server_id')
            .eq('user_id', userId)
            .in('server_id', servers.map((s) => s.id));

          if (membershipError) throw membershipError;

          const sharedServerIds = new Set(membershipData.map((m) => m.server_id));
          const shared = servers.filter((s) => sharedServerIds.has(s.id));
          setSharedServers(shared.slice(0, 3));
        } else {
          setSharedServers([]);
        }

        // Check cooldown after loading profile
        await checkCooldown();
      } catch (error) {
        console.error('Failed to fetch profile:', error);
        toast.error('Failed to load profile');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [isOpen, userId, servers, checkCooldown]);

  // Countdown timer effect
  useEffect(() => {
    if (cooldownSeconds <= 0) return;

    const interval = setInterval(() => {
      setCooldownSeconds(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [cooldownSeconds]);

  const isSelf = currentUser?.id === userId;
  const isFriend = friends.some(f => f.id === userId);
  const hasPendingRequest = pendingRequests.some(f => f.id === userId);
  const hasSentRequest = outgoingRequests.some(f => f.id === userId);
  const isInCooldown = cooldownSeconds > 0;

  // Format cooldown time as MM:SS
  const formatCooldown = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

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
    } else if (!hasPendingRequest && !hasSentRequest && !isInCooldown) {
      setIsSendingRequest(true);
      const success = await sendRequest(currentUser.id, profileUser.username);
      setIsSendingRequest(false);
      if (success) {
        toast.success('Friend request sent!');
      } else {
        // Check cooldown again in case the error was about cooldown
        await checkCooldown();
      }
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
      <DialogContent
        className="sm:max-w-md p-0 overflow-hidden"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : profileUser ? (
          (() => {
            const light = isLightTheme(profileUser.profile_theme_primary, profileUser.profile_theme_accent, profileUser.banner_color);
            const fg = light ? "#0b0b0f" : "#f8fafc";
            const muted = light ? "rgba(11, 11, 15, 0.66)" : "rgba(248, 250, 252, 0.72)";
            const overlay = light ? "rgba(255, 255, 255, 0.46)" : "rgba(0, 0, 0, 0.34)";
            const divider = light ? "rgba(11, 11, 15, 0.18)" : "rgba(248, 250, 252, 0.18)";
            const bannerUrl = profileUser.banner_url;

            return (
              <div
                className="relative overflow-hidden"
                style={{
                  background:
                    profileUser.profile_theme_primary && profileUser.profile_theme_accent
                      ? `linear-gradient(180deg, ${profileUser.profile_theme_primary} 0%, ${profileUser.profile_theme_accent} 100%)`
                      : `linear-gradient(180deg, ${withAlpha(profileUser.banner_color, '33')} 0%, ${withAlpha(
                          profileUser.banner_color,
                          '14',
                        )} 100%)`,
                }}
              >
                {/* Soft overlay so text stays readable */}
                <div className="absolute inset-0" style={{ backgroundColor: overlay }} />

                {/* Profile Content */}
                <div
                  className="relative px-6 py-6"
                  style={
                    {
                      color: fg,
                      ["--profile-muted" as any]: muted,
                    } as React.CSSProperties
                  }
                >
                  {/* Banner image */}
                  {bannerUrl && (
                    <div className="-mx-6 -mt-6 mb-5 h-28 relative overflow-hidden">
                      <img src={bannerUrl} alt="Profile banner" className="absolute inset-0 w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-b from-black/0 to-black/35" />
                    </div>
                  )}

              {/* Avatar with subtle status */}
                  <div className={cn("mb-4", bannerUrl && "-mt-12")}>
                <div className="relative inline-block">
                  <AvatarWithDecoration 
                    user={profileUser} 
                    className="w-24 h-24 shadow-lg"
                    active={true}
                  />
                  <div className={cn(
                    "absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-background shadow-sm z-10",
                    statusColors[profileUser.status]
                  )} />
                </div>
              </div>

              {/* Names and Status */}
              <div className="mb-6 space-y-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-semibold tracking-tight">
                    {profileUser.display_name || profileUser.username}
                  </h2>
                </div>
                <p className="text-sm font-medium text-[color:var(--profile-muted)]">@{profileUser.username}</p>

                {/* Custom Status */}
                {profileUser.custom_status && (
                  <p className="text-sm mt-2 italic text-[color:var(--profile-muted)]">
                    {profileUser.custom_status}
                  </p>
                )}
              </div>

              {/* Divider */}
              <div className="h-px mb-6" style={{ backgroundColor: divider }} />

              {/* Bio */}
              {profileUser.bio && (
                <div className="mb-6">
                  <p className="text-sm leading-relaxed opacity-90">{profileUser.bio}</p>
                </div>
              )}

              {/* Info Grid */}
              <div className="space-y-4 mb-6">
                {/* Member Since */}
                <div className="flex items-start gap-3">
                  <div className="text-xs font-medium text-[color:var(--profile-muted)] uppercase tracking-wider min-w-[100px] pt-0.5">
                    Member Since
                  </div>
                  <div className="text-sm">
                    {profileUser.created_at
                      ? format(new Date(profileUser.created_at), 'MMMM d, yyyy')
                      : 'Unknown'
                    }
                  </div>
                </div>

                {/* Server Roles */}
                {currentServer && userId && userRoles.length > 0 && (
                  <div className="flex items-start gap-3">
                    <div className="text-xs font-medium text-[color:var(--profile-muted)] uppercase tracking-wider min-w-[100px] pt-0.5">
                      Roles
                    </div>
                    <div className="flex flex-wrap gap-1.5 flex-1">
                      {userRoles.map((role) => {
                        const isGradient = role.color.startsWith('linear-gradient');
                        return (
                          <span
                            key={role.id}
                            className="text-xs font-medium px-2 py-0.5 rounded-md"
                            style={
                              isGradient
                                ? { background: role.color, color: '#fff' }
                                : { backgroundColor: `${role.color}15`, color: role.color }
                            }
                          >
                            {role.name}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Shared Servers */}
                {sharedServers.length > 0 && (
                  <div className="flex items-start gap-3">
                    <div className="text-xs font-medium text-[color:var(--profile-muted)] uppercase tracking-wider min-w-[100px] pt-0.5">
                      Servers
                    </div>
                    <div className="flex gap-2 flex-1">
                      {sharedServers.map(server => (
                        <div
                          key={server.id}
                          className="w-8 h-8 rounded-lg bg-secondary/50 flex items-center justify-center text-xs font-medium overflow-hidden"
                          title={server.name}
                        >
                          {server.icon_url ? (
                            <img src={server.icon_url} alt={server.name} className="w-full h-full object-cover" />
                          ) : (
                            server.name.slice(0, 2).toUpperCase()
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              {!isSelf && (
                <div className="flex gap-2 pt-4 border-t" style={{ borderColor: divider }}>
                  <Button onClick={handleMessage} className="flex-1" variant="default">
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Message
                  </Button>
                  {hasPendingRequest ? (
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
                      variant={isFriend ? 'destructive' : isInCooldown ? 'secondary' : 'outline'}
                      onClick={handleFriendAction}
                      disabled={hasSentRequest || isInCooldown || isSendingRequest}
                      className={cn(
                        "flex-1",
                        isInCooldown && "opacity-80"
                      )}
                    >
                      {isSendingRequest ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Sending...
                        </>
                      ) : isFriend ? (
                        <>
                          <UserMinus className="w-4 h-4 mr-2" />
                          Remove
                        </>
                      ) : hasSentRequest ? (
                        'Request Sent'
                      ) : isInCooldown ? (
                        <>
                          <Clock className="w-4 h-4 mr-2" />
                          Retry in {formatCooldown(cooldownSeconds)}
                        </>
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
              </div>
            );
          })()
        ) : null}
      </DialogContent>
    </Dialog>
  );
};