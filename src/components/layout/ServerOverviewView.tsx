import { useMemo, useState, useEffect } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { CalendarDays, Crown, Hash, Users, Megaphone } from "lucide-react";
import { useServerStore } from "@/stores/serverStore";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import type { Message, User } from "@/types";

interface AnnouncementCard {
  id: string;
  content: string;
  created_at: string;
  user: User;
  channel_id: string;
  channel_name: string;
}

export const ServerOverviewView = () => {
  const { currentServer, members, channels } = useServerStore();
  const navigate = useNavigate();
  const [recentAnnouncements, setRecentAnnouncements] = useState<AnnouncementCard[]>([]);
  const [isLoadingAnnouncements, setIsLoadingAnnouncements] = useState(false);

  const ownerMember = useMemo(() => {
    if (!currentServer) return null;
    return (
      members.find((m) => m.user_id === currentServer.owner_id) ||
      members.find((m) => m.role === "owner") ||
      null
    );
  }, [currentServer, members]);

  // Fetch recent announcements
  useEffect(() => {
    if (!currentServer) return;

    const fetchAnnouncements = async () => {
      setIsLoadingAnnouncements(true);
      try {
        // Get all announcement channels for this server
        const announcementChannels = channels.filter(c => c.type === 'announcement');
        if (announcementChannels.length === 0) {
          setRecentAnnouncements([]);
          setIsLoadingAnnouncements(false);
          return;
        }

        const channelIds = announcementChannels.map(c => c.id);

        // Fetch recent messages from announcement channels
        const { data: messagesData, error } = await supabase
          .from('messages')
          .select(`
            id,
            content,
            created_at,
            channel_id,
            user:users (*)
          `)
          .in('channel_id', channelIds)
          .order('created_at', { ascending: false })
          .limit(5);

        if (error) throw error;

        // Map messages to announcement cards with channel names
        const announcements: AnnouncementCard[] = (messagesData || []).map((msg: any) => {
          const channel = announcementChannels.find(c => c.id === msg.channel_id);
          // Extract title from content (first line before double newline, or first line)
          const content = msg.content || "";
          const parts = content.split('\n\n');
          const title = parts.length > 1 
            ? parts[0].trim() 
            : content.split('\n')[0].trim() || "Announcement";
          
          return {
            id: msg.id,
            content: title,
            created_at: msg.created_at,
            user: msg.user,
            channel_id: msg.channel_id,
            channel_name: channel?.name || 'Announcements',
          };
        });

        setRecentAnnouncements(announcements);
      } catch (error) {
        console.error('Failed to fetch announcements:', error);
      } finally {
        setIsLoadingAnnouncements(false);
      }
    };

    fetchAnnouncements();
  }, [currentServer, channels]);

  if (!currentServer) return null;

  const createdAt = currentServer.created_at ? new Date(currentServer.created_at) : null;
  const ownerName =
    ownerMember?.nickname ||
    ownerMember?.user?.display_name ||
    ownerMember?.user?.username ||
    "Unknown";

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-background/40">
          {currentServer.banner_url ? (
            <div className="relative h-40 sm:h-56">
              <img
                src={currentServer.banner_url}
                alt={`${currentServer.name} banner`}
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/90" />
            </div>
          ) : (
            <div className="h-24 sm:h-28 bg-secondary/30" />
          )}

          <div className={cn("p-5 sm:p-6 flex items-center gap-4", currentServer.banner_url && "-mt-10 sm:-mt-12 relative")}>
            <Avatar className="w-16 h-16 rounded-2xl ring-2 ring-background/80 shadow-lg">
              <AvatarImage src={currentServer.icon_url || undefined} />
              <AvatarFallback className="rounded-2xl" style={{ backgroundColor: "#5865F2" }}>
                {currentServer.name?.[0]?.toUpperCase() || "S"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-semibold truncate">{currentServer.name}</h1>
                <Badge variant="secondary" className="text-xs">
                  Overview
                </Badge>
              </div>
              <div className="mt-1 flex items-center gap-4 flex-wrap text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Users className="w-4 h-4" />
                  {members.length} member{members.length === 1 ? "" : "s"}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Hash className="w-4 h-4" />
                  {channels.length} channel{channels.length === 1 ? "" : "s"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {currentServer.about && (
          <div className="rounded-2xl border border-border/50 bg-background/40 p-5">
            <div className="text-sm font-medium mb-2">About</div>
            <div className="text-sm text-muted-foreground whitespace-pre-wrap">{currentServer.about}</div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-border/50 bg-background/40 p-5">
            <div className="flex items-center gap-2 text-sm font-medium">
              <CalendarDays className="w-4 h-4 text-muted-foreground" />
              Created
            </div>
            <div className="mt-2 text-sm text-muted-foreground">
              {createdAt ? (
                <>
                  <div className="text-foreground font-medium">{format(createdAt, "PPP")}</div>
                  <div className="text-xs">
                    {formatDistanceToNow(createdAt, { addSuffix: true })}
                  </div>
                </>
              ) : (
                <div className="text-xs">—</div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-border/50 bg-background/40 p-5">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Crown className="w-4 h-4 text-yellow-500" />
              Owner
            </div>
            <div className="mt-3 flex items-center gap-3">
              <Avatar className="w-10 h-10">
                <AvatarImage src={ownerMember?.user?.avatar_url || undefined} />
                <AvatarFallback style={{ backgroundColor: ownerMember?.user?.banner_color || "#5865F2" }}>
                  {ownerName?.[0]?.toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{ownerName}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {ownerMember?.user?.username ? `@${ownerMember.user.username}` : "—"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Announcements */}
        {recentAnnouncements.length > 0 && (
          <div className="rounded-2xl border border-border/50 bg-background/40 p-5">
            <div className="flex items-center gap-2 text-sm font-medium mb-4">
              <Megaphone className="w-4 h-4 text-muted-foreground" />
              Recent Announcements
            </div>
            <div className="space-y-3">
              {recentAnnouncements.map((announcement) => (
                <button
                  key={announcement.id}
                  onClick={() => navigate(`/app/servers/${currentServer.id}/channels/${announcement.channel_id}`)}
                  className="w-full text-left p-3 rounded-lg border border-border/50 bg-background/50 hover:bg-background/80 hover:border-border transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="w-8 h-8 flex-shrink-0">
                      <AvatarImage src={announcement.user?.avatar_url} />
                      <AvatarFallback style={{ backgroundColor: announcement.user?.banner_color || "#5865F2" }}>
                        {announcement.user?.username?.[0]?.toUpperCase() || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium truncate">
                          {announcement.user?.display_name || announcement.user?.username || "Unknown"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          in #{announcement.channel_name}
                        </span>
                      </div>
                      <p className="text-sm text-foreground line-clamp-2 mb-1">
                        {announcement.content}
                      </p>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(announcement.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

