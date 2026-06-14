import { Suspense, lazy, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { AdminPanel } from "@/components/admin/AdminPanel";
import { PunishmentNoticeModal } from "@/components/modals/PunishmentNoticeModal";
import KloakDrawLoader from "@/components/ui/KloakDrawLoader";
import { SEO } from "@/components/seo";
import { initializeAuth, useAuthStore } from "@/stores/authStore";
import { useUIStore } from "@/stores/uiStore";
import { getAuthEntryPath } from "@/lib/tauriRuntime";

const UserProfilePopup = lazy(() => import("@/components/modals/UserProfilePopup").then((m) => ({ default: m.UserProfilePopup })));

const AdminPage = () => {
  const navigate = useNavigate();
  const authEntryPath = getAuthEntryPath();
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);
  const activeModal = useUIStore((s) => s.activeModal);

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

  if (isLoading && !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-layout-chat app-layout-font discord-inspired">
        <KloakDrawLoader />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="h-screen overflow-hidden app-layout-font discord-inspired">
      <SEO title="Admin" noIndex />
      <AdminPanel />
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
