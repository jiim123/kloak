import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowRight,
  BadgeCheck,
  Disc3,
  Frown,
  Gamepad2,
  Headphones,
  IceCreamCone,
  Loader2,
  Mouse,
  Sprout,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { initializeAuth, useAuthStore } from "@/stores/authStore";
import { useServerStore } from "@/stores/serverStore";
import { toast } from "sonner";
import { SEO } from "@/components/seo";
import { SEO_CONFIG } from "@/lib/seo";
import { getServerInitials } from "@/lib/serverUtils";
import { getAuthEntryPath } from "@/lib/tauriRuntime";
import { cn } from "@/lib/utils";

type InviteServer = {
  id: string;
  name: string;
  icon_url: string | null;
  banner_url: string | null;
  about: string | null;
  inviter_username: string | null;
  member_count?: number | null;
};

const invitePatternIcons = [
  Gamepad2,
  Disc3,
  IceCreamCone,
  Headphones,
  Mouse,
  Sprout,
  Disc3,
  Gamepad2,
  Sprout,
  Mouse,
  IceCreamCone,
  Headphones,
];

const Invite = () => {
  const params = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, secretKey, isLoading: isAuthLoading, checkAuth } = useAuthStore();
  const { joinServer, setCurrentServer, fetchChannels, servers } = useServerStore();

  const inviteCode = useMemo(() => (params.inviteCode || "").trim().toUpperCase(), [params.inviteCode]);
  const autoJoin = useMemo(() => new URLSearchParams(location.search).get("autojoin") === "1", [location.search]);
  const authEntryPath = getAuthEntryPath();
  const didAutoJoin = useRef(false);
  const didInitAuth = useRef(false);

  const [server, setServer] = useState<InviteServer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [showBannedModal, setShowBannedModal] = useState(false);
  const isAlreadyMember = !!server && !!servers.find((s) => s.id === server.id);
  const accountName = user?.display_name || user?.username || null;

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
      } catch {
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
      navigate(`${authEntryPath}?redirect=${encodeURIComponent(returnTo)}`);
      return;
    }

    if (server && isAlreadyMember) {
      const existingServer = servers.find((s) => s.id === server.id);
      if (existingServer) {
        setCurrentServer(existingServer);
        await fetchChannels(existingServer.id, { force: true });
        navigate(`/app/servers/${existingServer.id}`);
        return;
      }
    }

    setIsJoining(true);
    try {
      const joinedServer = await joinServer(inviteCode, activeUser.id);
      if (!joinedServer) {
        const storeError = useServerStore.getState().error;
        if (storeError?.toLowerCase().includes("banned")) {
          setShowBannedModal(true);
        } else {
          toast.error(storeError || "Failed to join server");
        }
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

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-muted">
      <Dialog
        open={showBannedModal}
        onOpenChange={(open) => {
          if (!open) setShowBannedModal(false);
        }}
      >
        <DialogContent className="sm:max-w-sm" hideCloseButton>
          <div className="flex flex-col items-center justify-center gap-4 py-6">
            <Frown className="h-16 w-16 text-muted-foreground" />
            <p className="text-center text-lg font-medium text-foreground">
              Uh oh, seems that you have been banned from this server
            </p>
            <Button variant="outline" onClick={() => setShowBannedModal(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <SEO
        title={server ? `Join ${server.name}` : SEO_CONFIG.invite.title}
        description={server?.about || SEO_CONFIG.invite.description}
      />

      <main className="flex flex-1 items-center justify-center p-4 sm:p-6 lg:p-8">
        {isLoading ? (
          <div className="w-full max-w-[810px] rounded-[4px] bg-card p-10 shadow-[0_20px_70px_rgba(0,0,0,0.35)]">
            <div className="flex flex-col items-center justify-center gap-3 py-10">
              <Loader2 className="h-6 w-6 animate-spin text-white" />
              <p className="text-sm text-muted-foreground">Loading invite...</p>
            </div>
          </div>
        ) : !server ? (
          <div className="w-full max-w-md rounded-[4px] bg-card p-10 text-center shadow-[0_20px_70px_rgba(0,0,0,0.35)]">
            <h1 className="text-2xl font-semibold text-white">Invite not found</h1>
            <p className="mt-2 text-sm text-muted-foreground">This invite may be invalid or revoked.</p>
            <div className="mt-8">
              <Button variant="outline" onClick={() => navigate("/")}>
                Go Home
              </Button>
            </div>
          </div>
        ) : (
          <div className="invite-page-card grid grid-cols-1 overflow-hidden rounded-[4px] bg-card shadow-[0_20px_70px_rgba(0,0,0,0.35)]">
            <section className="flex min-h-[418px] flex-col items-center justify-center px-6 py-8 text-center sm:px-12">
              <p className="text-[15px] font-normal leading-tight text-foreground">
                {server.inviter_username ? `Accept ${server.inviter_username}'s invite to join` : "Accept invite to join"}
              </p>

              <Avatar className="mt-5 h-14 w-14 rounded-full bg-card ring-1 ring-black/25">
                {server.icon_url ? <AvatarImage src={server.icon_url} alt={server.name} className="object-cover" /> : null}
                <AvatarFallback className="rounded-full bg-card text-base font-bold text-white">
                  {getServerInitials(server.name)}
                </AvatarFallback>
              </Avatar>

              <h1 className="mt-4 max-w-full truncate text-[24px] font-bold leading-tight text-white">{server.name}</h1>

              {typeof server.member_count === "number" && server.member_count >= 0 && (
                <div className="mt-5 flex items-center justify-center gap-2 text-[13px] font-medium text-muted-foreground">
                  <Users className="h-4 w-4 text-white" />
                  <span>{server.member_count.toLocaleString()} members</span>
                </div>
              )}

              {!!server.about && (
                <p className="mt-5 max-w-[320px] text-[13px] leading-[18px] text-muted-foreground line-clamp-3">{server.about}</p>
              )}

              <div className="mt-8 w-full max-w-[270px]">
                {accountName && (
                  <div className="mb-8 text-left">
                    <div className="text-[12px] font-medium leading-tight text-foreground">You're logged in as</div>
                    <div className="mt-1 flex h-7 items-center border-b border-[#d6d9df]/80">
                      <span className="min-w-0 flex-1 truncate text-[15px] leading-none text-white">{accountName}</span>
                      <BadgeCheck className="h-4 w-4 shrink-0 text-[#23d160]" />
                    </div>
                  </div>
                )}

                <Button
                  onClick={handleJoin}
                  disabled={isJoining}
                  variant="white"
                  className="h-9 w-full rounded-[4px] px-4 text-[14px] font-bold shadow-[0_0_0_1px_rgba(255,255,255,0.18),0_10px_28px_rgba(0,0,0,0.22)]"
                >
                  {isJoining ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Users className="mr-2 h-4 w-4" />}
                  {isAlreadyMember ? "Open Server" : user ? "Continue" : "Accept Invite"}
                  {!isJoining && <ArrowRight className="ml-2 h-4 w-4" />}
                </Button>

                {!accountName && (
                  <Button
                    variant="ghost"
                    onClick={() => navigate(authEntryPath)}
                    className="mt-4 h-9 w-full rounded-[4px] text-[14px] text-muted-foreground hover:bg-transparent hover:text-white"
                  >
                    Log in
                  </Button>
                )}
              </div>
            </section>

            <section className="relative hidden min-h-[418px] overflow-hidden bg-card md:block">
              {server.banner_url ? (
                <img src={server.banner_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <div className="absolute inset-0 grid grid-cols-4 gap-x-10 gap-y-8 p-8 opacity-45">
                  {invitePatternIcons.map((Icon, index) => (
                    <Icon
                      key={`${Icon.displayName ?? Icon.name}-${index}`}
                      className={cn(
                        "h-11 w-11 stroke-[1.6] text-foreground",
                        index % 3 === 0 && "rotate-12",
                        index % 4 === 0 && "-rotate-12",
                      )}
                    />
                  ))}
                </div>
              )}

              <div className="absolute inset-0 bg-card/35" />
            </section>
          </div>
        )}
      </main>
    </div>
  );
};

export default Invite;
