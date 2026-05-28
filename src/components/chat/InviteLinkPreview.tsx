import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuthStore } from "@/stores/authStore";
import { useServerStore } from "@/stores/serverStore";
import { toast } from "sonner";
import { getServerInitials } from "@/lib/serverUtils";

type InviteDetails = {
  id: string;
  name: string;
  icon_url: string | null;
  banner_url: string | null;
  about: string | null;
  inviter_username: string | null;
  member_count?: number | null;
};

const INVITE_DETAILS_CACHE_TTL_MS = 2 * 60_000;
const inviteDetailsCache = new Map<string, { data: InviteDetails | null; cachedAt: number }>();
const inviteDetailsInFlight = new Map<string, Promise<InviteDetails | null>>();

const inviteCardClass =
  "mt-2 w-full max-w-[360px] overflow-hidden rounded-[10px] border border-[#2B2F36] bg-[#111318] shadow-[0_8px_24px_rgba(0,0,0,0.24)]";

const getInviteDetailsCached = async (code: string): Promise<InviteDetails | null> => {
  const now = Date.now();
  const cached = inviteDetailsCache.get(code);
  if (cached && now - cached.cachedAt < INVITE_DETAILS_CACHE_TTL_MS) {
    return cached.data;
  }

  const inFlight = inviteDetailsInFlight.get(code);
  if (inFlight) return inFlight;

  const request = (async () => {
    try {
      const { data, error } = await supabase.rpc("get_invite_details_by_code", { _invite_code: code });
      if (error) throw error;
      const row = ((data ?? [])[0] as unknown as InviteDetails | undefined) ?? null;
      inviteDetailsCache.set(code, { data: row, cachedAt: Date.now() });
      return row;
    } catch {
      inviteDetailsCache.set(code, { data: null, cachedAt: Date.now() });
      return null;
    } finally {
      inviteDetailsInFlight.delete(code);
    }
  })();

  inviteDetailsInFlight.set(code, request);
  return request;
};

export const InviteLinkPreview = ({ inviteCode }: { inviteCode: string }) => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { joinServer, setCurrentServer, fetchChannels, servers } = useServerStore();

  const normalizedCode = useMemo(() => inviteCode.trim().toUpperCase(), [inviteCode]);

  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const isAlreadyMember = !!invite && !!servers.find((s) => s.id === invite.id);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!normalizedCode || normalizedCode.length !== 8) {
        setInvite(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      const row = await getInviteDetailsCached(normalizedCode);
      if (!cancelled) {
        setInvite(row ?? null);
        setIsLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [normalizedCode]);

  const handleJoin = async () => {
    if (!normalizedCode) return;

    if (!user) {
      navigate(`/invite/${normalizedCode}`);
      return;
    }

    if (invite && isAlreadyMember) {
      const existingServer = servers.find((s) => s.id === invite.id);
      if (existingServer) {
        setCurrentServer(existingServer);
        await fetchChannels(existingServer.id, { force: true });
        navigate(`/app/servers/${existingServer.id}`);
        return;
      }
    }

    setIsJoining(true);
    try {
      const joinedServer = await joinServer(normalizedCode, user.id);
      if (!joinedServer) {
        const storeError = useServerStore.getState().error;
        toast.error(storeError || "Failed to join server");
        return;
      }

      setCurrentServer(joinedServer);
      await fetchChannels(joinedServer.id, { force: true });
      toast.success("Successfully joined server!");
      navigate(`/app/servers/${joinedServer.id}`);
    } finally {
      setIsJoining(false);
    }
  };

  if (isLoading) {
    return (
      <div className={inviteCardClass}>
        <div className="flex items-center gap-3 p-4">
          <div className="h-12 w-12 shrink-0 rounded-full bg-white/10" />
          <div className="min-w-0 flex-1">
            <div className="h-4 w-44 rounded bg-white/15" />
            <div className="mt-2 h-3 w-24 rounded bg-white/10" />
          </div>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/5">
            <Loader2 className="h-4 w-4 animate-spin text-white/70" />
          </div>
        </div>
        <div className="border-t border-[#2B2F36] px-4 py-3.5">
          <div className="h-9 rounded-[6px] bg-[#4F46E5]/70" />
        </div>
      </div>
    );
  }

  if (!invite) {
    return (
      <div className={inviteCardClass}>
        <div className="p-4">
          <div className="text-[16px] font-bold leading-tight text-white">Invalid invite</div>
          <div className="mt-1 text-[13px] leading-tight text-[#AEB4C0]">This invite may be invalid or revoked.</div>
          <Button
            variant="ghost"
            disabled
            className="mt-4 h-9 w-full rounded-[6px] bg-[#44547A]/60 px-3 text-[14px] font-medium text-white hover:bg-[#44547A]/60"
          >
            Invite Unavailable
          </Button>
        </div>
      </div>
    );
  }

  const memberCountText =
    typeof invite.member_count === "number" && invite.member_count >= 0
      ? `${invite.member_count.toLocaleString()} Members`
      : null;
  const title = invite.name;

  return (
    <div className={inviteCardClass}>
      <div className="flex items-center gap-3 p-4">
        <Avatar className="h-12 w-12 shrink-0 rounded-full bg-[#252832]">
          <AvatarImage src={invite.icon_url || undefined} className="rounded-full object-cover" />
          <AvatarFallback className="rounded-full bg-[#252832] text-[14px] font-bold text-white">
            {getServerInitials(invite.name)}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="truncate text-[16px] font-bold leading-[20px] text-white">{title}</div>
          {memberCountText && (
            <div className="mt-1.5 flex items-center gap-1.5 text-[13px] font-medium leading-none text-[#AEB4C0]">
              <span className="h-2 w-2 rounded-full bg-[#7B8493]" aria-hidden="true" />
              <span>{memberCountText}</span>
            </div>
          )}
          {invite.about && (
            <p className="mt-2 line-clamp-2 text-[12px] font-normal leading-[16px] text-[#AEB4C0]">
              {invite.about}
            </p>
          )}
        </div>
      </div>

      <div className="border-t border-[#2B2F36] px-4 py-3.5">
        <Button
          onClick={handleJoin}
          disabled={isJoining}
          className="h-9 w-full rounded-[6px] bg-[#44547A] px-3 !text-[14px] font-medium leading-none text-white shadow-none hover:bg-[#4F5F8A] disabled:bg-[#44547A]/70 disabled:text-white/70"
        >
          {isJoining && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isAlreadyMember ? "Open Server" : "Join Community"}
        </Button>
      </div>
    </div>
  );
};
