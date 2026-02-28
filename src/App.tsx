import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import Index from "./pages/Index";

// Lazy-load all non-landing routes for code splitting
const Auth = lazy(() => import("./pages/Auth"));
const Invite = lazy(() => import("./pages/Invite"));
const AppLayout = lazy(() => import("./pages/AppLayout"));
const ServerAuthGuard = lazy(() => import("./components/auth/ServerAuthGuard").then(m => ({ default: m.ServerAuthGuard })));
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Cookies = lazy(() => import("./pages/Cookies"));
const Join = lazy(() => import("./pages/Join"));
const FAQ = lazy(() => import("./pages/FAQ"));
const Brand = lazy(() => import("./pages/Brand"));
const About = lazy(() => import("./pages/About"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const EmptyRoute = () => null;

const AppContent = () => {
  return (
    <BrowserRouter>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/invite/:inviteCode" element={<Invite />} />
          {/* Keep AppLayout mounted across /app navigation to avoid full remount/reconnect storms */}
          <Route path="/app" element={<AppLayout />}>
            <Route index element={<EmptyRoute />} />
            <Route path="friends" element={<EmptyRoute />} />
            <Route path="explore" element={<EmptyRoute />} />
            <Route path="servers/:serverId" element={<Suspense fallback={null}><ServerAuthGuard><EmptyRoute /></ServerAuthGuard></Suspense>} />
            <Route path="servers/:serverId/overview" element={<Suspense fallback={null}><ServerAuthGuard><EmptyRoute /></ServerAuthGuard></Suspense>} />
            <Route path="servers/:serverId/members" element={<Suspense fallback={null}><ServerAuthGuard><EmptyRoute /></ServerAuthGuard></Suspense>} />
            <Route path="servers/:serverId/channels/:channelId" element={<Suspense fallback={null}><ServerAuthGuard><EmptyRoute /></ServerAuthGuard></Suspense>} />
          </Route>
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/cookies" element={<Cookies />} />
          
          <Route path="/join" element={<Join />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/brand" element={<Brand />} />
          <Route path="/about" element={<About />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
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
