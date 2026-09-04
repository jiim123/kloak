import { useState, useMemo, useCallback, useEffect } from "react";
import { Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { AvatarWithDecoration } from "@/components/ui/avatar-with-decoration";
import { getUserFromCache, fetchAndCacheUser, useUserCacheStore } from "@/stores/userCacheStore";
import { useServerStore } from "@/stores/serverStore";
import { useVoiceStore } from "@/stores/voiceStore";
import { useVoiceSettingsStore } from "@/stores/voiceSettingsStore";
import { useAuthStore } from "@/stores/authStore";
import { openUserProfileModal, SIDE_ALIGNED_USER_PROFILE_POPOVER } from "@/lib/userProfilePopover";
import { useUIStore } from "@/stores/uiStore";
import type { ServerMember } from "@/types";

/**
 * Seat positions defined as percentage coordinates on the living room image.
 * Adjust these to match actual furniture in living1.jpg (1278x832).
 */
const SEAT_POSITIONS = [
  { id: "seat-1", x: 12, y: 55, label: "Left sofa" },
  { id: "seat-2", x: 24, y: 52, label: "Center-left sofa" },
  { id: "seat-3", x: 38, y: 48, label: "Center sofa" },
  { id: "seat-4", x: 55, y: 50, label: "Center-right sofa" },
  { id: "seat-5", x: 72, y: 55, label: "Right chair" },
  { id: "seat-6", x: 86, y: 58, label: "Far right chair" },
  { id: "seat-7", x: 30, y: 78, label: "Floor left" },
  { id: "seat-8", x: 62, y: 76, label: "Floor right" },
];

interface Participant {
  identity: string;
  isSpeaking: boolean;
  hideVoiceActivity?: boolean;
  isScreenSharing?: boolean;
}

interface LivingRoomViewProps {
  participants: Participant[];
  /** Broadcast a seat assignment to other voice participants. */
  broadcastSeat: (seatId: string | null) => void;
  onWatchStream?: (streamKey: string | null) => void;
  watchingStreamKey?: string | null;
}

export function LivingRoomView({ participants, broadcastSeat, onWatchStream, watchingStreamKey }: LivingRoomViewProps) {
  const user = useAuthStore((s) => s.user);
  const { members } = useServerStore();
  const joinedChannelId = useVoiceStore((s) => s.joinedChannelId);
  const seatAssignments = useVoiceStore((s) => s.seatAssignments);
  const visualVoiceIndicators = useVoiceSettingsStore((s) => s.settings.visualVoiceIndicators);
  const openModal = useUIStore((s) => s.openModal);
  const userCacheVersion = useUserCacheStore((s) => s._version);

  const [hoveredSeat, setHoveredSeat] = useState<string | null>(null);

  const memberByUserId = useMemo(() => {
    const map = new Map<string, ServerMember>();
    for (const m of members) map.set(m.user_id, m);
    return map;
  }, [members]);

  // Fetch users we don't have cached
  useEffect(() => {
    void userCacheVersion;
    const uniqueIds = Array.from(new Set(participants.map((p) => p.identity)));
    for (const userId of uniqueIds) {
      if (memberByUserId.get(userId)?.user) continue;
      if (getUserFromCache(userId)) continue;
      fetchAndCacheUser(userId).catch(() => {});
    }
  }, [participants, memberByUserId, userCacheVersion]);

  // Build seat→user map using synced seatAssignments from voiceStore, then auto-fill remaining
  const occupiedSeatMap = useMemo(() => {
    const map = new Map<string, string>(); // seatId -> userId
    const assigned = new Set<string>();

    // First, place users with explicit seat assignments from the store
    for (const seat of SEAT_POSITIONS) {
      for (const p of participants) {
        const assignKey = `${joinedChannelId}:${p.identity}`;
        if (seatAssignments[assignKey] === seat.id) {
          map.set(seat.id, p.identity);
          assigned.add(p.identity);
          break;
        }
      }
    }

    // Then auto-assign remaining participants to first available seat
    for (const p of participants) {
      if (assigned.has(p.identity)) continue;
      for (const seat of SEAT_POSITIONS) {
        if (!map.has(seat.id)) {
          map.set(seat.id, p.identity);
          assigned.add(p.identity);
          break;
        }
      }
    }

    return map;
  }, [participants, seatAssignments, joinedChannelId]);

  // Participants who fit in seats vs overflow
  const seatedUserIds = useMemo(() => new Set(occupiedSeatMap.values()), [occupiedSeatMap]);
  const overflowParticipants = useMemo(
    () => participants.filter((p) => !seatedUserIds.has(p.identity)),
    [participants, seatedUserIds],
  );

  const handleSeatClick = useCallback(
    (seatId: string) => {
      if (!user) return;
      const occupantUserId = occupiedSeatMap.get(seatId);

      // If clicking on an occupied seat by someone else, open their profile
      if (occupantUserId && occupantUserId !== user.id) {
        const member = memberByUserId.get(occupantUserId);
        const cachedUser = getUserFromCache(occupantUserId);
        const avatarUser = member?.user ?? cachedUser;
        const dummyEl = document.querySelector(`[data-seat-id="${seatId}"]`);
        if (dummyEl) {
          openUserProfileModal(openModal, occupantUserId, dummyEl as HTMLElement, {
            ...SIDE_ALIGNED_USER_PROFILE_POPOVER,
            user: avatarUser,
          });
        }
        return;
      }

      // Toggle: if already on this seat, unassign; otherwise assign
      if (occupantUserId === user.id) {
        broadcastSeat(null);
      } else {
        broadcastSeat(seatId);
      }
    },
    [user, occupiedSeatMap, memberByUserId, openModal, broadcastSeat],
  );

  return (
    <div className="relative w-full h-full select-none">
      {/* Living room image container — fills parent, clips image to bounds */}
      <div className="absolute inset-0 rounded-2xl overflow-hidden">
        {/* Living room background image */}
        <img
          src="/living1.jpg"
          alt="Living room"
          className="absolute inset-0 w-full h-full object-cover"
          draggable={false}
        />

        {/* Subtle dark overlay for contrast */}
        <div className="absolute inset-0 bg-black/15 pointer-events-none" />

        {/* Seat overlays */}
        {SEAT_POSITIONS.map((seat) => {
          const occupantUserId = occupiedSeatMap.get(seat.id);
          const participant = occupantUserId
            ? participants.find((p) => p.identity === occupantUserId)
            : null;
          const isHovered = hoveredSeat === seat.id;
          const isEmpty = !occupantUserId;
          const isSpeaking =
            participant?.isSpeaking &&
            !participant?.hideVoiceActivity &&
            visualVoiceIndicators;
          const isScreenSharing = participant?.isScreenSharing ?? false;

          const member = occupantUserId ? memberByUserId.get(occupantUserId) : undefined;
          const cachedUser = occupantUserId ? getUserFromCache(occupantUserId) : undefined;
          const avatarUser = member?.user ?? cachedUser ?? undefined;

          return (
            <div
              key={seat.id}
              data-seat-id={seat.id}
              className="absolute"
              style={{
                left: `${seat.x}%`,
                top: `${seat.y}%`,
                transform: "translate(-50%, -50%)",
                zIndex: isHovered ? 20 : 10,
              }}
            >
              {/* Hover indicator for empty seats */}
              {isEmpty && (
                <button
                  type="button"
                  className={cn(
                    "relative flex items-center justify-center rounded-full transition-all duration-200 cursor-pointer",
                    "w-9 h-9 sm:w-11 sm:h-11 md:w-12 md:h-12",
                    isHovered
                      ? "bg-white/25 border-2 border-dashed border-white/60 scale-110 shadow-lg shadow-black/30"
                      : "bg-white/8 border border-dashed border-white/20",
                  )}
                  onMouseEnter={() => setHoveredSeat(seat.id)}
                  onMouseLeave={() => setHoveredSeat(null)}
                  onClick={() => handleSeatClick(seat.id)}
                  title={`Sit at ${seat.label}`}
                >
                  <span
                    className={cn(
                      "text-white/70 text-[9px] sm:text-[10px] font-semibold transition-opacity",
                      isHovered ? "opacity-100" : "opacity-0",
                    )}
                  >
                    +You
                  </span>
                </button>
              )}

              {/* Occupied seat: show avatar with voice activity border */}
              {occupantUserId && (
                <div
                  className={cn(
                    "relative flex flex-col items-center cursor-pointer transition-transform",
                    "hover:scale-110 hover:z-30",
                  )}
                  onMouseEnter={() => setHoveredSeat(seat.id)}
                  onMouseLeave={() => setHoveredSeat(null)}
                >
                  {/* Watch Stream button — shown above avatar for screen sharers */}
                  {isScreenSharing && onWatchStream && (
                    <button
                      type="button"
                      className={cn(
                        "mb-1 flex items-center gap-1 rounded-full px-2 py-0.5",
                        "bg-black/60 text-white text-[8px] sm:text-[9px] font-medium backdrop-blur-sm",
                        "border border-white/20 hover:bg-black/80 transition-colors",
                        watchingStreamKey === `${occupantUserId}:screen` && "bg-primary/60 border-primary/70",
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        const next =
                          watchingStreamKey === `${occupantUserId}:screen` ? null : `${occupantUserId}:screen`;
                        onWatchStream(next);
                      }}
                    >
                      <Eye className="w-2.5 h-2.5" />
                      {watchingStreamKey === `${occupantUserId}:screen` ? "Watching" : "Watch"}
                    </button>
                  )}

                  <button
                    type="button"
                    className="relative flex items-center justify-center rounded-full"
                    onClick={() => handleSeatClick(seat.id)}
                    title={member?.nickname || avatarUser?.display_name || avatarUser?.username || seat.label}
                  >
                    {/* Voice activity pulsing ring */}
                    {isSpeaking && (
                      <div className="absolute -inset-1.5 rounded-full animate-pulse">
                        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-green-400 via-emerald-400 to-green-400 opacity-70 blur-[3px]" />
                        <div className="absolute inset-0 rounded-full border-2 border-green-400/80" />
                      </div>
                    )}

                    {/* Avatar container */}
                    <div
                      className={cn(
                        "relative w-9 h-9 sm:w-11 sm:h-11 md:w-12 md:h-12 rounded-full overflow-hidden transition-colors",
                        isSpeaking
                          ? "ring-2 ring-green-400 shadow-lg shadow-green-400/30"
                          : "ring-1.5 ring-white/30",
                      )}
                    >
                      <AvatarWithDecoration
                        user={avatarUser}
                        size={48}
                        freezeGifUntilHover
                        showDecoration={false}
                      />
                    </div>
                  </button>

                  {/* Name tooltip on hover */}
                  {isHovered && (
                    <div className="mt-0.5 whitespace-nowrap bg-black/85 text-white text-[9px] sm:text-[10px] px-2 py-0.5 rounded-md pointer-events-none shadow-lg backdrop-blur-sm">
                      {member?.nickname || avatarUser?.display_name || avatarUser?.username || "User"}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Overflow participants — shown below the living room image when all seats are taken */}
      {overflowParticipants.length > 0 && (
        <div className="absolute bottom-0 inset-x-0 z-15 p-2">
          <div className="rounded-xl border border-white/15 bg-black/50 backdrop-blur-sm p-2">
            <div className="text-[10px] text-white/40 font-medium mb-1.5 px-1">
              {overflowParticipants.length} more connected
            </div>
            <div className="flex flex-wrap gap-1.5">
              {overflowParticipants.map((p) => {
                const member = memberByUserId.get(p.identity);
                const cachedUser = getUserFromCache(p.identity);
                const avatarUser = member?.user ?? cachedUser ?? undefined;
                const name = member?.nickname || avatarUser?.display_name || avatarUser?.username || p.identity.slice(0, 8);
                const isSpeaking = p.isSpeaking && !p.hideVoiceActivity && visualVoiceIndicators;
                const isScreenSharing = p.isScreenSharing ?? false;

                return (
                  <div
                    key={p.identity}
                    className="flex items-center gap-1.5 rounded-lg bg-white/[0.08] border border-white/10 px-1.5 py-1"
                  >
                    <div className="relative">
                      {isSpeaking && (
                        <div className="absolute -inset-0.5 rounded-full animate-pulse">
                          <div className="absolute inset-0 rounded-full bg-green-400/50 blur-[2px]" />
                        </div>
                      )}
                      <div
                        className={cn(
                          "relative w-6 h-6 rounded-full overflow-hidden",
                          isSpeaking ? "ring-1.5 ring-green-400" : "ring-1 ring-white/20",
                        )}
                      >
                        <AvatarWithDecoration
                          user={avatarUser}
                          size={24}
                          freezeGifUntilHover
                          showDecoration={false}
                        />
                      </div>
                    </div>
                    <span className="text-[10px] text-white/70 font-medium truncate max-w-[70px]">
                      {name}
                    </span>
                    {isScreenSharing && onWatchStream && (
                      <button
                        type="button"
                        className={cn(
                          "flex items-center gap-0.5 rounded-full px-1 py-0.5 text-[8px] font-medium transition-colors",
                          "bg-primary/30 text-primary-foreground border border-primary/40 hover:bg-primary/50",
                          watchingStreamKey === `${p.identity}:screen` && "bg-primary/60",
                        )}
                        onClick={() => {
                          const next =
                            watchingStreamKey === `${p.identity}:screen` ? null : `${p.identity}:screen`;
                          onWatchStream(next);
                        }}
                      >
                        <Eye className="w-2 h-2" />
                        {watchingStreamKey === `${p.identity}:screen` ? "Watching" : "Watch"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
