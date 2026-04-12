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

const STATUS_DOT_COLORS: Record<UserStatus, string> = {
  online: "#22c55e",
  idle: "#eab308",
  dnd: "#ef4444",
  offline: "#71717a",
};

const statusLabels: Record<UserStatus, string> = {
  online: "Online",
  idle: "Idle",
  dnd: "Do Not Disturb",
  offline: "Offline",
};

const COOLDOWN_MINUTES = 5;
const DESKTOP_CARD_WIDTH = 420;
const VIEWPORT_MARGIN = 12;

/* ─── Color helpers ─── */

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

/* ─── Inline styles ─── */

const cardStyle: CSSProperties = {
  fontFamily: "'DM Sans', sans-serif",
  background: "rgba(24, 24, 27, 0.95)",
  border: "1px solid rgba(63, 63, 70, 0.3)",
  borderRadius: 10,
  maxWidth: 420,
  width: "100%",
  overflow: "hidden",
};

const sectionLabelStyle: CSSProperties = {
  fontSize: 11.5,
  fontWeight: 600,
  textTransform: "uppercase" as const,
  color: "#a1a1aa",
  letterSpacing: "0.06em",
  marginBottom: 10,
};

const bodyTextStyle: CSSProperties = {
  fontSize: 13.5,
  color: "#d4d4d8",
  lineHeight: 1.6,
};

const dividerStyle: CSSProperties = {
  height: 1,
  background: "rgba(63, 63, 70, 0.25)",
  border: "none",
  margin: 0,
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
        setSharedServers(servers.filter((s) => sharedServerIds.has(s.id)).slice(0, 6));
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

  /* ─── Render helpers ─── */

  const renderCard = () => {
    if (isLoading) {
      return (
        <div style={{ ...cardStyle, display: "flex", alignItems: "center", justifyContent: "center", height: 240 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, color: "#71717a" }}>
            <Loader2 className="h-6 w-6 animate-spin" />
            <span style={{ fontSize: 12 }}>Loading profile…</span>
          </div>
        </div>
      );
    }

    if (!profileUser) return null;

    const presence = getEffectivePresence(profileUser.status || "offline", profileUser.last_seen, profileUser.id);
    const effectSrc = profileUser.profile_effect ? getProfileEffectSrc(profileUser.profile_effect) : null;
    const displayEffectSrc = profileEffectAnimationEndedRef.current && profileEffectStillFrame ? profileEffectStillFrame : effectSrc;
    const joinedAt = profileUser.created_at ? format(new Date(profileUser.created_at), "MMM d, yyyy") : "Unknown";
    const bioText = profileUser.bio?.trim();
    const rolePreview = userRoles.slice(0, 3);
    const bannerUrl = profileUser.banner_url;
    const bannerColor = profileUser.banner_color || "#5865F2";

    return (
      <div style={cardStyle}>
        {/* Banner */}
        <div style={{ position: "relative", height: 60, overflow: "hidden" }}>
          {bannerUrl ? (
            <img src={bannerUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          ) : (
            <div style={{ width: "100%", height: "100%", background: bannerColor }} />
          )}

          {/* Profile effect overlay on banner */}
          {displayEffectSrc && (
            <img
              ref={profileEffectImgRef}
              key={`effect-${profileUser.profile_effect}-${userId}-${profileEffectStillFrame ? "still" : "anim"}`}
              src={displayEffectSrc}
              alt=""
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.6, pointerEvents: "none" }}
            />
          )}

          {/* Close button */}
          <button
            type="button"
            onClick={handleClose}
            style={{
              position: "absolute", top: 6, right: 6,
              width: 24, height: 24, borderRadius: 4,
              background: "rgba(0,0,0,0.5)", border: "none",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: "#d4d4d8",
            }}
          >
            <X style={{ width: 14, height: 14 }} />
          </button>
        </div>

        {/* Avatar overlapping banner */}
        <div style={{ position: "relative", padding: "0 20px" }}>
          <div style={{ marginTop: -32, position: "relative", width: 64, height: 64 }}>
            <AvatarWithDecoration
              user={profileUser}
              className="h-16 w-16"
              active
            />
            {/* Status dot */}
            <div
              style={{
                position: "absolute", bottom: 0, right: 0,
                width: 16, height: 16, borderRadius: "50%",
                background: STATUS_DOT_COLORS[presence.status],
                border: "3px solid rgba(24, 24, 27, 0.95)",
              }}
              title={statusLabels[presence.status]}
            />
          </div>
        </div>

        {/* Identity */}
        <div style={{ padding: "12px 20px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 17, fontWeight: 700, color: "#fafafa", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {profileUser.display_name || profileUser.username}
            </span>
            {profileUser.is_bot && <BotTag className="rounded-md px-1.5 py-0.5 text-[10px]" />}
          </div>
          <p style={{ fontSize: 13, color: "#a1a1aa", marginTop: 4 }}>@{profileUser.username}</p>

          {/* Badges */}
          {userBadges.length > 0 && (
            <div style={{ marginTop: 6 }}>
              <UserBadges badges={userBadges} />
            </div>
          )}

          {/* Custom status */}
          {profileUser.custom_status?.trim() && (
            <p style={{ fontSize: 11, color: "#a1a1aa", marginTop: 6 }}>
              {profileUser.custom_status.trim()}
            </p>
          )}

          {/* Self status button */}
          {isSelf && !profileUser.custom_status?.trim() && (
            <button
              type="button"
              onClick={() => openModal("set-status")}
              style={{ fontSize: 11, color: "#71717a", marginTop: 6, background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit" }}
            >
              Set a status
            </button>
          )}
        </div>

        {/* Divider */}
        <div style={{ padding: "14px 20px 0" }}><div style={dividerStyle} /></div>

        {/* About Me */}
        {bioText && (
          <div style={{ padding: "14px 20px 0" }}>
            <div style={sectionLabelStyle}>About Me</div>
            <p style={{ ...bodyTextStyle, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{bioText}</p>
          </div>
        )}

        {/* Member Since */}
        <div style={{ padding: "14px 20px 0" }}>
          <div style={sectionLabelStyle}>Member Since</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Calendar style={{ width: 12, height: 12, color: "#a1a1aa", flexShrink: 0 }} />
            <span style={bodyTextStyle}>{joinedAt}</span>
          </div>
        </div>

        {/* Roles */}
        {(rolePreview.length > 0 || (isSelf && selfAssignableRoles.length > 0)) && (
          <div style={{ padding: "14px 20px 0" }}>
            <div style={sectionLabelStyle}>Roles</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {rolePreview.map((role) => {
                const isGradient = role.color.startsWith("linear-gradient");
                const bg = withRoleBackgroundOpacity(role.color, 0.34);
                return (
                  <span
                    key={role.id}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      borderRadius: 4, padding: "2px 8px",
                      fontSize: 11, fontWeight: 500, color: "#d4d4d8",
                      ...(isGradient ? { background: bg } : { backgroundColor: bg }),
                    }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, ...(isGradient ? { background: role.color } : { backgroundColor: role.color }) }} />
                    {role.name}
                  </span>
                );
              })}
              {userRoles.length > rolePreview.length && (
                <span style={{ fontSize: 11, color: "#71717a", padding: "2px 6px" }}>+{userRoles.length - rolePreview.length}</span>
              )}
              {isSelf && selfAssignableRoles.length > 0 && (
                <Popover open={selfRolePickerOpen} onOpenChange={(next) => { setSelfRolePickerOpen(next); if (!next) setSelfRoleQuery(""); }}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      style={{
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        width: 22, height: 22, borderRadius: 4,
                        background: "rgba(63, 63, 70, 0.3)", border: "none", cursor: "pointer", color: "#a1a1aa",
                      }}
                      title="Manage roles"
                    >
                      <Plus style={{ width: 12, height: 12 }} />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-[240px] border-border bg-popover p-2 text-popover-foreground shadow-xl">
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
          </div>
        )}

        {/* Shared Servers */}
        {!isSelf && sharedServers.length > 0 && (
          <div style={{ padding: "14px 20px 0" }}>
            <div style={{ ...sectionLabelStyle, display: "flex", alignItems: "center", gap: 4 }}>
              Shared Servers
              <span style={{ fontSize: 10, color: "#71717a", fontWeight: 400, textTransform: "none", letterSpacing: "normal" }}>{sharedServers.length}</span>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {sharedServers.map((server) => (
                <button
                  key={server.id}
                  type="button"
                  onClick={() => { setCurrentServer(server); handleClose(); }}
                  title={server.name}
                  style={{
                    width: 32, height: 32, borderRadius: 6,
                    overflow: "hidden", border: "none", cursor: "pointer",
                    background: "rgba(63, 63, 70, 0.3)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, fontWeight: 600, color: "#a1a1aa",
                  }}
                >
                  {server.icon_url ? (
                    <img src={server.icon_url} alt={server.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    server.name.slice(0, 2).toUpperCase()
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Divider before actions */}
        {!isSelf && profileUser && (
          <div style={{ padding: "14px 20px 0" }}><div style={dividerStyle} /></div>
        )}

        {/* Action buttons */}
        {!isSelf && profileUser && (
          <div style={{ padding: "14px 20px 16px" }}>
            {!isBlocked ? (
              <div style={{ display: "flex", gap: 6 }}>
                {/* Friend button */}
                {hasPendingRequest ? (
                  <>
                    <button
                      type="button"
                      onClick={handleAcceptRequest}
                      style={{
                        flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                        height: 32, borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: "pointer",
                        background: "rgba(16, 185, 129, 0.15)", color: "#34d399",
                        border: "1px solid rgba(16, 185, 129, 0.3)",
                      }}
                    >
                      <Check style={{ width: 14, height: 14 }} /> Accept
                    </button>
                    <button
                      type="button"
                      onClick={handleDeclineRequest}
                      style={{
                        flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                        height: 32, borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: "pointer",
                        background: "rgba(239, 68, 68, 0.15)", color: "#f87171",
                        border: "1px solid rgba(239, 68, 68, 0.3)",
                      }}
                    >
                      <X style={{ width: 14, height: 14 }} /> Decline
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={handleFriendAction}
                    disabled={hasSentRequest || isInCooldown || isSendingRequest}
                    title={
                      hasSentRequest ? "Friend request sent"
                        : isInCooldown ? `Retry in ${formatCooldown(cooldownSeconds)}`
                        : isFriend ? "Remove friend" : "Add friend"
                    }
                    style={{
                      flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                      height: 32, borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: "pointer",
                      background: "rgba(16, 185, 129, 0.15)", color: "#34d399",
                      border: "1px solid rgba(16, 185, 129, 0.3)",
                      opacity: (hasSentRequest || isInCooldown || isSendingRequest) ? 0.5 : 1,
                    }}
                  >
                    {isSendingRequest ? (
                      <><Loader2 style={{ width: 14, height: 14 }} className="animate-spin" /> Sending</>
                    ) : isFriend ? (
                      <><UserMinus style={{ width: 14, height: 14 }} /> Remove</>
                    ) : hasSentRequest ? (
                      <><Check style={{ width: 14, height: 14 }} /> Sent</>
                    ) : isInCooldown ? (
                      <><Clock style={{ width: 14, height: 14 }} /> Wait</>
                    ) : (
                      <><UserPlus style={{ width: 14, height: 14 }} /> Friend</>
                    )}
                  </button>
                )}

                {/* Message button */}
                <button
                  type="button"
                  onClick={handleMessage}
                  style={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                    height: 32, borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: "pointer",
                    background: "rgba(113, 113, 122, 0.15)", color: "#a1a1aa",
                    border: "1px solid rgba(113, 113, 122, 0.3)",
                  }}
                >
                  <MessageCircle style={{ width: 14, height: 14 }} /> Message
                </button>

                {/* Block button */}
                <button
                  type="button"
                  onClick={handleBlockUser}
                  title="Block user"
                  style={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                    height: 32, borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: "pointer",
                    background: "rgba(239, 68, 68, 0.15)", color: "#f87171",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                  }}
                >
                  <Ban style={{ width: 14, height: 14 }} /> Block
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleUnblockUser}
                style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                  height: 32, borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: "pointer",
                  background: "rgba(239, 68, 68, 0.15)", color: "#f87171",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                }}
              >
                <Ban style={{ width: 14, height: 14 }} /> Unblock
              </button>
            )}
          </div>
        )}

        {/* Self: bottom padding */}
        {isSelf && <div style={{ height: 12 }} />}
      </div>
    );
  };

  /* ─── Render ─── */

  if (!isOpen) return null;

  if (isMobile) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent
          className="max-h-[85vh] w-[calc(100vw-24px)] overflow-hidden border-none bg-transparent p-0 shadow-none"
          hideCloseButton
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div style={{ maxHeight: "80vh", overflowY: "auto" }}>
            {renderCard()}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }}
      onMouseDown={handleClose}
    >
      <div
        ref={cardRef}
        style={{
          position: "absolute",
          left: position?.left ?? -9999,
          top: position?.top ?? -9999,
          opacity: position ? 1 : 0,
          width: 420,
          maxHeight: "75vh",
          overflowY: "auto",
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {renderCard()}
      </div>
    </div>
  );
};
