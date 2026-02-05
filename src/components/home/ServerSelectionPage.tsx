import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Plus, Users, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useServerStore } from "@/stores/serverStore";
import { useUIStore } from "@/stores/uiStore";
import { useDMStore } from "@/stores/dmStore";

const getServerInitials = (name: string) => {
  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
};

const getServerColor = (name: string) => {
  const colors = [
    "bg-indigo-500", "bg-purple-500", "bg-pink-500", "bg-red-500", "bg-orange-500",
    "bg-amber-500", "bg-emerald-500", "bg-teal-500", "bg-cyan-500", "bg-blue-500",
  ];
  const index = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[index % colors.length];
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } },
};

export const ServerSelectionPage = () => {
  const navigate = useNavigate();
  const { servers, setCurrentServer } = useServerStore();
  const { openModal, closeServerSelection } = useUIStore();
  const { setCurrentConversation } = useDMStore();
  const [searchQuery, setSearchQuery] = useState("");

  // Get open tab server IDs from the global state
  const openTabServerIds = useMemo(() => {
    const tabState = (window as any).__kloakServerTabs;
    return tabState?.openTabServerIds || new Set<string>();
  }, []);

  // Filter servers not already in tabs
  const availableServers = useMemo(() => {
    return servers.filter((s) => !openTabServerIds.has(s.id));
  }, [servers, openTabServerIds]);

  // Filter by search query
  const filteredServers = useMemo(() => {
    if (!searchQuery.trim()) return availableServers;
    const query = searchQuery.toLowerCase();
    return availableServers.filter((s) => s.name.toLowerCase().includes(query));
  }, [availableServers, searchQuery]);

  const handleSelectServer = (serverId: string) => {
    const tabState = (window as any).__kloakServerTabs;
    if (tabState?.addServerToTabs) {
      tabState.addServerToTabs(serverId);
    }
    closeServerSelection();
  };

  const handleCreateServer = () => {
    closeServerSelection();
    openModal("create-server");
  };

  const handleJoinServer = () => {
    closeServerSelection();
    openModal("join-server");
  };

  const handleCancel = () => {
    closeServerSelection();
    navigate("/app");
  };

  return (
    <div className="h-full flex flex-col bg-layout-chat">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-border/30">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground">Select a Server</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Choose a server to open in a new tab
            </p>
          </div>

          {/* Search */}
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search servers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleJoinServer} className="gap-2">
              <Users className="w-4 h-4" />
              Join Server
            </Button>
            <Button onClick={handleCreateServer} className="gap-2">
              <Plus className="w-4 h-4" />
              Create Server
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {/* Available servers */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            Your Servers ({filteredServers.length})
          </h2>

          {filteredServers.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-secondary/50 flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">
                {searchQuery
                  ? "No servers match your search"
                  : "All your servers are already open in tabs"}
              </p>
            </div>
          ) : (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
            >
              {filteredServers.map((server) => (
                <motion.button
                  key={server.id}
                  variants={itemVariants}
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleSelectServer(server.id)}
                  className="flex items-center gap-4 p-4 rounded-xl border border-border/50 bg-secondary/30 hover:bg-secondary/50 hover:border-primary/30 transition-all text-left"
                >
                  <div
                    className={cn(
                      "w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center",
                      !server.icon_url && getServerColor(server.name)
                    )}
                  >
                    {server.icon_url ? (
                      <Avatar className="w-12 h-12 border-0 rounded-xl">
                        <AvatarImage src={server.icon_url} alt={server.name} className="object-cover" />
                        <AvatarFallback className={cn("rounded-xl", getServerColor(server.name))}>
                          {getServerInitials(server.name)}
                        </AvatarFallback>
                      </Avatar>
                    ) : (
                      <span className="text-sm font-bold text-white">
                        {getServerInitials(server.name)}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-foreground truncate">{server.name}</div>
                    <div className="text-sm text-muted-foreground capitalize">{server.role}</div>
                  </div>
                </motion.button>
              ))}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};
