import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { format } from "date-fns";
import { Ban, Calendar, Check, Clock, Flag, Loader2, MessageCircle, UserCircle, UserMinus, UserPlus, X } from "lucide-react";
import { AvatarWithDecoration } from "@/components/ui/avatar-with-decoration";
import { UserBadges } from "@/components/ui/user-badges";
import { BotTag } from "@/components/ui/bot-tag";
import { useUIStore } from "@/stores/uiStore";
import { useAuthStore } from "@/stores/authStore";
import { useServerStore } from "@/stores/serverStore";
import { useFriendStore } from "@/stores/friendStore";
import { useUserCacheStore } from "@/stores/userCacheStore";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { getEffectivePresence } from "@/lib/presence";
import { openUserProfileModal, SIDE_ALIGNED_USER_PROFILE_POPOVER } from "@/lib/userProfilePopover";
import { ReportReasonDialog, type ReportReasonOption } from "@/components/modals/ReportReasonDialog";
import { toast } from "sonner";
import type { Badge } from "@/types/badge";
import type { User, UserStatus } from "@/types";

interface DMProfilePanelProps {
  user: User | null | undefined;
}

interface AuraSummary {
  label: string;
  rank: number;
  completed_count: number;
  total_count: number;
}

const statusColors: Record<UserStatus, string> = {
  online: "bg-[hsl(var(--kloak-online))]",
  idle: "bg-[hsl(var(--kloak-idle))]",
  dnd: "bg-[hsl(var(--kloak-dnd))]",
  offline: "bg-[hsl(var(--kloak-offline))]",
};

const PROFILE_REPORT_REASONS: ReportReasonOption[] = [
  { value: "Harassment", label: "Harassment" },
  { value: "Spam & abusive behavior", label: "Spam & abusive behavior" },
  { value: "Inappropriate profile content", label: "Inappropriate profile content" },
  { value: "Impersonation", label: "Impersonation" },
  { value: "Toxic behavior", label: "Toxic behavior" },
];

const withAlpha = (hex: string, alphaHex: string) => {
  if (!hex || !hex.startsWith("#") || hex.length !== 7) return hex;
  return `${hex}${alphaHex}`;
};

const buildProfileUser = (d: any): User => ({
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
  tagline: d.tagline ?? null,
  status: d.status as UserStatus,
  custom_status: d.custom_status,
  created_at: d.created_at,
  last_seen: d.last_seen,
  pronouns: d.pronouns ?? null,
  is_bot: d.is_bot ?? false,
});

export const DMProfilePanel = ({ user }: DMProfilePanelProps) => {
  const { openModal } = useUIStore();
  const { user: currentUser } = useAuthStore();
  const { servers, setCurrentServer } = useServerStore();
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
  } = useFriendStore();

  const [profileUser, setProfileUser] = useState<User | null>(user ?? null);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [sharedServers, setSharedServers] = useState<typeof servers>([]);
  const [auraSummary, setAuraSummary] = useState<AuraSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingRequest, setIsSendingRequest] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);

  const serverIds = useMemo(() => servers.map((server) => server.id), [servers]);
  const targetUserId = user?.id;

  useEffect(() => {
    setProfileUser(user ?? null);
    setBadges([]);
    setSharedServers([]);
    setAuraSummary(null);
  }, [targetUserId]);

  useEffect(() => {
    if (!targetUserId || !currentUser?.id) return;

    let cancelled = false;
    const fetchProfile = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase.rpc("profile", {
          _target_user_id: targetUserId,
          _requesting_user_id: currentUser.id,
          _server_ids: serverIds,
        });
        if (error) throw error;

        const payload = data as any;
        const nextUser = payload?.user ? buildProfileUser(payload.user) : user ?? null;
        if (!nextUser || cancelled) return;

        const cachedUser = useUserCacheStore.getState().getUser(nextUser.id);
        const mergedUser = cachedUser
          ? { ...nextUser, status: cachedUser.status, last_seen: cachedUser.last_seen, custom_status: cachedUser.custom_status }
          : nextUser;

        setProfileUser(mergedUser);
        useUserCacheStore.getState().upsertUser(mergedUser);
        setBadges((Array.isArray(payload.badges) ? payload.badges : []) as Badge[]);

        const sharedServerIds = new Set((Array.isArray(payload.shared_server_ids) ? payload.shared_server_ids : []) as string[]);
        setSharedServers(servers.filter((server) => sharedServerIds.has(server.id)).slice(0, 3));

        const { data: achievementData, error: achievementError } = await supabase.rpc("get_user_achievement_summary" as any, {
          _target_user_id: targetUserId,
          _requesting_user_id: currentUser.id,
        });
        if (!cancelled) setAuraSummary(!achievementError && achievementData ? (achievementData as AuraSummary) : null);
      } catch (error) {
        if (!cancelled) console.error("Failed to load DM profile panel:", error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void fetchProfile();
    return () => {
      cancelled = true;
    };
  }, [currentUser?.id, serverIds, servers, targetUserId, user]);

  useEffect(() => {
    if (!targetUserId) return;
    return useUserCacheStore.subscribe(() => {
      const cached = useUserCacheStore.getState().getUser(targetUserId);
      if (!cached) return;
      setProfileUser((prev) => (prev && prev.id === cached.id ? { ...prev, ...cached } : prev));
    });
  }, [targetUserId]);

  if (!profileUser) return null;

  const isSelf = currentUser?.id === profileUser.id;
  const isFriend = friends.some((friend) => friend.id === profileUser.id);
  const hasPendingRequest = pendingRequests.some((friend) => friend.id === profileUser.id);
  const hasSentRequest = outgoingRequests.some((friend) => friend.id === profileUser.id);
  const isBlocked = blockedUsers.some((blocked) => blocked.id === profileUser.id);
  const presence = getEffectivePresence(profileUser.status || "offline", profileUser.last_seen, profileUser.id);
  const displayName = profileUser.display_name || profileUser.username || "Unknown";
  const joinedAt = profileUser.created_at ? format(new Date(profileUser.created_at), "MMM d, yyyy") : "Unknown";
  const bio = profileUser.bio?.trim();
  const statusText = profileUser.custom_status?.trim();
  const themeBackground = profileUser.profile_theme_primary && profileUser.profile_theme_accent
    ? `linear-gradient(180deg, ${profileUser.profile_theme_primary} 0%, ${profileUser.profile_theme_accent} 100%)`
    : `linear-gradient(180deg, ${profileUser.banner_color || "#5865F2"} 0%, ${withAlpha(profileUser.banner_color || "#5865F2", "dd")} 100%)`;
  const divider = "rgba(248,250,252,0.16)";
  const muted = "rgba(248,250,252,0.76)";

  const handleOpenProfile = (event: MouseEvent<HTMLButtonElement>) => {
    openUserProfileModal(openModal, profileUser.id, event.currentTarget, SIDE_ALIGNED_USER_PROFILE_POPOVER);
  };

  const handleFriendAction = async () => {
    if (!currentUser?.id || isSelf || isSendingRequest) return;
    setIsSendingRequest(true);
    try {
      if (isFriend) {
        await removeFriend(currentUser.id, profileUser.id);
        toast.success("Friend removed");
      } else {
        await sendRequest(currentUser.id, profileUser.id);
        toast.success("Friend request sent");
      }
    } catch {
      toast.error(isFriend ? "Failed to remove friend" : "Failed to send friend request");
    } finally {
      setIsSendingRequest(false);
    }
  };

  const handleAcceptRequest = async () => {
    if (!currentUser?.id) return;
    await acceptRequest(currentUser.id, profileUser.id);
  };

  const handleDeclineRequest = async () => {
    if (!currentUser?.id) return;
    await declineRequest(currentUser.id, profileUser.id);
  };

  const handleBlockUser = async () => {
    if (!currentUser?.id) return;
    try {
      await blockUser(currentUser.id, profileUser.id);
      toast.success(`Blocked ${displayName}`);
    } catch {
      toast.error("Failed to block user");
    }
  };

  const handleReportProfile = async (reason: string) => {
    if (!currentUser?.id || isSelf) return;
    const { error } = await (supabase.rpc as any)("report_profile", {
      _reported_user_id: profileUser.id,
      _reason: reason,
      _details: null,
    });
    if (error) throw error;
    toast.success("Profile reported");
  };

  const actionClass = "group flex min-w-0 flex-1 flex-col items-center gap-1.5 rounded-md bg-transparent px-1 py-1 text-[11px] font-semibold text-white/80 disabled:opacity-45";
  const iconWrapClass = "flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-black/25 text-current shadow-sm transition-colors group-hover:bg-white/25";

  return (
    <>
      <aside className="hidden h-full w-[286px] shrink-0 border-l border-border/50 bg-layout-chat lg:block">
        <div className="h-full overflow-y-auto p-0">
          <div className="min-h-full overflow-hidden rounded-none text-white" style={{ background: themeBackground }}>
            {profileUser.banner_url ? (
              <div className="h-[92px] overflow-hidden">
                <img src={profileUser.banner_url} alt="" className="h-full w-full object-cover" />
              </div>
            ) : (
              <div className="h-[52px]" />
            )}

            <div className="px-3.5 pb-5">
              <div className="flex min-w-0 items-end gap-2 pt-2">
                <div className="relative shrink-0">
                  <AvatarWithDecoration user={profileUser} className="h-[76px] w-[76px]" active />
                  <div className={cn("absolute bottom-1 right-1 h-5 w-5 rounded-full border-[3px] border-[#355daa]", statusColors[presence.status])} />
                </div>
                {auraSummary && (
                  <div className="mb-1 flex min-w-0 max-w-[150px] items-center gap-1 rounded-full border border-white/15 bg-black/35 px-1.5 py-0.5 shadow-sm">
                    <img src="/aura-badge.svg" alt="" className="h-4 w-4 shrink-0 rounded-full object-cover" />
                    <span className="min-w-0 truncate text-[10px] font-black leading-none">{auraSummary.label}</span>
                    <span className="shrink-0 text-[10px] font-black leading-none text-white/75">
                      {auraSummary.completed_count}/{auraSummary.total_count}
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-3 flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <h2 className="truncate text-[20px] font-extrabold leading-none">{displayName}</h2>
                    {profileUser.is_bot && <BotTag className="rounded-md px-1.5 py-0.5 text-[10px]" />}
                  </div>
                  <p className="mt-1 truncate text-[13px] font-medium text-white/75">@{profileUser.username}</p>
                  {statusText && <p className="mt-3 break-words text-[13px] font-semibold leading-5">{statusText}</p>}
                </div>
                {badges.length > 0 && <UserBadges badges={badges} />}
              </div>

              <div className={cn("mt-4 grid gap-2 text-center", hasPendingRequest ? "grid-cols-6" : "grid-cols-5")}>
                <button type="button" onClick={handleOpenProfile} className={actionClass}>
                  <span className={iconWrapClass}><UserCircle className="h-5 w-5" /></span>
                  <span className="max-w-full truncate">Profile</span>
                </button>
                <button type="button" className={actionClass} disabled>
                  <span className={iconWrapClass}><MessageCircle className="h-5 w-5" /></span>
                  <span className="max-w-full truncate">Message</span>
                </button>
                {hasPendingRequest ? (
                  <>
                    <button type="button" onClick={handleAcceptRequest} className={actionClass}>
                      <span className={iconWrapClass}><Check className="h-5 w-5" /></span>
                      <span className="max-w-full truncate">Accept</span>
                    </button>
                    <button type="button" onClick={handleDeclineRequest} className={actionClass}>
                      <span className={iconWrapClass}><X className="h-5 w-5" /></span>
                      <span className="max-w-full truncate">Decline</span>
                    </button>
                  </>
                ) : (
                  <button type="button" onClick={handleFriendAction} disabled={hasSentRequest || isSendingRequest || isSelf} className={actionClass}>
                    <span className={iconWrapClass}>
                      {isSendingRequest ? <Loader2 className="h-5 w-5 animate-spin" /> : isFriend ? <UserMinus className="h-5 w-5" /> : hasSentRequest ? <Clock className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
                    </span>
                    <span className="max-w-full truncate">{isFriend ? "Remove" : hasSentRequest ? "Sent" : "Add"}</span>
                  </button>
                )}
                <button type="button" onClick={handleBlockUser} disabled={isBlocked || isSelf} className={actionClass}>
                  <span className={iconWrapClass}><Ban className="h-5 w-5" /></span>
                  <span className="max-w-full truncate">Block</span>
                </button>
                <button type="button" onClick={() => setShowReportDialog(true)} disabled={isSelf} className={actionClass}>
                  <span className={iconWrapClass}><Flag className="h-5 w-5" /></span>
                  <span className="max-w-full truncate">Report</span>
                </button>
              </div>

              <div className="mt-5 space-y-4">
                <section>
                  <div className="mb-2 text-[12px] font-bold uppercase tracking-normal text-white/70">About</div>
                  <div className="flex flex-wrap gap-1.5">
                    {profileUser.pronouns && <span className="rounded-full px-2 py-1 text-[11px] font-semibold" style={{ backgroundColor: divider }}>{profileUser.pronouns}</span>}
                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold" style={{ backgroundColor: divider }}>
                      <Calendar className="h-3 w-3" />
                      {joinedAt}
                    </span>
                  </div>
                </section>

                {bio && (
                  <section>
                    <div className="mb-2 text-[12px] font-bold uppercase tracking-normal text-white/70">Bio</div>
                    <p className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words text-[13px] font-semibold leading-5">{bio}</p>
                  </section>
                )}

                {sharedServers.length > 0 && (
                  <section>
                    <div className="mb-2 text-[12px] font-bold uppercase tracking-normal text-white/70">Mutual Servers</div>
                    <div className="flex flex-wrap gap-1.5">
                      {sharedServers.map((server) => (
                        <button
                          key={server.id}
                          type="button"
                          className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg text-[10px] font-semibold transition-transform hover:scale-105"
                          style={{ backgroundColor: divider, color: muted }}
                          title={server.name}
                          onClick={() => setCurrentServer(server)}
                        >
                          {server.icon_url ? <img src={server.icon_url} alt={server.name} className="h-full w-full object-cover" /> : server.name.slice(0, 2).toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                {isLoading && <div className="text-xs font-semibold text-white/70">Refreshing profile...</div>}
              </div>
            </div>
          </div>
        </div>
      </aside>

      <ReportReasonDialog
        open={showReportDialog}
        onOpenChange={setShowReportDialog}
        title="Report profile"
        description="Choose the reason that best describes this profile."
        reasons={PROFILE_REPORT_REASONS}
        onSubmit={handleReportProfile}
      />
    </>
  );
};
