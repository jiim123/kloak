import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Users } from "lucide-react";
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
      <div className="mt-2 w-full max-w-sm rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-muted/50" />
          <div className="flex-1">
            <div className="h-3 w-40 rounded bg-muted/50" />
            <div className="mt-2 h-3 w-24 rounded bg-muted/30" />
          </div>
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!invite) {
    return (
      <div className="mt-2 w-full max-w-sm overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
        <div className="p-4">
          <div className="font-medium leading-tight">Invalid invite</div>
          <div className="mt-1 text-xs text-muted-foreground">This invite may be invalid or revoked.</div>
          <Button variant="outline" disabled className="mt-4 w-full">
            Invite Unavailable
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2 w-full max-w-sm overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
      <div className="h-16 w-full overflow-hidden bg-muted/40">
        {invite.banner_url ? (
          <img src={invite.banner_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div
            className="h-full w-full opacity-80"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, hsl(var(--foreground) / 0.16) 1px, transparent 0)",
              backgroundSize: "14px 14px",
            }}
          />
        )}
      </div>

      <div className="p-4 pt-0">
        <Avatar className="-mt-6 h-12 w-12 rounded-xl border-[3px] border-card shadow-sm">
          <AvatarImage src={invite.icon_url || undefined} />
          <AvatarFallback className="rounded-xl bg-secondary text-foreground font-semibold">
            {getServerInitials(invite.name)}
          </AvatarFallback>
        </Avatar>

        <div className="mt-3 min-w-0">
          <div className="truncate font-medium leading-tight">{invite.name}</div>
          <div className="mt-1 truncate text-xs text-muted-foreground">
            You've been invited{invite.inviter_username ? ` by ${invite.inviter_username}` : ""}
          </div>
        </div>

        {typeof invite.member_count === "number" && invite.member_count >= 0 && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            <span>{invite.member_count.toLocaleString()} members</span>
          </div>
        )}

        {!!invite.about && <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{invite.about}</p>}

        <Button onClick={handleJoin} disabled={isJoining} className="mt-4 h-8 w-full rounded-full text-xs">
          {isJoining && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isAlreadyMember ? "Open Server" : "Join Community"}
        </Button>
      </div>
    </div>
  );
};
