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

/* ─── Constants ─── */

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
const DESKTOP_CARD_WIDTH = 360;
const VIEWPORT_MARGIN = 12;

/* ─── Color helpers (profile-theme support) ─── */

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

const withRoleBackgroundOpacity = (color: string, alpha = 0.34) => {
  const toRgba = (hex: string) => {
    const clean = hex.replace("#", "");
    if (clean.length !== 6) return hex;
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };
  if (color.startsWith("linear-gradient")) return color.replace(/#[0-9a-fA-F]{6}/g, (hex) => toRgba(hex));
  if (/^#[0-9a-fA-F]{6}$/.test(color)) return toRgba(color);
  return color;
};

const isLightTheme = (primary?: string | null, accent?: string | null, fallback?: string | null) => {
  const lums: number[] = [];
  [primary, accent, ...(lums.length === 0 ? [fallback] : [])].forEach((c) => {
    if (c) {
      const l = relLuminance(c);
      if (l !== null) lums.push(l);
    }
  });
  if (lums.length === 0) return false;
  return lums.reduce((a, b) => a + b, 0) / lums.length > 0.62;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/* ─── Positioning ─── */

const getAnchoredPosition = (
  anchorRect: UserProfileAnchorRect | undefined,
  cardHeight: number,
  anchorSide: UserProfileAnchorSide = "right",
  anchorAlign: UserProfileAnchorAlign = "auto",
  anchorOffset = 10,
) => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const fallbackLeft = vw / 2 - DESKTOP_CARD_WIDTH / 2;
  const fallbackTop = vh / 2 - cardHeight / 2;

  if (!anchorRect) {
    return {
      left: clamp(fallbackLeft, VIEWPORT_MARGIN, vw - DESKTOP_CARD_WIDTH - VIEWPORT_MARGIN),
      top: clamp(fallbackTop, VIEWPORT_MARGIN, vh - cardHeight - VIEWPORT_MARGIN),
    };
  }

  const top =
    anchorAlign === "center"
      ? clamp(anchorRect.top + anchorRect.height / 2 - cardHeight / 2, VIEWPORT_MARGIN, vh - cardHeight - VIEWPORT_MARGIN)
      : (() => {
          const below = anchorRect.bottom + 10;
          const above = anchorRect.top - cardHeight - 10;
          const fitsBelow = below + cardHeight <= vh - VIEWPORT_MARGIN;
          const fitsAbove = above >= VIEWPORT_MARGIN;
          return fitsBelow ? below : fitsAbove ? above : clamp(below, VIEWPORT_MARGIN, vh - cardHeight - VIEWPORT_MARGIN);
        })();

  const leftOfAnchor = anchorRect.left - DESKTOP_CARD_WIDTH - anchorOffset;
  const rightOfAnchor = anchorRect.right + anchorOffset;
  const fitsLeft = leftOfAnchor >= VIEWPORT_MARGIN;
  const fitsRight = rightOfAnchor + DESKTOP_CARD_WIDTH <= vw - VIEWPORT_MARGIN;

  let left: number;
  if (anchorSide === "left") {
    left = fitsLeft ? leftOfAnchor : fitsRight ? rightOfAnchor : clamp(anchorRect.right - DESKTOP_CARD_WIDTH, VIEWPORT_MARGIN, vw - DESKTOP_CARD_WIDTH - VIEWPORT_MARGIN);
  } else {
    left = fitsRight ? rightOfAnchor : fitsLeft ? leftOfAnchor : clamp(anchorRect.left, VIEWPORT_MARGIN, vw - DESKTOP_CARD_WIDTH - VIEWPORT_MARGIN);
  }

  return { left, top };
};

/* ─── Component ─── */

export const UserProfilePopup = () => {
  const { activeModal, modalData, closeModal, openModal } = useUIStore();
  const { user: currentUser } = useAuthStore();
  const navigate = useNavigate();
  const { servers, setCurrentServer, currentServer, members, roles, fetchRoles, assignSelfRole, removeSelfRole } = useServerStore();
  const isMobile = useIsMobile();

  const serverIds = useMemo(() => servers.map((s) => s.id), [servers]);
  const {
    friends, pendingRequests, outgoingRequests, blockedUsers,
    sendRequest, removeFriend, acceptRequest, declineRequest, blockUser, unblockUser,
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

  /* ─── Cooldown logic ─── */

  const applyCooldownFromDeclinedAt = useCallback((declinedAtRaw: string | null | undefined) => {
    if (!declinedAtRaw) { setCooldownSeconds(0); return; }
    const cooldownEnd = new Date(new Date(declinedAtRaw).getTime() + COOLDOWN_MINUTES * 60 * 1000);
    const remaining = cooldownEnd.getTime() - Date.now();
    setCooldownSeconds(remaining > 0 ? Math.ceil(remaining / 1000) : 0);
  }, []);

  const refreshCooldown = useCallback(async () => {
    if (!currentUser?.id || !userId || currentUser.id === userId) return;
    try {
      const { data, error } = await supabase.rpc("profile", { _target_user_id: userId, _requesting_user_id: currentUser.id, _server_ids: [] });
      if (error) { console.error("Failed to refresh cooldown:", error); return; }
      applyCooldownFromDeclinedAt((data as any)?.declined_at ?? null);
    } catch (err) { console.error("Error refreshing cooldown:", err); }
  }, [applyCooldownFromDeclinedAt, currentUser?.id, userId]);

  /* ─── Close / Reset ─── */

  const handleClose = useCallback(() => {
    setProfileUser(null);
    setUserBadges([]);
    setSharedServers([]);
    setPosition(null);
    closeModal();
  }, [closeModal]);

  /* ─── Profile effect handling ─── */

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
    img.onload = () => {
      captureTimeout = window.setTimeout(() => {
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
        } catch (error) { console.error("Failed to capture still frame:", error); }
      }, 3000);
    };
    return () => { cancelled = true; img.onload = null; if (captureTimeout !== null) window.clearTimeout(captureTimeout); };
  }, [isOpen, profileEffectStillFrame, profileUser?.profile_effect]);

  /* ─── Fetch profile data ─── */

  useEffect(() => {
    if (!isOpen || !userId || !currentUser?.id) return;
    const fetchProfile = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase.rpc("profile", { _target_user_id: userId, _requesting_user_id: currentUser.id, _server_ids: serverIds });
        if (error) throw error;
        const payload = data as any;
        if (!payload?.user) throw new Error("Profile not found");
        const d = payload.user as any;
        setProfileUser({
          id: d.id, username: d.username, display_name: d.display_name,
          avatar_url: d.avatar_url, banner_url: d.banner_url ?? null,
          avatar_decoration: d.avatar_decoration, profile_effect: d.profile_effect ?? null,
          banner_color: d.banner_color || "#5865F2",
          profile_theme_primary: d.profile_theme_primary ?? null,
          profile_theme_accent: d.profile_theme_accent ?? null,
          bio: d.bio, status: d.status as UserStatus, custom_status: d.custom_status,
          created_at: d.created_at, last_seen: d.last_seen,
          pronouns: d.pronouns ?? null, is_bot: d.is_bot ?? false,
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
      } finally { setIsLoading(false); }
    };
    void fetchProfile();
  }, [applyCooldownFromDeclinedAt, currentUser?.id, isOpen, serverIds, servers, userId]);

  /* ─── Timers & listeners ─── */

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const interval = window.setInterval(() => setCooldownSeconds((prev) => Math.max(prev - 1, 0)), 1000);
    return () => window.clearInterval(interval);
  }, [cooldownSeconds]);

  useEffect(() => {
    if (!isOpen || isMobile) return;
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMobile, isOpen, handleClose]);

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

  /* ─── Derived state ─── */

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

  /* ─── Action handlers ─── */

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
      } finally { setUpdatingRoleId(null); }
    },
    [assignSelfRole, currentServer?.id, currentUser?.id, removeSelfRole, selfAssignedRoleIds],
  );

  const handleMessage = async () => {
    if (!currentUser || !profileUser) return;
    try {
      const conversation = await openConversation(currentUser.id, profileUser.id);
      if (!conversation) { toast.error("You can't message this user"); return; }
      navigate(`/app?conversation=${conversation.id}`, { replace: true });
      setCurrentServer(null);
      setCurrentConversation(conversation);
      handleClose();
    } catch { toast.error("Failed to open conversation"); }
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
      if (success) toast.success("Friend request sent");
      else await refreshCooldown();
    }
  };

  const handleAcceptRequest = async () => {
    if (!currentUser) return;
    const pending = pendingRequests.find((f) => f.id === userId);
    if (!pending) return;
    await acceptRequest(pending.friendship_id, currentUser.id);
    toast.success("Friend request accepted");
  };

  const handleDeclineRequest = async () => {
    if (!currentUser) return;
    const pending = pendingRequests.find((f) => f.id === userId);
    if (!pending) return;
    await declineRequest(pending.friendship_id, currentUser.id);
    toast.success("Friend request declined");
  };

  const handleBlockUser = async () => {
    if (!currentUser || !profileUser) return;
    try {
      await blockUser(currentUser.id, profileUser.id);
      toast.success(`Blocked ${profileUser.display_name || profileUser.username}`);
    } catch { toast.error("Failed to block user"); }
  };

  const handleUnblockUser = async () => {
    if (!currentUser || !profileUser) return;
    try {
      await unblockUser(currentUser.id, profileUser.id);
      toast.success(`Unblocked ${profileUser.display_name || profileUser.username}`);
    } catch { toast.error("Failed to unblock user"); }
  };

  /* ─── Render: Action Row ─── */

  const renderActionRow = () => {
    if (isSelf || !profileUser) return null;

    return (
      <div className="border-t border-border/50 px-4 py-3">
        {!isBlocked ? (
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="flex-1 rounded-lg"
              onClick={handleMessage}
            >
              <MessageCircle className="mr-1.5 h-3.5 w-3.5" />
              Message
            </Button>

            {hasPendingRequest ? (
              <>
                <Button variant="secondary" size="sm" className="flex-1 rounded-lg" onClick={handleAcceptRequest}>
                  <Check className="h-3.5 w-3.5 mr-1" />
                  Accept
                </Button>
                <Button variant="secondary" size="sm" className="flex-1 rounded-lg" onClick={handleDeclineRequest}>
                  <X className="h-3.5 w-3.5 mr-1" />
                  Decline
                </Button>
              </>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                className="flex-1 rounded-lg"
                onClick={handleFriendAction}
                disabled={hasSentRequest || isInCooldown || isSendingRequest}
                title={
                  hasSentRequest ? "Friend request sent"
                    : isInCooldown ? `Retry in ${formatCooldown(cooldownSeconds)}`
                    : isFriend ? "Remove friend" : "Add friend"
                }
              >
                {isSendingRequest ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />Sending</>
                ) : isFriend ? (
                  <><UserMinus className="h-3.5 w-3.5 mr-1" />Remove</>
                ) : isInCooldown ? (
                  <><Clock className="h-3.5 w-3.5 mr-1" />Wait</>
                ) : (
                  <><UserPlus className="h-3.5 w-3.5 mr-1" />Add</>
                )}
              </Button>
            )}

            <Button
              variant="secondary"
              size="icon-sm"
              className="rounded-lg shrink-0"
              onClick={handleBlockUser}
              title="Block user"
            >
              <Ban className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            className="w-full rounded-lg"
            onClick={handleUnblockUser}
          >
            <Ban className="mr-1.5 h-3.5 w-3.5" />
            Unblock
          </Button>
        )}
      </div>
    );
  };

  /* ─── Render: Card ─── */

  const renderCard = () => {
    if (isLoading) {
      return (
        <div className="flex h-72 items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="h-7 w-7 animate-spin" />
            <p className="text-sm">Loading profile…</p>
          </div>
        </div>
      );
    }

    if (!profileUser) return null;

    const light = isLightTheme(profileUser.profile_theme_primary, profileUser.profile_theme_accent, profileUser.banner_color);
    const fg = light ? "#0b0b0f" : "#f8fafc";
    const muted = light ? "rgba(11, 11, 15, 0.58)" : "rgba(248, 250, 252, 0.6)";
    const divider = light ? "rgba(11, 11, 15, 0.1)" : "rgba(248, 250, 252, 0.1)";
    const surface = light ? "rgba(255,255,255,0.36)" : "rgba(17,18,21,0.65)";
    const overlay = light ? "rgba(255,255,255,0.42)" : "rgba(0,0,0,0.28)";
    const bannerUrl = profileUser.banner_url;
    const hasProfileDecoration = Boolean(profileUser.avatar_decoration);
    const presence = getEffectivePresence(profileUser.status || "offline", profileUser.last_seen, profileUser.id);
    const effectSrc = profileUser.profile_effect ? getProfileEffectSrc(profileUser.profile_effect) : null;
    const displayEffectSrc = profileEffectAnimationEndedRef.current && profileEffectStillFrame ? profileEffectStillFrame : effectSrc;
    const joinedAt = profileUser.created_at ? format(new Date(profileUser.created_at), "MMM d, yyyy") : "Unknown";
    const rolePreview = userRoles.slice(0, 3);
    const bioText = profileUser.bio?.trim();
    const shouldCollapseBio = Boolean(bioText && bioText.length > 80);
    const statusText = profileUser.custom_status?.trim();
    const selfStatusLabel = statusText || "Set a status";

    const hasThemeColors = profileUser.profile_theme_primary && profileUser.profile_theme_accent;
    const themeStyle: CSSProperties = {
      color: fg,
      background: hasThemeColors
        ? `linear-gradient(180deg, ${profileUser.profile_theme_primary} 0%, ${profileUser.profile_theme_accent} 100%)`
        : `linear-gradient(180deg, ${withAlpha(profileUser.banner_color, "33")} 0%, ${withAlpha(profileUser.banner_color, "12")} 100%)`,
      ["--profile-muted" as string]: muted,
    };

    return (
      <div className="relative overflow-hidden rounded-xl" style={themeStyle}>
        {/* Background overlay */}
        <div className="pointer-events-none absolute inset-0" style={{ backgroundColor: overlay }} />

        {/* Banner */}
        {bannerUrl ? (
          <div className="relative h-24 sm:h-20 overflow-hidden">
            <img src={bannerUrl} alt="Profile banner" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/40" />
          </div>
        ) : (
          <div className="h-16 sm:h-14" />
        )}

        {/* Profile effect */}
        {displayEffectSrc && (
          <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
            <img
              ref={profileEffectImgRef}
              key={`effect-${profileUser.profile_effect}-${userId}-${profileEffectStillFrame ? "still" : "anim"}`}
              src={displayEffectSrc}
              alt=""
              className="h-full w-full object-cover object-top opacity-80"
            />
          </div>
        )}

        {/* Main content */}
        <div className="relative z-10 px-4 pb-1">
          {/* Avatar + Identity */}
          <div className="-mt-8 sm:-mt-7 flex items-end gap-3.5">
            <div className="relative shrink-0">
              <AvatarWithDecoration
                user={profileUser}
                className={hasProfileDecoration ? "h-16 w-16 sm:h-[60px] sm:w-[60px]" : "h-[72px] w-[72px] sm:h-16 sm:w-16"}
                active
              />
              <div
                className={cn(
                  "absolute bottom-0.5 right-0.5 rounded-full border-[3px] shadow-sm",
                  hasProfileDecoration ? "h-4 w-4" : "h-[18px] w-[18px]",
                  statusColors[presence.status],
                )}
                style={{ borderColor: hasThemeColors ? profileUser.profile_theme_accent! : "hsl(var(--background))" }}
                title={statusLabels[presence.status]}
              />
            </div>

            <div className="min-w-0 flex-1 pb-1">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-lg font-semibold leading-tight">
                  {profileUser.display_name || profileUser.username}
                </h2>
                {profileUser.is_bot && <BotTag className="rounded-md px-1.5 py-0.5 text-[10px]" />}
                {userBadges.length > 0 && (
                  <div className="shrink-0 ml-auto">
                    <UserBadges badges={userBadges} />
                  </div>
                )}
              </div>
              <p className="mt-0.5 truncate text-[13px] font-medium" style={{ color: muted }}>
                @{profileUser.username}
              </p>
            </div>
          </div>

          {/* Custom status (self) */}
          {isSelf && (
            <button
              type="button"
              onClick={() => openModal("set-status")}
              className={cn(
                "mt-2 truncate text-left text-[13px] transition-opacity hover:opacity-80",
                statusText ? "font-medium" : "font-semibold",
              )}
              style={{ color: muted }}
              title={selfStatusLabel}
            >
              {selfStatusLabel}
            </button>
          )}

          {/* Info card */}
          <div className="mt-4 mb-3">
            <div className="rounded-xl p-3.5" style={{ backgroundColor: surface, backdropFilter: "blur(16px)" }}>
              {/* Meta tags */}
              <div className="flex flex-wrap gap-1.5">
                <span
                  className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium"
                  style={{ backgroundColor: divider }}
                >
                  {statusLabels[presence.status]}
                </span>
                {profileUser.pronouns && (
                  <span
                    className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium"
                    style={{ backgroundColor: divider }}
                  >
                    {profileUser.pronouns}
                  </span>
                )}
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium"
                  style={{ backgroundColor: divider }}
                >
                  <Calendar className="h-3 w-3" />
                  {joinedAt}
                </span>
              </div>

              {/* Custom status (other user) */}
              {!isSelf && statusText && (
                <p className="mt-3 text-[13px] font-medium" style={{ color: muted }}>{statusText}</p>
              )}

              {/* Bio */}
              {bioText && (
                <div className="mt-3">
                  <div className="relative">
                    <p
                      className="whitespace-pre-wrap break-words text-[13px] leading-relaxed"
                      style={!isBioExpanded && shouldCollapseBio ? { maxHeight: "4.5rem", overflow: "hidden" } : undefined}
                    >
                      {bioText}
                    </p>
                    {!isBioExpanded && shouldCollapseBio && (
                      <div
                        className="pointer-events-none absolute inset-x-0 bottom-0 h-10"
                        style={{ background: `linear-gradient(180deg, rgba(255,255,255,0) 0%, ${surface} 100%)` }}
                      />
                    )}
                  </div>
                  {shouldCollapseBio && (
                    <button
                      type="button"
                      className="mt-1 text-[12px] font-semibold transition-opacity hover:opacity-80"
                      style={{ color: fg }}
                      onClick={() => setIsBioExpanded((prev) => !prev)}
                    >
                      {isBioExpanded ? "See less" : "See more"}
                    </button>
                  )}
                </div>
              )}

              {/* Roles & Shared Servers */}
              {(rolePreview.length > 0 || (isSelf && selfAssignableRoles.length > 0) || (!isSelf && sharedServers.length > 0)) && (
                <>
                  <div className="mt-3.5 h-px" style={{ backgroundColor: divider }} />

                  <div className="mt-3.5 space-y-3">
                    {/* Roles */}
                    {(rolePreview.length > 0 || (isSelf && selfAssignableRoles.length > 0)) && (
                      <div className="flex flex-wrap gap-1.5">
                        {rolePreview.map((role) => {
                          const isGradient = role.color.startsWith("linear-gradient");
                          const background = withRoleBackgroundOpacity(role.color, 0.34);
                          return (
                            <span
                              key={role.id}
                              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium"
                              style={isGradient ? { background, color: fg } : { backgroundColor: background, color: fg }}
                            >
                              <span
                                className="h-2 w-2 rounded-full shrink-0"
                                style={isGradient ? { background: role.color } : { backgroundColor: role.color }}
                              />
                              {role.name}
                            </span>
                          );
                        })}
                        {userRoles.length > rolePreview.length && (
                          <span
                            className="inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium"
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
                                className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium transition-opacity hover:opacity-80"
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

                    {/* Shared servers */}
                    {!isSelf && sharedServers.length > 0 && (
                      <div className="flex gap-2">
                        {sharedServers.map((server) => (
                          <button
                            key={server.id}
                            type="button"
                            className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg text-[11px] font-semibold transition-transform hover:scale-105"
                            style={{ backgroundColor: divider }}
                            title={server.name}
                            onClick={() => { setCurrentServer(server); handleClose(); }}
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

        {/* Action row */}
        {renderActionRow()}
      </div>
    );
  };

  /* ─── Render ─── */

  if (!isOpen) return null;

  if (isMobile) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent
          className="max-h-[85vh] w-[calc(100vw-2rem)] max-w-sm overflow-hidden border-none bg-transparent p-0 shadow-none"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="max-h-[80vh] overflow-y-auto rounded-xl border border-border bg-popover shadow-2xl">
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
        className="absolute max-h-[75vh] w-[360px] overflow-y-auto rounded-xl border border-border bg-popover shadow-[0_24px_80px_rgba(0,0,0,0.5)]"
        style={{
          left: position?.left ?? -9999,
          top: position?.top ?? -9999,
          opacity: position ? 1 : 0,
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {renderCard()}
      </div>
    </div>
  );
};
