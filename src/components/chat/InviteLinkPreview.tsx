import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuthStore } from "@/stores/authStore";
import { useServerStore } from "@/stores/serverStore";
import { toast } from "sonner";

type InviteDetails = {
  id: string;
  name: string;
  icon_url: string | null;
  about: string | null;
  inviter_username: string | null;
};

export const InviteLinkPreview = ({ inviteCode }: { inviteCode: string }) => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { joinServer, setCurrentServer, fetchChannels } = useServerStore();

  const normalizedCode = useMemo(() => inviteCode.trim().toUpperCase(), [inviteCode]);

  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!normalizedCode || normalizedCode.length !== 8) {
        setInvite(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const { data, error } = await supabase.rpc("get_invite_details_by_code", { _invite_code: normalizedCode });
        if (error) throw error;

        const row = (data ?? [])[0] as unknown as InviteDetails | undefined;
        if (!cancelled) setInvite(row ?? null);
      } catch {
        if (!cancelled) setInvite(null);
      } finally {
        if (!cancelled) setIsLoading(false);
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

    setIsJoining(true);
    try {
      const joinedServer = await joinServer(normalizedCode, user.id);
      if (!joinedServer) {
        const storeError = useServerStore.getState().error;
        toast.error(storeError || "Failed to join server");
        return;
      }

      setCurrentServer(joinedServer);
      await fetchChannels(joinedServer.id);
      toast.success("Successfully joined server!");
      navigate(`/app/servers/${joinedServer.id}`);
    } finally {
      setIsJoining(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mt-2 w-full max-w-sm rounded-2xl border border-border/60 bg-card/60 p-4 shadow-sm backdrop-blur">
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
      <div className="mt-2 w-full max-w-sm overflow-hidden rounded-2xl border border-border/60 bg-card/60 shadow-sm backdrop-blur">
        <div className="p-4">
          <div className="font-semibold leading-tight">Invalid invite</div>
          <div className="mt-1 text-xs text-muted-foreground">This invite may be invalid or revoked.</div>
          <Button variant="outline" disabled className="mt-4 w-full">
            Invite Unavailable
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2 w-full max-w-sm overflow-hidden rounded-2xl border border-border/60 bg-card/60 shadow-sm backdrop-blur">
      <div className="p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12 rounded-xl">
            <AvatarImage src={invite.icon_url || undefined} />
            <AvatarFallback className="rounded-xl bg-transparent">
              {invite.name?.[0]?.toUpperCase() || "?"}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="font-semibold leading-tight truncate">{invite.name}</div>
            <div className="mt-0.5 text-xs text-muted-foreground truncate">
              You’ve been invited{invite.inviter_username ? ` by ${invite.inviter_username}` : ""}
            </div>
          </div>
        </div>

        <Button onClick={handleJoin} disabled={isJoining} className="mt-4 w-full">
          {isJoining && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Join Community
        </Button>
      </div>
    </div>
  );
};
