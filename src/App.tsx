import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { useMaintenanceMode } from "./hooks/useMaintenanceMode";
import { MaintenancePage } from "./components/MaintenancePage";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Invite from "./pages/Invite";
import AppLayout from "./pages/AppLayout";
import { ServerAuthGuard } from "./components/auth/ServerAuthGuard";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import Cookies from "./pages/Cookies";
import Philosophy from "./pages/Philosophy";
import Join from "./pages/Join";
import FAQ from "./pages/FAQ";
import Brand from "./pages/Brand";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const EmptyRoute = () => null;

const AppContent = () => {
  const { isMaintenance, loading } = useMaintenanceMode();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" />
      </div>
    );
  }

  if (isMaintenance) return <MaintenancePage />;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/invite/:inviteCode" element={<Invite />} />
        {/* Keep AppLayout mounted across /app navigation to avoid full remount/reconnect storms */}
        <Route path="/app" element={<AppLayout />}>
          <Route index element={<EmptyRoute />} />
          <Route path="friends" element={<EmptyRoute />} />
          <Route path="explore" element={<EmptyRoute />} />
          <Route path="servers/:serverId" element={<ServerAuthGuard><EmptyRoute /></ServerAuthGuard>} />
          <Route path="servers/:serverId/overview" element={<ServerAuthGuard><EmptyRoute /></ServerAuthGuard>} />
          <Route path="servers/:serverId/members" element={<ServerAuthGuard><EmptyRoute /></ServerAuthGuard>} />
          <Route path="servers/:serverId/channels/:channelId" element={<ServerAuthGuard><EmptyRoute /></ServerAuthGuard>} />
        </Route>
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/cookies" element={<Cookies />} />
        <Route path="/philosophy" element={<Philosophy />} />
        <Route path="/join" element={<Join />} />
        <Route path="/faq" element={<FAQ />} />
        <Route path="/brand" element={<Brand />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
};

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AppContent />
      </TooltipProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
