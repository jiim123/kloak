import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Invite from "./pages/Invite";
import AppLayout from "./pages/AppLayout";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import Cookies from "./pages/Cookies";
import Philosophy from "./pages/Philosophy";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const EmptyRoute = () => null;

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
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
              <Route path="servers/:serverId" element={<EmptyRoute />} />
              <Route path="servers/:serverId/overview" element={<EmptyRoute />} />
              <Route path="servers/:serverId/members" element={<EmptyRoute />} />
              <Route path="servers/:serverId/channels/:channelId" element={<EmptyRoute />} />
            </Route>
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/cookies" element={<Cookies />} />
            <Route path="/philosophy" element={<Philosophy />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
