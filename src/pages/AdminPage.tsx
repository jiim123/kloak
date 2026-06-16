import { Suspense, lazy, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { PunishmentNoticeModal } from "@/components/modals/PunishmentNoticeModal";
import KloakDrawLoader from "@/components/ui/KloakDrawLoader";
import { SEO } from "@/components/seo";
import { supabase } from "@/integrations/supabase/client";
import { initializeAuth, useAuthStore } from "@/stores/authStore";
import { useUIStore } from "@/stores/uiStore";
import { getAuthEntryPath } from "@/lib/tauriRuntime";

const UserProfilePopup = lazy(() => import("@/components/modals/UserProfilePopup").then((m) => ({ default: m.UserProfilePopup })));
const AdminPanel = lazy(() => import("@/components/admin/AdminPanel").then((m) => ({ default: m.AdminPanel })));

type AdminCheckState = "checking" | "allowed" | "denied";

const FullPageLoader = () => (
  <div className="flex h-screen items-center justify-center bg-layout-chat app-layout-font discord-inspired">
    <KloakDrawLoader />
  </div>
);

const AdminPage = () => {
  const navigate = useNavigate();
  const authEntryPath = getAuthEntryPath();
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);
  const activeModal = useUIStore((s) => s.activeModal);
  const [adminCheck, setAdminCheck] = useState<AdminCheckState>("checking");

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      await initializeAuth();
      if (cancelled) return;

      const state = useAuthStore.getState();
      if (!state.user && !state.isLoading) {
        navigate(`${authEntryPath}?mode=login`, { replace: true });
      }
    };

    void init();

    return () => {
      cancelled = true;
    };
  }, [authEntryPath, navigate]);

  useEffect(() => {
    if (!isLoading && !user) {
      const timer = setTimeout(() => {
        const state = useAuthStore.getState();
        if (!state.user && !state.isLoading) {
          navigate(`${authEntryPath}?mode=login`, { replace: true });
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [authEntryPath, isLoading, navigate, user]);

  // Server-side admin gate: the RPC is the only source of truth.
  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      setAdminCheck("checking");
      return;
    }

    let cancelled = false;
    setAdminCheck("checking");

    (async () => {
      try {
        const { data, error } = await supabase.rpc("is_platform_admin", { _user_id: user.id });
        if (cancelled) return;
        if (error || data !== true) {
          setAdminCheck("denied");
          navigate("/app", { replace: true });
          return;
        }
        setAdminCheck("allowed");
      } catch {
        if (cancelled) return;
        setAdminCheck("denied");
        navigate("/app", { replace: true });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoading, user, navigate]);

  if (isLoading && !user) return <FullPageLoader />;
  if (!user) return null;
  if (adminCheck === "checking") return <FullPageLoader />;
  if (adminCheck !== "allowed") return null;

  return (
    <div className="h-screen overflow-hidden app-layout-font discord-inspired">
      <SEO title="Admin" noIndex />
      <Suspense fallback={<FullPageLoader />}>
        <AdminPanel />
      </Suspense>
      <PunishmentNoticeModal />
      {activeModal === "userProfile" && (
        <Suspense fallback={null}>
          <UserProfilePopup />
        </Suspense>
      )}
    </div>
  );
};

export default AdminPage;
