import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Loader2, Users, ArrowRight } from "lucide-react";
import { NavigationMenu } from "@/components/layout/NavigationMenu";
import { Footer } from "@/components/ui/footer-section";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { initializeAuth, useAuthStore } from "@/stores/authStore";
import { useServerStore } from "@/stores/serverStore";
import { toast } from "sonner";

type InviteServer = {
  id: string;
  name: string;
  icon_url: string | null;
  banner_url: string | null;
  about: string | null;
  inviter_username: string | null;
};

const Invite = () => {
  const params = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, secretKey, isLoading: isAuthLoading, checkAuth } = useAuthStore();
  const { joinServer, setCurrentServer, fetchChannels } = useServerStore();

  const inviteCode = useMemo(() => (params.inviteCode || "").trim().toUpperCase(), [params.inviteCode]);
  const autoJoin = useMemo(() => new URLSearchParams(location.search).get("autojoin") === "1", [location.search]);
  const didAutoJoin = useRef(false);
  const didInitAuth = useRef(false);

  const [server, setServer] = useState<InviteServer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    if (didInitAuth.current) return;
    didInitAuth.current = true;
    (async () => {
      try {
        await initializeAuth();
      } finally {
        setIsAuthReady(true);
      }
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!inviteCode || inviteCode.length !== 8) {
        setServer(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const { data: lookupData, error: lookupError } = await supabase.rpc("get_invite_details_by_code", {
          _invite_code: inviteCode,
        });

        if (lookupError) throw lookupError;

        const row = (lookupData ?? [])[0] as unknown as InviteServer | undefined;
        if (!cancelled) setServer(row ?? null);
      } catch (e) {
        if (!cancelled) setServer(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [inviteCode]);

  useEffect(() => {
    if (!autoJoin) return;
    if (!user) return;
    if (!inviteCode || inviteCode.length !== 8) return;
    if (didAutoJoin.current) return;
    if (isJoining) return;

    didAutoJoin.current = true;
    void handleJoin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoJoin, user, inviteCode]);

  const handleJoin = async () => {
    if (!inviteCode) return;

    let activeUser = user;

    if (!activeUser && secretKey && !isAuthReady) {
      await initializeAuth();
      setIsAuthReady(true);
      activeUser = useAuthStore.getState().user;
    }

    if (!activeUser && secretKey && !isAuthLoading) {
      const success = await checkAuth();
      if (success) activeUser = useAuthStore.getState().user;
    }

    if (!activeUser) {
      const returnTo = `/invite/${inviteCode}?autojoin=1`;
      navigate(`/auth?redirect=${encodeURIComponent(returnTo)}`);
      return;
    }

    setIsJoining(true);
    try {
      const joinedServer = await joinServer(inviteCode, activeUser.id);
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

  return (
    <div className="relative min-h-screen overflow-hidden flex flex-col bg-background">

      <NavigationMenu />

      <div className="flex-1 w-full p-4 flex items-center justify-center">
        {isLoading ? (
          <div className="w-full max-w-md rounded-3xl border border-border/60 bg-card/70 p-10 shadow-2xl backdrop-blur">
            <div className="flex flex-col items-center justify-center gap-3 py-10">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading invite…</p>
            </div>
          </div>
        ) : !server ? (
          <div className="w-full max-w-md rounded-3xl border border-border/60 bg-card/70 p-10 text-center shadow-2xl backdrop-blur">
            <h1 className="text-2xl font-semibold">Invite not found</h1>
            <p className="mt-2 text-sm text-muted-foreground">This invite may be invalid or revoked.</p>
            <div className="mt-8">
              <Button variant="outline" onClick={() => navigate("/")}>Go Home</Button>
            </div>
          </div>
        ) : (
          <div className="w-full max-w-md overflow-hidden rounded-3xl border border-border/60 bg-card/70 shadow-2xl backdrop-blur">
            <div className="p-8 sm:p-10">
              <div className="mt-6 flex items-center gap-4">
                <Avatar className="h-16 w-16 rounded-2xl">
                  <AvatarImage src={server.icon_url || undefined} />
                  <AvatarFallback className="rounded-2xl text-lg bg-transparent">
                    {server.name?.[0]?.toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">
                    You’ve been invited{server.inviter_username ? ` by ${server.inviter_username}` : ""} to join
                  </p>
                  <h1 className="mt-1 text-2xl font-semibold leading-tight truncate">{server.name}</h1>
                </div>
              </div>

              {!!server.about && (
                <p className="mt-4 text-sm text-muted-foreground leading-relaxed line-clamp-3">
                  {server.about}
                </p>
              )}

              <div className="mt-8">
                <Button onClick={handleJoin} disabled={isJoining} className="w-full">
                  {isJoining ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Users className="w-4 h-4 mr-2" />
                  )}
                  Join Server
                  {!isJoining && <ArrowRight className="w-4 h-4 ml-2" />}
                </Button>
                <p className="mt-3 text-xs text-muted-foreground text-center">
                  {user ? "You’ll join immediately." : "You’ll be asked to log in first."}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
};

export default Invite;
