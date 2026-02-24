import type { ServerMember } from "@/types";

interface GhostIdentityParams {
  isGhostMode: boolean;
  authorUserId?: string | null;
  members: ServerMember[];
  ownerId?: string | null;
}

// In ghost channels, only server owner/admin identities are visible.
export const canRevealGhostIdentityForUser = ({
  isGhostMode,
  authorUserId,
  members,
  ownerId,
}: GhostIdentityParams): boolean => {
  if (!isGhostMode) return true;
  if (!authorUserId) return false;
  if (ownerId && authorUserId === ownerId) return true;

  const member = members.find((m) => m.user_id === authorUserId);
  if (!member) return false;

  return member.role === "owner" || member.role === "admin";
};

export const getGhostPseudonymousUserId = (authorUserId: string, channelId: string): string => {
  const input = `${authorUserId}:${channelId}:v1`;
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const digest = (hash >>> 0).toString(16).padStart(8, "0");
  return `ghost_${digest}`;
};
