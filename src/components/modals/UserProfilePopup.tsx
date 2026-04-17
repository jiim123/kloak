import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { format } from "date-fns";
import {
  Ban,
  Calendar,
  Check,
  Clock,
  Loader2,
  MessageCircle,
  Plus,
  UserMinus,
  UserPlus,
  X,
} from "lucide-react";
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
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getProfileEffectSrc } from "@/lib/profileEffects";
import { getEffectivePresence } from "@/lib/presence";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Badge } from "@/types/badge";
import type { User, UserStatus } from "@/types";
import type { UserProfileAnchorRect } from "@/lib/userProfilePopover";

type UserProfileAnchorSide = "left" | "right";
type UserProfileAnchorAlign = "auto" | "center";

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
const DESKTOP_CARD_WIDTH = 320;
const VIEWPORT_MARGIN = 12;

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

const getReadableRoleTextColor = (color: string) => {
  const pick = (lum: number | null) => (lum !== null && lum > 0.62 ? "#0b0b0f" : "#f8fafc");
  if (color.startsWith("linear-gradient")) {
    const hexes = color.match(/#[0-9a-fA-F]{6}/g) || [];
    if (hexes.length === 0) return "#f8fafc";
    const lums = hexes.map((hex) => relLuminance(hex)).filter((v): v is number => v !== null);
    if (lums.length === 0) return "#f8fafc";
    const avg = lums.reduce((a, b) => a + b, 0) / lums.length;
    return pick(avg);
  }
  return pick(relLuminance(color));
};

const withRoleBackgroundOpacity = (color: string, alpha = 0.34) => {
  const toRgba = (hex: string) => {
    const clean = hex.replace("#", "");
    if (clean.length !== 6) return hex;
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  if (color.startsWith("linear-gradient")) {
    return color.replace(/#[0-9a-fA-F]{6}/g, (hex) => toRgba(hex));
  }

  if (/^#[0-9a-fA-F]{6}$/.test(color)) {
    return toRgba(color);
  }

  return color;
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
  return lums.reduce((a, b) => a + b, 0) / lums.length > 0.62;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const getAnchoredPosition = (
  anchorRect: UserProfileAnchorRect | undefined,
  cardHeight: number,
  anchorSide: UserProfileAnchorSide = "right",
  anchorAlign: UserProfileAnchorAlign = "auto",
  anchorOffset = 10,
) => {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const fallbackLeft = viewportWidth / 2 - DESKTOP_CARD_WIDTH / 2;
  const fallbackTop = viewportHeight / 2 - cardHeight / 2;

  if (!anchorRect) {
    return {
      left: clamp(fallbackLeft, VIEWPORT_MARGIN, viewportWidth - DESKTOP_CARD_WIDTH - VIEWPORT_MARGIN),
      top: clamp(fallbackTop, VIEWPORT_MARGIN, viewportHeight - cardHeight - VIEWPORT_MARGIN),
    };
  }

  const top =
    anchorAlign === "center"
      ? clamp(
          anchorRect.top + anchorRect.height / 2 - cardHeight / 2,
          VIEWPORT_MARGIN,
          viewportHeight - cardHeight - VIEWPORT_MARGIN,
        )
      : (() => {
          const preferredBelow = anchorRect.bottom + 10;
          const preferredAbove = anchorRect.top - cardHeight - 10;
          const fitsBelow = preferredBelow + cardHeight <= viewportHeight - VIEWPORT_MARGIN;
          const fitsAbove = preferredAbove >= VIEWPORT_MARGIN;

          return fitsBelow
            ? preferredBelow
            : fitsAbove
              ? preferredAbove
              : clamp(preferredBelow, VIEWPORT_MARGIN, viewportHeight - cardHeight - VIEWPORT_MARGIN);
        })();

  const fitsToLeft = anchorRect.left - anchorOffset - DESKTOP_CARD_WIDTH >= VIEWPORT_MARGIN;
  const fitsToRight = anchorRect.right + anchorOffset + DESKTOP_CARD_WIDTH <= viewportWidth - VIEWPORT_MARGIN;
  const leftOfAnchor = anchorRect.left - DESKTOP_CARD_WIDTH - anchorOffset;
  const rightOfAnchor = anchorRect.right + anchorOffset;
  const alignedLeft = anchorRect.left;
  const rightAligned = anchorRect.right - DESKTOP_CARD_WIDTH;

  let left: number;
  if (anchorSide === "left") {
    left = fitsToLeft
      ? leftOfAnchor
      : fitsToRight
        ? rightOfAnchor
        : clamp(rightAligned, VIEWPORT_MARGIN, viewportWidth - DESKTOP_CARD_WIDTH - VIEWPORT_MARGIN);
  } else {
    left = fitsToRight
      ? rightOfAnchor
      : fitsToLeft
        ? leftOfAnchor
        : clamp(alignedLeft, VIEWPORT_MARGIN, viewportWidth - DESKTOP_CARD_WIDTH - VIEWPORT_MARGIN);
  }

  return { left, top };
};

export const UserProfilePopup = () => {
  const { activeModal, modalData, closeModal, openModal } = useUIStore();
  const { user: currentUser } = useAuthStore();
  const navigate = useNavigate();
  const { servers, setCurrentServer, currentServer, members, roles, fetchRoles, assignSelfRole, removeSelfRole } = useServerStore();
  const isMobile = useIsMobile();

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
  } = useFriendStore();
  const { openConversation, setCurrentConversation } = useDMStore();

  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [userBadges, setUserBadges] = useState<Badge[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sharedServers, setSharedServers] = useState<typeof servers>([]);
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);
  const [isSendingRequest, setIsSendingRequest] = useState(false);
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);
  const [selfRolePickerOpen, setSelfRolePickerOpen] = useState(false);
  const [selfRoleQuery, setSelfRoleQuery] = useState("");
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const [isBioExpanded, setIsBioExpanded] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const profileEffectImgRef = useRef<HTMLImageElement | null>(null);
  const profileEffectAnimationEndedRef = useRef(false);
  const [profileEffectStillFrame, setProfileEffectStillFrame] = useState<string | null>(null);

  const isOpen = activeModal === "userProfile";
  const userId = modalData?.userId as string | undefined;
  const anchorRect = modalData?.anchorRect as UserProfileAnchorRect | undefined;
  const anchorSide = (modalData?.anchorSide as UserProfileAnchorSide | undefined) ?? "right";
  const anchorAlign = (modalData?.anchorAlign as UserProfileAnchorAlign | undefined) ?? "auto";
  const anchorOffset = typeof modalData?.anchorOffset === "number" ? modalData.anchorOffset : 10;

  const applyCooldownFromDeclinedAt = useCallback((declinedAtRaw: string | null | undefined) => {
    if (!declinedAtRaw) {
      setCooldownSeconds(0);
      return;
    }

    const declinedAt = new Date(declinedAtRaw);
    const cooldownEnd = new Date(declinedAt.getTime() + COOLDOWN_MINUTES * 60 * 1000);
    const remainingMs = cooldownEnd.getTime() - Date.now();
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

  const handleClose = useCallback(() => {
    setProfileUser(null);
    setUserBadges([]);
    setSharedServers([]);
    setPosition(null);
    closeModal();
  }, [closeModal]);

  useEffect(() => {
    if (!isOpen) return;
    profileEffectAnimationEndedRef.current = false;
    setProfileEffectStillFrame(null);
    setIsBioExpanded(false);
  }, [isOpen, userId]);

  useEffect(() => {
    if (!profileUser?.profile_effect || !isOpen) return;

    const effectSrc = getProfileEffectSrc(profileUser.profile_effect);
    if (!effectSrc || profileEffectStillFrame) return;
    let captureTimeout: number | null = null;
    let cancelled = false;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = effectSrc;

    const captureStillFrame = () => {
      if (cancelled) return;
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || 800;
        canvas.height = img.naturalHeight || 600;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setProfileEffectStillFrame(canvas.toDataURL("image/png"));
        profileEffectAnimationEndedRef.current = true;
      } catch (error) {
        console.error("Failed to capture still frame:", error);
      }
    };

    img.onload = () => {
      captureTimeout = window.setTimeout(captureStillFrame, 3000);
    };

    return () => {
      cancelled = true;
      img.onload = null;
      if (captureTimeout !== null) window.clearTimeout(captureTimeout);
    };
  }, [isOpen, profileEffectStillFrame, profileUser?.profile_effect]);

  useEffect(() => {
    if (!isOpen || !userId || !currentUser?.id) return;

    const fetchProfile = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase.rpc("profile", {
          _target_user_id: userId,
          _requesting_user_id: currentUser.id,
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
          pronouns: d.pronouns ?? null,
          is_bot: d.is_bot ?? false,
        });

        setUserBadges((Array.isArray(payload.badges) ? payload.badges : []) as Badge[]);
        const sharedServerIds = new Set((Array.isArray(payload.shared_server_ids) ? payload.shared_server_ids : []) as string[]);
        setSharedServers(servers.filter((s) => sharedServerIds.has(s.id)).slice(0, 3));
        applyCooldownFromDeclinedAt(payload.declined_at ?? null);
      } catch (error) {
        console.error("Failed to fetch profile:", error);
        toast.error("Failed to load profile");
        setProfileUser(null);
        setUserBadges([]);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchProfile();
  }, [applyCooldownFromDeclinedAt, currentUser?.id, isOpen, serverIds, servers, userId]);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const interval = window.setInterval(() => {
      setCooldownSeconds((prev) => Math.max(prev - 1, 0));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [cooldownSeconds]);

  useEffect(() => {
    if (!isOpen || isMobile) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") handleClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMobile, isOpen]);

  useLayoutEffect(() => {
    if (!isOpen || isMobile || !cardRef.current) return;

    const updatePosition = () => {
      const rect = cardRef.current?.getBoundingClientRect();
      const height = rect?.height ?? 480;
      setPosition(getAnchoredPosition(anchorRect, height, anchorSide, anchorAlign, anchorOffset));
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    return () => window.removeEventListener("resize", updatePosition);
  }, [anchorAlign, anchorOffset, anchorRect, anchorSide, isLoading, isMobile, isOpen, profileUser, sharedServers.length]);

  const isSelf = currentUser?.id === userId;
  const isFriend = friends.some((f) => f.id === userId);
  const hasPendingRequest = pendingRequests.some((f) => f.id === userId);
  const hasSentRequest = outgoingRequests.some((f) => f.id === userId);
  const isBlocked = blockedUsers.some((b) => b.id === userId);
  const isInCooldown = cooldownSeconds > 0;

  const formatCooldown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const authorStyles = useAuthorStyles(currentServer?.id, userId ? [userId] : []);
  const userRoles = useMemo(() => {
    if (!currentServer || !userId) return [];
    const memberRoles = members.find((m) => m.user_id === userId && m.server_id === currentServer.id)?.roles;
    if (memberRoles && memberRoles.length > 0) return memberRoles;
    return authorStyles[userId]?.roles || [];
  }, [authorStyles, currentServer, members, userId]);
  const selfMember = useMemo(() => {
    if (!isSelf || !currentServer || !currentUser?.id) return null;
    return members.find((m) => m.server_id === currentServer.id && m.user_id === currentUser.id) ?? null;
  }, [isSelf, currentServer, currentUser?.id, members]);
  const selfAssignableRoles = useMemo(
    () => roles.filter((role) => role.name !== "@everyone" && Boolean(role.is_self_assignable)).sort((a, b) => a.position - b.position),
    [roles],
  );
  const filteredSelfAssignableRoles = useMemo(() => {
    const q = selfRoleQuery.trim().toLowerCase();
    if (!q) return selfAssignableRoles;
    return selfAssignableRoles.filter((role) => role.name.toLowerCase().includes(q));
  }, [selfAssignableRoles, selfRoleQuery]);
  const selfAssignedRoleIds = useMemo(() => new Set((selfMember?.roles || []).map((role) => role.id)), [selfMember?.roles]);

  useEffect(() => {
    if (!isOpen || !isSelf || !currentServer?.id) return;
    void fetchRoles(currentServer.id);
  }, [isOpen, isSelf, currentServer?.id, fetchRoles]);

  const handleSelfRoleToggle = useCallback(
    async (roleId: string) => {
      if (!currentServer?.id || !currentUser?.id) return;
      setUpdatingRoleId(roleId);
      try {
        if (selfAssignedRoleIds.has(roleId)) {
          await removeSelfRole(currentServer.id, roleId, currentUser.id);
        } else {
          await assignSelfRole(currentServer.id, roleId, currentUser.id);
        }
      } catch (error: any) {
        toast.error(error?.message || "Failed to update role");
      } finally {
        setUpdatingRoleId(null);
      }
    },
    [assignSelfRole, currentServer?.id, currentUser?.id, removeSelfRole, selfAssignedRoleIds],
  );

  const handleMessage = async () => {
    if (!currentUser || !profileUser) return;
    try {
      const conversation = await openConversation(currentUser.id, profileUser.id);
      if (!conversation) {
        toast.error("You can't message this user");
        return;
      }

      navigate(`/app?conversation=${conversation.id}`, { replace: true });
      setCurrentServer(null);
      setCurrentConversation(conversation);
      handleClose();
    } catch {
      toast.error("Failed to open conversation");
    }
  };

  const handleFriendAction = async () => {
    if (!currentUser || !profileUser) return;

    if (isFriend) {
      const friendship = friends.find((f) => f.id === profileUser.id);
      if (!friendship) return;
      await removeFriend(friendship.friendship_id, currentUser.id);
      toast.success("Friend removed");
      return;
    }

    if (!hasPendingRequest && !hasSentRequest && !isInCooldown) {
      setIsSendingRequest(true);
      const success = await sendRequest(currentUser.id, profileUser.username);
      setIsSendingRequest(false);
      if (success) {
        toast.success("Friend request sent");
      } else {
        await refreshCooldown();
      }
    }
  };

  const handleAcceptRequest = async () => {
    if (!currentUser) return;
    const pendingFriend = pendingRequests.find((f) => f.id === userId);
    if (!pendingFriend) return;
    await acceptRequest(pendingFriend.friendship_id, currentUser.id);
    toast.success("Friend request accepted");
  };

  const handleDeclineRequest = async () => {
    if (!currentUser) return;
    const pendingFriend = pendingRequests.find((f) => f.id === userId);
    if (!pendingFriend) return;
    await declineRequest(pendingFriend.friendship_id, currentUser.id);
    toast.success("Friend request declined");
  };

  const handleBlockUser = async () => {
    if (!currentUser || !profileUser) return;
    try {
      await blockUser(currentUser.id, profileUser.id);
      toast.success(`Blocked ${profileUser.display_name || profileUser.username}`);
    } catch {
      toast.error("Failed to block user");
    }
  };

  const handleUnblockUser = async () => {
    if (!currentUser || !profileUser) return;
    try {
      await unblockUser(currentUser.id, profileUser.id);
      toast.success(`Unblocked ${profileUser.display_name || profileUser.username}`);
    } catch {
      toast.error("Failed to unblock user");
    }
  };

  const renderActionRow = (divider: string) => {
    if (isSelf || !profileUser) return null;

    const iconButtonClass =
      "h-9 flex-1 rounded-lg border border-border bg-secondary px-2 text-foreground hover:bg-secondary-hover hover:text-foreground disabled:border-border/50 disabled:bg-muted disabled:text-muted-foreground/35";
    const dmButtonClass =
      "h-9 flex-1 rounded-lg border border-border bg-secondary px-2 text-foreground shadow-none hover:bg-secondary-hover hover:text-foreground hover:shadow-none";

    return (
      <div className="relative z-10 border-t px-3 py-2.5" style={{ borderColor: divider }}>
        {!isBlocked ? (
          <div className="flex items-center gap-1.5">
            <Button onClick={handleMessage} className={dmButtonClass}>
              <MessageCircle className="mr-1.5 h-3.5 w-3.5" />
              Message
            </Button>

            {hasPendingRequest ? (
              <>
                <Button variant="secondary" className={iconButtonClass} onClick={handleAcceptRequest}>
                  <Check className="h-3.5 w-3.5" />
                  Accept
                </Button>
                <Button variant="secondary" className={iconButtonClass} onClick={handleDeclineRequest}>
                  <X className="h-3.5 w-3.5" />
                  Decline
                </Button>
              </>
            ) : (
              <Button
                variant="secondary"
                className={iconButtonClass}
                onClick={handleFriendAction}
                disabled={hasSentRequest || isInCooldown || isSendingRequest}
                title={
                  hasSentRequest
                    ? "Friend request sent"
                    : isInCooldown
                      ? `Retry in ${formatCooldown(cooldownSeconds)}`
                      : isFriend
                        ? "Remove friend"
                        : "Add friend"
                }
              >
                {isSendingRequest ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Sending
                  </>
                ) : isFriend ? (
                  <>
                    <UserMinus className="h-3.5 w-3.5" />
                    Remove
                  </>
                ) : isInCooldown ? (
                  <>
                    <Clock className="h-3.5 w-3.5" />
                    Wait
                  </>
                ) : (
                  <>
                    <UserPlus className="h-3.5 w-3.5" />
                    Add
                  </>
                )}
              </Button>
            )}

            <Button variant="secondary" size="icon" className="h-9 w-9 rounded-lg border border-border bg-secondary text-foreground hover:bg-secondary-hover hover:text-foreground" onClick={handleBlockUser} title="Block user">
              <Ban className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <Button
            variant="secondary"
            className="h-9 w-full rounded-lg border border-border bg-secondary text-foreground hover:bg-secondary-hover"
            onClick={handleUnblockUser}
          >
            <Ban className="mr-1.5 h-3.5 w-3.5" />
            Unblock
          </Button>
        )}

      </div>
    );
  };

  const renderCard = () => {
    if (isLoading) {
      return (
        <div className="flex h-64 items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-white/75">
            <Loader2 className="h-7 w-7 animate-spin" />
            <p className="text-sm">Loading profile...</p>
          </div>
        </div>
      );
    }

    if (!profileUser) return null;

    const light = isLightTheme(
      profileUser.profile_theme_primary,
      profileUser.profile_theme_accent,
      profileUser.banner_color,
    );
    const fg = light ? "#0b0b0f" : "#f8fafc";
    const muted = light ? "rgba(11, 11, 15, 0.64)" : "rgba(248, 250, 252, 0.7)";
    const divider = light ? "rgba(11, 11, 15, 0.12)" : "rgba(248, 250, 252, 0.12)";
    const surface = light ? "rgba(255,255,255,0.32)" : "rgba(17,18,21,0.72)";
    const overlay = light ? "rgba(255,255,255,0.42)" : "rgba(0,0,0,0.28)";
    const bannerUrl = profileUser.banner_url;
    const hasProfileDecoration = Boolean(profileUser.avatar_decoration);
    const presence = getEffectivePresence(profileUser.status || "offline", profileUser.last_seen, profileUser.id);
    const effectSrc = profileUser.profile_effect ? getProfileEffectSrc(profileUser.profile_effect) : null;
    const displayEffectSrc =
      profileEffectAnimationEndedRef.current && profileEffectStillFrame ? profileEffectStillFrame : effectSrc;
    const joinedAt = profileUser.created_at ? format(new Date(profileUser.created_at), "MMM d, yyyy") : "Unknown";
    const rolePreview = userRoles.slice(0, 3);
    const bioText = profileUser.bio?.trim();
    const shouldCollapseBio = Boolean(bioText && bioText.length > 50);
    const statusText = profileUser.custom_status?.trim();
    const selfStatusLabel = statusText || "Set a status";
    const themeStyle: CSSProperties = {
      color: fg,
      background:
        profileUser.profile_theme_primary && profileUser.profile_theme_accent
          ? `linear-gradient(180deg, ${profileUser.profile_theme_primary} 0%, ${profileUser.profile_theme_accent} 100%)`
          : `linear-gradient(180deg, ${withAlpha(profileUser.banner_color, "33")} 0%, ${withAlpha(profileUser.banner_color, "12")} 100%)`,
      ["--profile-muted" as string]: muted,
    };

    return (
      <div className="relative overflow-hidden rounded-[11px]" style={themeStyle}>
        <div className="pointer-events-none absolute inset-0" style={{ backgroundColor: overlay }} />

        {bannerUrl ? (
          <div className="relative h-16 overflow-hidden">
            <img src={bannerUrl} alt="Profile banner" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-black/10 to-black/50" />
          </div>
        ) : (
          <div className="h-14" />
        )}

        {displayEffectSrc && (
          <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
            <img
              ref={profileEffectImgRef}
              key={`effect-${profileUser.profile_effect}-${userId}-${profileEffectStillFrame ? "still" : "anim"}`}
              src={displayEffectSrc}
              alt=""
              className="h-full w-full object-cover object-top opacity-85"
            />
          </div>
        )}

        <div className="relative z-10 px-3 pb-0">
          <div className="-mt-3 flex items-end gap-3">
            <div className="relative shrink-0">
              <AvatarWithDecoration
                user={profileUser}
                className={hasProfileDecoration ? "h-[52px] w-[52px]" : "h-[58px] w-[58px]"}
                active
              />
              <div
                className={cn(
                  "absolute bottom-1 right-1 rounded-full border-[3px] border-background shadow-lg",
                  hasProfileDecoration ? "h-3.5 w-3.5" : "h-4 w-4",
                  statusColors[presence.status],
                )}
                title={statusLabels[presence.status]}
              />
            </div>
            <div className="min-w-0 flex-1 pt-5 pb-0.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-[19px] font-semibold leading-none">
                      {profileUser.display_name || profileUser.username}
                    </h2>
                    {profileUser.is_bot && <BotTag className="rounded-md px-1.5 py-0.5 text-[10px]" />}
                  </div>
                  <p className="mt-1 truncate text-[13px] font-medium text-[color:var(--profile-muted)]">
                    @{profileUser.username}
                  </p>
                  {isSelf && (
                    <button
                      type="button"
                      onClick={() => openModal("set-status")}
                      className={cn(
                        "mt-1 truncate text-left text-[13px] font-medium text-[color:var(--profile-muted)] transition-opacity hover:opacity-80",
                        !statusText && "font-semibold",
                      )}
                      title={selfStatusLabel}
                    >
                      {selfStatusLabel}
                    </button>
                  )}
                </div>
                {userBadges.length > 0 && (
                  <div className="shrink-0 self-start pt-0.5">
                    <UserBadges badges={userBadges} />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 pb-3">
            <div className="rounded-[11px] p-3" style={{ backgroundColor: surface, backdropFilter: "blur(14px)" }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap gap-1.5">
                    <span
                      className="inline-flex items-center rounded-full px-2 py-1 text-[11px] font-medium"
                      style={{ backgroundColor: divider }}
                    >
                      {statusLabels[presence.status]}
                    </span>
                    {profileUser.pronouns && (
                      <span
                        className="inline-flex items-center rounded-full px-2 py-1 text-[11px] font-medium"
                        style={{ backgroundColor: divider }}
                      >
                        {profileUser.pronouns}
                      </span>
                    )}
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium"
                      style={{ backgroundColor: divider }}
                    >
                      <Calendar className="h-3 w-3" />
                      {joinedAt}
                    </span>
                  </div>
                  {!isSelf && statusText && (
                    <p className="mt-2 truncate text-[13px] font-medium text-[color:var(--profile-muted)]">{statusText}</p>
                  )}
                </div>
              </div>

              {bioText && (
                <div className="mt-2">
                  <div className="relative">
                    <p
                      className="whitespace-pre-wrap break-words text-[13px] leading-5"
                      style={!isBioExpanded && shouldCollapseBio ? { maxHeight: "3.75rem", overflow: "hidden" } : undefined}
                    >
                      {bioText}
                    </p>
                    {!isBioExpanded && shouldCollapseBio && (
                      <div
                        className="pointer-events-none absolute inset-x-0 bottom-0 h-8"
                        style={{ background: `linear-gradient(180deg, rgba(255,255,255,0) 0%, ${surface} 100%)` }}
                      />
                    )}
                  </div>
                  {shouldCollapseBio && (
                    <button
                      type="button"
                      className="mt-1 text-[12px] font-medium transition-opacity hover:opacity-80"
                      style={{ color: fg }}
                      onClick={() => setIsBioExpanded((prev) => !prev)}
                    >
                      {isBioExpanded ? "See less" : "See more"}
                    </button>
                  )}
                </div>
              )}

              {(rolePreview.length > 0 || (isSelf && selfAssignableRoles.length > 0) || (!isSelf && sharedServers.length > 0)) && (
                <>
                  <div className="mt-3 h-px" style={{ backgroundColor: divider }} />
                  <div className="mt-3 space-y-2">
                    {(rolePreview.length > 0 || (isSelf && selfAssignableRoles.length > 0)) && (
                      <div className="flex flex-wrap gap-1.5">
                        {rolePreview.map((role) => {
                          const isGradient = role.color.startsWith("linear-gradient");
                          const background = withRoleBackgroundOpacity(role.color, 0.34);
                          return (
                            <span
                              key={role.id}
                              className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium"
                              style={
                                isGradient
                                  ? { background: background, color: fg }
                                  : { backgroundColor: background, color: fg }
                              }
                            >
                              <span
                                className="h-2 w-2 rounded-full"
                                style={isGradient ? { background: role.color } : { backgroundColor: role.color }}
                              />
                              {role.name}
                            </span>
                          );
                        })}
                        {userRoles.length > rolePreview.length && (
                          <span
                            className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium"
                            style={{ borderColor: divider, color: muted }}
                          >
                            +{userRoles.length - rolePreview.length}
                          </span>
                        )}
                        {isSelf && selfAssignableRoles.length > 0 && (
                          <Popover open={selfRolePickerOpen} onOpenChange={(next) => {
                            setSelfRolePickerOpen(next);
                            if (!next) setSelfRoleQuery("");
                          }}>
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-opacity hover:opacity-80"
                                style={{ backgroundColor: divider }}
                                title="Manage self-assignable roles"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent
                              align="start"
                              className="w-[260px] border-border bg-popover p-2 text-popover-foreground shadow-xl"
                            >
                              <Input
                                autoFocus
                                value={selfRoleQuery}
                                onChange={(e) => setSelfRoleQuery(e.target.value)}
                                placeholder="Search roles"
                                className="h-8 border-border bg-background text-xs text-foreground placeholder:text-muted-foreground"
                              />
                              <ScrollArea className="mt-2 max-h-44">
                                <div className="space-y-0.5">
                                  {filteredSelfAssignableRoles.map((role) => {
                                    const checked = selfAssignedRoleIds.has(role.id);
                                    const busy = updatingRoleId === role.id;
                                    const isGradient = role.color.startsWith("linear-gradient");
                                    return (
                                      <button
                                        key={role.id}
                                        type="button"
                                        disabled={busy}
                                        onClick={() => void handleSelfRoleToggle(role.id)}
                                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-secondary hover:text-foreground disabled:opacity-60"
                                      >
                                        <span
                                          className={cn("flex-1 truncate font-medium", isGradient && "text-transparent")}
                                          style={
                                            isGradient
                                              ? ({ background: role.color, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" } as CSSProperties)
                                              : ({ color: role.color } as CSSProperties)
                                          }
                                        >
                                          @{role.name}
                                        </span>
                                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> : checked ? <Check className="h-3.5 w-3.5 text-primary" /> : null}
                                      </button>
                                    );
                                  })}
                                  {filteredSelfAssignableRoles.length === 0 && (
                                    <div className="px-2 py-2 text-xs text-muted-foreground">No roles found</div>
                                  )}
                                </div>
                              </ScrollArea>
                            </PopoverContent>
                          </Popover>
                        )}
                      </div>
                    )}

                    {!isSelf && sharedServers.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {sharedServers.map((server) => (
                          <button
                            key={server.id}
                            type="button"
                            className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg text-[10px] font-semibold transition-transform hover:scale-105"
                            style={{ backgroundColor: divider }}
                            title={server.name}
                            onClick={() => {
                              setCurrentServer(server);
                              handleClose();
                            }}
                          >
                            {server.icon_url ? (
                              <img src={server.icon_url} alt={server.name} className="h-full w-full object-cover" />
                            ) : (
                              server.name.slice(0, 2).toUpperCase()
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {renderActionRow(divider)}
      </div>
    );
  };

  if (!isOpen) return null;

  if (isMobile) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent
          className="max-h-[85vh] w-[calc(100vw-2rem)] max-w-[360px] overflow-hidden border-none bg-transparent p-0 shadow-none"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <div className="max-h-[75vh] overflow-y-auto rounded-[11px] border border-border bg-popover shadow-2xl">
            {renderCard()}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <div className="fixed inset-0 z-50" onMouseDown={handleClose}>
      <div
        ref={cardRef}
        className="absolute max-h-[70vh] w-[320px] overflow-y-auto rounded-[11px] border border-border bg-popover shadow-[0_22px_80px_rgba(0,0,0,0.45)]"
        style={{
          left: position?.left ?? -9999,
          top: position?.top ?? -9999,
          opacity: position ? 1 : 0,
        }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {renderCard()}
      </div>
    </div>
  );
};
