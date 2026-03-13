import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { format } from "date-fns";
import { MessageCircle, UserPlus, UserMinus, Loader2, Check, X, Clock, Calendar, Ban } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AvatarWithDecoration } from "@/components/ui/avatar-with-decoration";
import { UserBadges } from "@/components/ui/user-badges";
import { BotTag } from "@/components/ui/bot-tag";
import { useUIStore } from "@/stores/uiStore";
import { useAuthStore } from "@/stores/authStore";
import { useServerStore } from "@/stores/serverStore";
import { useFriendStore } from "@/stores/friendStore";
import { useDMStore } from "@/stores/dmStore";
import { useAuthorStyles } from "@/hooks/useAuthorStyles";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getProfileEffectSrc } from "@/lib/profileEffects";
import { getEffectivePresence } from "@/lib/presence";
import type { User, UserStatus } from "@/types";
import type { Badge } from "@/types/badge";

const statusColors: Record<UserStatus, string> = {
  online: "bg-[hsl(var(--kloak-success))]",
  idle: "bg-[hsl(var(--kloak-warning))]",
  dnd: "bg-destructive",
  offline: "bg-muted-foreground/50",
};

const statusLabels: Record<UserStatus, string> = {
  online: "Online",
  idle: "Idle",
  dnd: "Do Not Disturb",
  offline: "Offline",
};

const COOLDOWN_MINUTES = 5;

const withAlpha = (hex: string, alphaHex: string) => {
  if (!hex || !hex.startsWith("#") || hex.length !== 7) return hex;
  return `${hex}${alphaHex}`;
};

const hexToRgb = (hex: string) => {
  const h = hex.trim().toLowerCase();
  if (!h.startsWith("#") || h.length !== 7) return null;
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
  const navigate = useNavigate();
  const { servers, setCurrentServer, currentServer, members } = useServerStore();

  // Stable server IDs — only changes when servers are added/removed, not on any property update
  const serverIds = useMemo(() => servers.map((s) => s.id), [servers]);
  const {
    friends,
    pendingRequests,
    outgoingRequests,
    blockedUsers,
    sendRequest,
    removeFriend,
    acceptRequest,
    declineRequest,
    blockUser,
    unblockUser,
    error: friendError,
  } = useFriendStore();
  const { openConversation, setCurrentConversation } = useDMStore();

  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [userBadges, setUserBadges] = useState<Badge[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sharedServers, setSharedServers] = useState<typeof servers>([]);
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);
  const [isSendingRequest, setIsSendingRequest] = useState(false);
  const profileEffectPlayedRef = useRef(false);
  const profileEffectImgRef = useRef<HTMLImageElement | null>(null);
  const [profileEffectStillFrame, setProfileEffectStillFrame] = useState<string | null>(null);
  const profileEffectAnimationEndedRef = useRef(false);

  const isOpen = activeModal === "userProfile";
  const userId = modalData?.userId as string | undefined;

  const applyCooldownFromDeclinedAt = useCallback((declinedAtRaw: string | null | undefined) => {
    if (!declinedAtRaw) {
      setCooldownSeconds(0);
      return;
    }

    const declinedAt = new Date(declinedAtRaw);
    const cooldownEnd = new Date(declinedAt.getTime() + COOLDOWN_MINUTES * 60 * 1000);
    const now = new Date();
    const remainingMs = cooldownEnd.getTime() - now.getTime();
    setCooldownSeconds(remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0);
  }, []);

  const refreshCooldown = useCallback(async () => {
    if (!currentUser?.id || !userId || currentUser.id === userId) return;
    try {
      const { data, error } = await supabase.rpc("profile", {
        _target_user_id: userId,
        _requesting_user_id: currentUser.id,
        _server_ids: [],
      });

      if (error) {
        console.error("Failed to refresh cooldown:", error);
        return;
      }

      applyCooldownFromDeclinedAt((data as any)?.declined_at ?? null);
    } catch (err) {
      console.error("Error refreshing cooldown:", err);
    }
  }, [applyCooldownFromDeclinedAt, currentUser?.id, userId]);

  // Reset profile effect play state when modal opens
  useEffect(() => {
    if (isOpen) {
      profileEffectPlayedRef.current = false;
      profileEffectAnimationEndedRef.current = false;
      setProfileEffectStillFrame(null);
    }
  }, [isOpen]);

  // Capture still frame after animation plays once to prevent looping
  useEffect(() => {
    if (!profileUser?.profile_effect || !isOpen) return;

    const effectSrc = getProfileEffectSrc(profileUser.profile_effect);
    if (!effectSrc) return;

    // If we already have a still frame, don't recapture
    if (profileEffectStillFrame) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = effectSrc;

    // Wait for image to load, then after animation duration, capture the last frame
    const captureStillFrame = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || 800;
        canvas.height = img.naturalHeight || 600;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/png");
        setProfileEffectStillFrame(dataUrl);
        profileEffectAnimationEndedRef.current = true;
      } catch (e) {
        console.error("Failed to capture still frame:", e);
      }
    };

    img.onload = () => {
      // Wait for animation to complete (heuristic: 3 seconds for most animations)
      // Then capture the last frame to prevent looping
      setTimeout(captureStillFrame, 3000);
    };

    return () => {
      img.onload = null;
    };
  }, [profileUser?.profile_effect, isOpen, profileEffectStillFrame]);

  // Fetch user profile
  useEffect(() => {
    if (!isOpen || !userId || !currentUser?.id) return;

    const fetchProfile = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase.rpc("profile", {
          _target_user_id: userId,
          _requesting_user_id: currentUser!.id,
          _server_ids: serverIds,
        });

        if (error) throw error;
        const payload = data as any;
        if (!payload?.user) throw new Error("Profile not found");

        const d = payload.user as any;
        setProfileUser({
          id: d.id,
          username: d.username,
          display_name: d.display_name,
          avatar_url: d.avatar_url,
          banner_url: d.banner_url ?? null,
          avatar_decoration: d.avatar_decoration,
          profile_effect: d.profile_effect ?? null,
          banner_color: d.banner_color || "#5865F2",
          profile_theme_primary: d.profile_theme_primary ?? null,
          profile_theme_accent: d.profile_theme_accent ?? null,
          bio: d.bio,
          status: d.status as UserStatus,
          custom_status: d.custom_status,
          created_at: d.created_at,
          last_seen: d.last_seen,
          is_bot: d.is_bot ?? false,
        });

        setUserBadges((Array.isArray(payload.badges) ? payload.badges : []) as Badge[]);
        const sharedServerIds = new Set((Array.isArray(payload.shared_server_ids) ? payload.shared_server_ids : []) as string[]);
        const shared = servers.filter((s) => sharedServerIds.has(s.id));
        setSharedServers(shared.slice(0, 3));
        applyCooldownFromDeclinedAt(payload.declined_at ?? null);
      } catch (error) {
        console.error("Failed to fetch profile:", error);
        toast.error("Failed to load profile");
        setUserBadges([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [isOpen, userId, serverIds, servers, applyCooldownFromDeclinedAt, currentUser?.id]);

  // Countdown timer effect
  useEffect(() => {
    if (cooldownSeconds <= 0) return;

    const interval = setInterval(() => {
      setCooldownSeconds((prev) => {
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
  const isFriend = friends.some((f) => f.id === userId);
  const hasPendingRequest = pendingRequests.some((f) => f.id === userId);
  const hasSentRequest = outgoingRequests.some((f) => f.id === userId);
  const isBlocked = blockedUsers.some((b) => b.id === userId);
  const isInCooldown = cooldownSeconds > 0;

  const formatCooldown = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const authorStyles = useAuthorStyles(currentServer?.id, userId ? [userId] : []);
  // Get user's roles in current server. Fallback to targeted author-style RPC for offline users.
  const userRoles = useMemo(() => {
    if (!currentServer || !userId) return [];
    const memberRoles = members.find((m) => m.user_id === userId && m.server_id === currentServer.id)?.roles;
    if (memberRoles && memberRoles.length > 0) return memberRoles;
    return authorStyles[userId]?.roles || [];
  }, [currentServer, userId, members, authorStyles]);

  const handleMessage = async () => {
    if (!currentUser || !profileUser) return;
    try {
      const conversation = await openConversation(currentUser.id, profileUser.id);
      if (conversation) {
        // Navigate using the app's built-in DM deep-link handler (avoids URL/store race with server routes)
        navigate(`/app?conversation=${conversation.id}`, { replace: true });
        setCurrentServer(null);
        setCurrentConversation(conversation);
        closeModal();
      } else {
        toast.error("You can't message this user");
      }
    } catch (error) {
      toast.error("Failed to open conversation");
    }
  };

  const handleFriendAction = async () => {
    if (!currentUser || !profileUser) return;

    if (isFriend) {
      const friendship = friends.find((f) => f.id === profileUser.id);
      if (friendship) {
        await removeFriend(friendship.friendship_id, currentUser.id);
        toast.success("Friend removed");
      }
    } else if (!hasPendingRequest && !hasSentRequest && !isInCooldown) {
      setIsSendingRequest(true);
      const success = await sendRequest(currentUser.id, profileUser.username);
      setIsSendingRequest(false);
      if (success) {
        toast.success("Friend request sent!");
      } else {
        await refreshCooldown();
      }
    }
  };

  const handleAcceptRequest = async () => {
    if (!currentUser) return;
    const pendingFriend = pendingRequests.find((f) => f.id === userId);
    if (pendingFriend) {
      await acceptRequest(pendingFriend.friendship_id, currentUser.id);
      toast.success("Friend request accepted!");
    }
  };

  const handleDeclineRequest = async () => {
    if (!currentUser) return;
    const pendingFriend = pendingRequests.find((f) => f.id === userId);
    if (pendingFriend) {
      await declineRequest(pendingFriend.friendship_id, currentUser.id);
      toast.success("Friend request declined");
    }
  };

  const handleBlockUser = async () => {
    if (!currentUser || !profileUser) return;
    try {
      await blockUser(currentUser.id, profileUser.id);
      toast.success(`Blocked ${profileUser.display_name || profileUser.username}`);
    } catch (error) {
      toast.error("Failed to block user");
    }
  };

  const handleUnblockUser = async () => {
    if (!currentUser || !profileUser) return;
    try {
      await unblockUser(currentUser.id, profileUser.id);
      toast.success(`Unblocked ${profileUser.display_name || profileUser.username}`);
    } catch (error) {
      toast.error("Failed to unblock user");
    }
  };

  const handleClose = () => {
    setProfileUser(null);
    setUserBadges([]);
    closeModal();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        className="sm:max-w-md max-w-[calc(100vw-2rem)] max-h-[90vh] overflow-hidden bg-background/95 backdrop-blur-xl border-none rounded-2xl p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading profile...</p>
            </div>
          </div>
        ) : profileUser ? (
          (() => {
            const light = isLightTheme(
              profileUser.profile_theme_primary,
              profileUser.profile_theme_accent,
              profileUser.banner_color,
            );
            const fg = light ? "#0b0b0f" : "#f8fafc";
            const muted = light ? "rgba(11, 11, 15, 0.66)" : "rgba(248, 250, 252, 0.72)";
            const overlay = light ? "rgba(255, 255, 255, 0.46)" : "rgba(0, 0, 0, 0.34)";
            const divider = light ? "rgba(11, 11, 15, 0.12)" : "rgba(248, 250, 252, 0.12)";
            const cardBg = light ? "rgba(255, 255, 255, 0.3)" : "rgba(0, 0, 0, 0.2)";
            const bannerUrl = profileUser.banner_url;
            const hasProfileDecoration = Boolean(profileUser.avatar_decoration);

            return (
              <div
                className="relative overflow-hidden rounded-2xl"
                style={{
                  background:
                    profileUser.profile_theme_primary && profileUser.profile_theme_accent
                      ? `linear-gradient(180deg, ${profileUser.profile_theme_primary} 0%, ${profileUser.profile_theme_accent} 100%)`
                      : `linear-gradient(180deg, ${withAlpha(profileUser.banner_color, "33")} 0%, ${withAlpha(
                          profileUser.banner_color,
                          "14",
                        )} 100%)`,
                }}
              >
                {/* Soft overlay */}
                <div className="absolute inset-0" style={{ backgroundColor: overlay }} />

                {/* Profile Content */}
                <div
                  className="relative p-4 sm:p-6"
                  style={
                    {
                      color: fg,
                      ["--profile-muted" as any]: muted,
                    } as React.CSSProperties
                  }
                >
                  {/* Banner image */}
                  {bannerUrl && (
                    <div
                      className="-mx-4 sm:-mx-6 -mt-4 sm:-mt-6 mb-4 h-24 sm:h-28 relative overflow-hidden"
                      style={{ zIndex: 0 }}
                    >
                      <img
                        src={bannerUrl}
                        alt="Profile banner"
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/10 to-black/40" />
                    </div>
                  )}

                  {/* Profile Effect - rendered once when modal opens, stops after first play, above banner but below content */}
                  {profileUser.profile_effect &&
                    getProfileEffectSrc(profileUser.profile_effect) &&
                    (() => {
                      const effectSrc = getProfileEffectSrc(profileUser.profile_effect);
                      // Use still frame if animation has ended, otherwise use animated version
                      const displaySrc =
                        profileEffectAnimationEndedRef.current && profileEffectStillFrame
                          ? profileEffectStillFrame
                          : effectSrc;
                      const effectKey = profileEffectPlayedRef.current
                        ? `played-${userId}`
                        : `effect-${profileUser.profile_effect}-${userId}`;

                      return (
                        <div
                          className="absolute -inset-4 sm:-inset-6 pointer-events-none overflow-hidden"
                          style={{ zIndex: 2 }}
                        >
                          <img
                            ref={profileEffectImgRef}
                            key={effectKey}
                            src={displaySrc!}
                            alt="Profile effect"
                            className="absolute top-0 left-0 w-full h-full object-cover object-top"
                            style={{
                              imageRendering: "auto",
                            }}
                            onLoad={() => {
                              if (!profileEffectPlayedRef.current) {
                                profileEffectPlayedRef.current = true;
                              }
                            }}
                            onError={() => {
                              profileEffectPlayedRef.current = true;
                            }}
                          />
                        </div>
                      );
                    })()}

                  {/* Avatar Section */}
                  <div
                    className={cn("flex items-end gap-4 mb-4 relative", bannerUrl && "-mt-14 sm:-mt-16 pt-2")}
                    style={{ zIndex: 10 }}
                  >
                    <div className="relative flex-shrink-0">
                      <AvatarWithDecoration
                        user={profileUser}
                        className={hasProfileDecoration ? "w-[72px] h-[72px] sm:w-[88px] sm:h-[88px]" : "w-20 h-20 sm:w-24 sm:h-24"}
                        active={true}
                      />
                      {/* Status indicator */}
                      {(() => {
                        const presence = getEffectivePresence(profileUser.status || "offline", profileUser.last_seen);
                        return (
                          <div
                            className={cn(
                              hasProfileDecoration
                                ? "absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 shadow-lg z-10 border-background"
                                : "absolute bottom-1 right-1 w-5 h-5 rounded-full border-[3px] shadow-lg z-10 border-background",
                              statusColors[presence.status],
                            )}
                            title={statusLabels[presence.status]}
                          />
                        );
                      })()}
                    </div>

                    {/* Name and username - shown next to avatar on larger screens */}
                    <div className="hidden sm:block flex-1 min-w-0 pb-1 pt-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-xl font-medium tracking-tight truncate">
                          {profileUser.display_name || profileUser.username}
                        </h2>
                        {profileUser.is_bot && (
                          <BotTag className="text-[11px] px-2 py-1 rounded-lg" />
                        )}
                        {userBadges.length > 0 && <UserBadges badges={userBadges} />}
                        {profileUser.pronouns && (
                          <span className="text-sm text-[color:var(--profile-muted)] font-normal">
                            • {profileUser.pronouns}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-[color:var(--profile-muted)] truncate">
                        @{profileUser.username}
                      </p>
                    </div>
                  </div>

                  {/* Name and username - shown below avatar on mobile */}
                  <div className="sm:hidden mb-4 relative" style={{ zIndex: 10 }}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-xl font-medium tracking-tight">
                        {profileUser.display_name || profileUser.username}
                      </h2>
                      {profileUser.is_bot && (
                        <BotTag className="text-[11px] px-2 py-1 rounded-lg" />
                      )}
                      {userBadges.length > 0 && <UserBadges badges={userBadges} />}
                      {profileUser.pronouns && (
                        <span className="text-sm text-[color:var(--profile-muted)] font-normal">
                          • {profileUser.pronouns}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-[color:var(--profile-muted)]">@{profileUser.username}</p>
                  </div>

                  {/* Custom Status */}
                  {profileUser.custom_status && (
                    <div
                      className="mb-4 px-3 py-2 rounded-xl text-sm relative"
                      style={{ backgroundColor: cardBg, backdropFilter: "blur(8px)", zIndex: 10 }}
                    >
                      <p className="italic text-[color:var(--profile-muted)]">"{profileUser.custom_status}"</p>
                    </div>
                  )}

                  {/* Bio */}
                  {profileUser.bio && (
                    <div className="mb-4 relative" style={{ zIndex: 10 }}>
                      <p className="text-sm leading-relaxed opacity-90">{profileUser.bio}</p>
                    </div>
                  )}

                  {/* Info Cards */}
                  <div
                    className="rounded-xl p-3 sm:p-4 space-y-3 mb-4 relative"
                    style={{ backgroundColor: cardBg, backdropFilter: "blur(8px)", zIndex: 10 }}
                  >
                    {/* Member Since */}
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: divider }}
                      >
                        <Calendar className="w-4 h-4" style={{ color: muted }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-[color:var(--profile-muted)] uppercase tracking-wider">
                          Member Since
                        </p>
                        <p className="text-sm font-medium truncate">
                          {profileUser.created_at
                            ? format(new Date(profileUser.created_at), "MMMM d, yyyy")
                            : "Unknown"}
                        </p>
                      </div>
                    </div>

                    {/* Server Roles */}
                    {currentServer && userId && userRoles.length > 0 && (
                      <>
                        <div className="h-px" style={{ backgroundColor: divider }} />
                        <div>
                          <p className="text-xs font-medium text-[color:var(--profile-muted)] uppercase tracking-wider mb-2">
                            Roles in {currentServer.name}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {userRoles.map((role) => {
                              const isGradient = role.color.startsWith("linear-gradient");
                              return (
                                <span
                                  key={role.id}
                                  className="text-xs font-medium px-2.5 py-1 rounded-lg"
                                  style={
                                    isGradient
                                      ? { background: role.color, color: "#fff" }
                                      : { backgroundColor: `${role.color}20`, color: role.color }
                                  }
                                >
                                  {role.name}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      </>
                    )}

                    {/* Shared Servers */}
                    {sharedServers.length > 0 && (
                      <>
                        <div className="h-px" style={{ backgroundColor: divider }} />
                        <div>
                          <p className="text-xs font-medium text-[color:var(--profile-muted)] uppercase tracking-wider mb-2">
                            Shared Servers
                          </p>
                          <div className="flex gap-2">
                            {sharedServers.map((server) => (
                              <div
                                key={server.id}
                                className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-medium overflow-hidden transition-transform hover:scale-105"
                                style={{ backgroundColor: divider }}
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
                      </>
                    )}
                  </div>

                  {/* Action Buttons */}
                  {!isSelf && (
                    <div className="flex flex-col gap-2 pt-4 border-t relative z-10" style={{ borderColor: divider }}>
                      {/* All buttons inline */}
                      {!isBlocked && (
                        <div className="flex gap-2">
                          <Button
                            onClick={handleMessage}
                            className="font-normal flex-1 rounded-xl h-8 text-xs px-3 border-transparent hover:border-transparent"
                            variant="outline"
                            style={{ backgroundColor: "#232629", color: "#fff" }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#2a2f33")}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#232629")}
                          >
                            <MessageCircle className="w-3.5 h-3.5 mr-1.5" />
                            Message
                          </Button>

                          {hasPendingRequest ? (
                            <>
                              <Button
                                variant="outline"
                                onClick={handleAcceptRequest}
                                className="font-normal flex-1 rounded-xl h-8 text-xs px-3 border-transparent hover:border-transparent"
                                style={{ backgroundColor: "#232629", color: "#fff" }}
                                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#2a2f33")}
                                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#232629")}
                              >
                                <Check className="w-3.5 h-3.5 mr-1.5" />
                                Accept
                              </Button>
                              <Button
                                variant="outline"
                                onClick={handleDeclineRequest}
                                className="font-normal flex-1 rounded-xl h-8 text-xs px-3 border-transparent hover:border-transparent"
                                style={{ backgroundColor: "#232629", color: "#fff" }}
                                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#2a2f33")}
                                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#232629")}
                              >
                                <X className="w-3.5 h-3.5 mr-1.5" />
                                Decline
                              </Button>
                            </>
                          ) : (
                            <Button
                              variant="outline"
                              onClick={handleFriendAction}
                              disabled={hasSentRequest || isInCooldown || isSendingRequest}
                              className={cn(
                                "font-normal flex-1 rounded-xl h-8 text-xs px-3 border-transparent hover:border-transparent",
                                isInCooldown && "opacity-80",
                              )}
                              style={{ backgroundColor: "#232629", color: "#fff" }}
                              onMouseEnter={(e) =>
                                !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = "#2a2f33")
                              }
                              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#232629")}
                            >
                              {isSendingRequest ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                  Sending...
                                </>
                              ) : isFriend ? (
                                <>
                                  <UserMinus className="w-3.5 h-3.5 mr-1.5" />
                                  Remove
                                </>
                              ) : hasSentRequest ? (
                                "Request Sent"
                              ) : isInCooldown ? (
                                <>
                                  <Clock className="w-3.5 h-3.5 mr-1.5" />
                                  Retry {formatCooldown(cooldownSeconds)}
                                </>
                              ) : (
                                <>
                                  <UserPlus className="w-3.5 h-3.5 mr-1.5" />
                                  Add Friend
                                </>
                              )}
                            </Button>
                          )}

                          {/* Block button */}
                          <Button
                            variant="outline"
                            onClick={handleBlockUser}
                            className="font-normal flex-1 rounded-xl h-8 text-xs px-3 border-transparent hover:border-transparent"
                            style={{ backgroundColor: "#232629", color: "#fff" }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#2a2f33")}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#232629")}
                          >
                            <Ban className="w-3.5 h-3.5 mr-1.5" />
                            Block
                          </Button>
                        </div>
                      )}

                      {/* Unblock button (when blocked) */}
                      {isBlocked && (
                        <Button
                          variant="outline"
                          onClick={handleUnblockUser}
                          className="font-normal rounded-xl h-8 text-xs px-3 border-transparent hover:border-transparent"
                          style={{ backgroundColor: "#232629", color: "#fff" }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#2a2f33")}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#232629")}
                        >
                          <Ban className="w-3.5 h-3.5 mr-1.5" />
                          Unblock User
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
