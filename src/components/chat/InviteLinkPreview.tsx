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
  "mt-2 w-full max-w-[360px] overflow-hidden rounded-[4px] border border-[#2F3137] bg-gradient-to-br from-[#353944] to-[#1f212763]";

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
        <div className="flex items-start gap-2.5 p-2.5 pb-2">
          <div className="min-w-0 flex-1">
            <div className="h-3 w-44 rounded bg-white/15" />
            <div className="mt-2 h-2.5 w-36 rounded bg-white/10" />
            <div className="mt-1.5 h-2.5 w-24 rounded bg-white/10" />
          </div>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black/20">
            <Loader2 className="h-4 w-4 animate-spin text-[#f5c400]" />
          </div>
        </div>
        <div className="mx-2.5 mb-2.5 h-5 rounded-[3px] bg-[#f5c400]/70" />
      </div>
    );
  }

  if (!invite) {
    return (
      <div className={inviteCardClass}>
        <div className="p-2.5">
          <div className="text-[12px] font-semibold leading-tight text-white">Invalid invite</div>
          <div className="mt-1 text-[11px] leading-tight text-[#cfc6b8]">This invite may be invalid or revoked.</div>
          <Button
            variant="ghost"
            disabled
            className="mt-2 h-5 w-full rounded-[3px] bg-[#f5c400]/60 px-2 text-[10px] font-semibold text-[#312719] hover:bg-[#f5c400]/60"
          >
            Invite Unavailable
          </Button>
        </div>
      </div>
    );
  }

  const memberCountText =
    typeof invite.member_count === "number" && invite.member_count >= 0
      ? `${invite.member_count.toLocaleString()} members`
      : null;
  const title = invite.name;

  return (
    <div className={inviteCardClass}>
      <div className="flex items-center gap-2.5 p-2.5 pb-1.5">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold leading-[16px] text-white">{title}</div>
          <p className="mt-1.5 line-clamp-2 text-[11px] font-medium leading-[13px] text-[#ddd4c6]">
            {invite.about || "You've been invited to join this server."}
          </p>
          {memberCountText && (
            <div className="mt-2 text-[10px] font-medium leading-none text-[#b7aa99]">{memberCountText}</div>
          )}
        </div>

        <Avatar className="h-12 w-12 shrink-0 rounded-full bg-[#272119]">
          <AvatarImage src={invite.icon_url || undefined} className="rounded-full" />
          <AvatarFallback className="rounded-full bg-[#231e18] text-[12px] font-bold text-[#f5c400]">
            {getServerInitials(invite.name)}
          </AvatarFallback>
        </Avatar>
      </div>

      <div className="px-2.5 pb-2.5">
        <Button
          onClick={handleJoin}
          disabled={isJoining}
          className="mt-1.5 h-4 w-full rounded-[3px] bg-white px-1.5 !text-[13px] sm:!text-[13px] font-bold leading-none text-[#2f2618] shadow-none hover:bg-[#f3f4f6] disabled:bg-white/70 disabled:text-[#2f2618]/70"
        >
          {isJoining && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
          {isAlreadyMember ? "Open Server" : "Accept Invite"}
        </Button>
      </div>
    </div>
  );
};
