import { useState, useEffect } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { useServerStore } from "@/stores/serverStore";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuthStore } from "@/stores/authStore";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import type { User } from "@/types";
import { stripMarkdown } from "@/lib/message";

interface AnnouncementCard {
  id: string;
  content: string;
  created_at: string;
  user: User;
  channel_id: string;
  channel_name: string;
}

interface ForumActivityCard {
  id: string;
  title: string;
  reply_count: number;
  last_activity: string;
  channel_id: string;
  channel_name: string;
}

export const ServerOverviewView = () => {
  const { currentServer, members, channels } = useServerStore();
  const userId = useAuthStore((s) => s.user?.id);
  const navigate = useNavigate();
  const [recentAnnouncements, setRecentAnnouncements] = useState<AnnouncementCard[]>([]);
  const [recentForumActivity, setRecentForumActivity] = useState<ForumActivityCard[]>([]);

  useEffect(() => {
    if (!currentServer || !userId) return;
    const fetchAnnouncements = async () => {
      try {
        const announcementChannels = channels.filter((c) => c.type === "announcement");
        if (announcementChannels.length === 0) {
          setRecentAnnouncements([]);
          return;
        }
        const { data: messagesData, error } = await supabase.rpc("get_server_recent_announcements_secure", {
          _server_id: currentServer.id,
          _user_id: userId,
          _limit: 5,
        });
        if (error) throw error;
        // Build maps for formatting mentions/channels in previews
        const usersMap = new Map<string, { username: string; display_name?: string | null; nickname?: string | null }>();
        members.forEach((m) => {
          if (m.user) {
            usersMap.set(m.user_id, {
              username: (m.user as User).username,
              display_name: (m.user as User).display_name,
              nickname: m.nickname,
            });
          }
        });
        const channelsMap = new Map<string, { name: string }>();
        channels.forEach((ch) => channelsMap.set(ch.id, { name: ch.name }));

        const announcements: AnnouncementCard[] = (Array.isArray(messagesData) ? messagesData : []).map((msg: any) => {
          const raw = msg.content || "";
          const stripped = stripMarkdown(raw, usersMap, channelsMap);
          const parts = stripped.split("\n\n");
          const title = parts.length > 1 ? parts[0].trim() : stripped.split("\n")[0].trim() || "Announcement";
          return {
            id: msg.id,
            content: title,
            created_at: msg.created_at,
            user: msg.user,
            channel_id: msg.channel_id,
            channel_name: msg.channel_name || "Announcements",
          };
        });
        setRecentAnnouncements(announcements);
      } catch (error) {
        console.error("Failed to fetch announcements:", error);
      }
    };
    fetchAnnouncements();
  }, [currentServer, channels, userId]);

  useEffect(() => {
    if (!currentServer || !userId) return;
    const fetchForumActivity = async () => {
      try {
        const forumChannels = channels.filter((c) => c.type === "forum");
        if (forumChannels.length === 0) {
          setRecentForumActivity([]);
          return;
        }

        const forumChannelIds = forumChannels.map((c) => c.id);
        const channelNameById = new Map<string, string>();
        forumChannels.forEach((c) => channelNameById.set(c.id, c.name));

        const { data: threadsData, error: threadsError } = await supabase
          .from("threads")
          .select("id, message_id, channel_id, created_at")
          .in("channel_id", forumChannelIds)
          .order("created_at", { ascending: false })
          .limit(12);
        if (threadsError) throw threadsError;

        const threads = Array.isArray(threadsData) ? threadsData : [];
        if (threads.length === 0) {
          setRecentForumActivity([]);
          return;
        }

        const messageIds = threads.map((t: any) => t.message_id).filter(Boolean);
        const threadIds = threads.map((t: any) => t.id).filter(Boolean);

        const { data: messagesData, error: messagesError } = await supabase.rpc("get_messages_by_ids_secure", {
          _message_ids: messageIds,
          _user_id: userId,
          _blocked_user_ids: [],
        });
        if (messagesError) throw messagesError;

        const { data: summaryData, error: summaryError } = await (supabase.rpc as any)("get_thread_summaries", {
          _thread_ids: threadIds,
        });
        if (summaryError) throw summaryError;

        const rawSummaries = typeof summaryData === "string" ? JSON.parse(summaryData) : summaryData;
        const summaryByThreadId = new Map<string, any>();
        if (Array.isArray(rawSummaries)) {
          rawSummaries.forEach((s: any) => {
            if (s?.thread_id) summaryByThreadId.set(s.thread_id, s);
          });
        }

        const messageById = new Map<string, any>();
        (Array.isArray(messagesData) ? messagesData : []).forEach((m: any) => {
          if (m?.id) messageById.set(m.id, m);
        });

        const activityCards: ForumActivityCard[] = threads
          .map((thread: any) => {
            const message = messageById.get(thread.message_id);
            const summary = summaryByThreadId.get(thread.id);
            const usersMap = new Map<string, { username: string; display_name?: string | null; nickname?: string | null }>();
            members.forEach((m) => {
              if (m.user) {
                usersMap.set(m.user_id, {
                  username: (m.user as User).username,
                  display_name: (m.user as User).display_name,
                  nickname: m.nickname,
                });
              }
            });
            const channelsMap = new Map<string, { name: string }>();
            channels.forEach((ch) => channelsMap.set(ch.id, { name: ch.name }));

            const rawContent = message?.content || "";
            const plain = stripMarkdown(rawContent, usersMap, channelsMap);
            const title = (plain.split("\n")[0] || "Forum thread").trim();
            const messageCount = Number(summary?.message_count ?? 0);
            const replyCount = Math.max(messageCount - 1, 0);
            const lastActivity = summary?.last_activity || thread.created_at;

            return {
              id: thread.id,
              title,
              reply_count: replyCount,
              last_activity: lastActivity,
              channel_id: thread.channel_id,
              channel_name: channelNameById.get(thread.channel_id) || "forum",
            };
          })
          .filter((item) => item.title.length > 0)
          .sort((a, b) => new Date(b.last_activity).getTime() - new Date(a.last_activity).getTime())
          .slice(0, 4);

        setRecentForumActivity(activityCards);
      } catch (error) {
        console.error("Failed to fetch forum activity:", error);
        setRecentForumActivity([]);
      }
    };

    void fetchForumActivity();
  }, [currentServer, channels, userId, members]);

  if (!currentServer) return null;

  const hasAnnouncements = recentAnnouncements.length > 0;
  return (
    <div className="h-full overflow-y-auto bg-layout-members">
      <div className="space-y-4">
        <div className="overflow-hidden border-b border-border/50">
              {currentServer.banner_url ? (
                <div className="relative h-44 sm:h-56">
                  <img
                    src={currentServer.banner_url}
                    alt={`${currentServer.name} banner`}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="h-44 sm:h-56 bg-[#10131b]" />
              )}
              <div className="relative px-5 pb-6 pt-0 text-center">
                <div className="-mt-16 sm:-mt-20 flex justify-center">
                  <Avatar className="w-28 h-28 rounded-xl bg-[#191c25] ring-[6px] ring-[#34363D]">
                    <AvatarImage src={currentServer.icon_url || undefined} className="rounded-xl object-cover" />
                    <AvatarFallback
                      className="rounded-xl text-3xl font-semibold"
                      style={{ backgroundColor: "#f3c418", color: "#111827" }}
                    >
                      {currentServer.name?.[0]?.toUpperCase() || "S"}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <div className="mx-auto mt-3 max-w-4xl">
                  <h1 className="text-3xl font-semibold text-white truncate">{currentServer.name}</h1>
                </div>
                <p className="mx-auto mt-1 max-w-3xl px-4 text-sm leading-6 text-white/80 line-clamp-2 sm:text-base">
                  {currentServer.about?.trim() || `Official ${currentServer.name}`}
                </p>
              </div>
        </div>

        <div className="mx-auto w-full max-w-6xl px-4 pb-4 sm:px-6 sm:pb-6">
          {hasAnnouncements && (
            <>
              <div className="flex items-center gap-2 mb-3">
                <div className="text-sm font-semibold">Latest announcements</div>
                <button
                  type="button"
                  onClick={() =>
                    recentAnnouncements[0] &&
                    navigate(`/app/servers/${currentServer.id}/channels/${recentAnnouncements[0].channel_id}`)
                  }
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  See all
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {recentAnnouncements.slice(0, 4).map((announcement) => (
                  <button
                    key={announcement.id}
                    onClick={() => navigate(`/app/servers/${currentServer.id}/channels/${announcement.channel_id}`)}
                    className="min-h-[96px] w-full text-left rounded-md border border-border/40 bg-[#2F3138] p-4 hover:bg-[#393C46] transition-colors"
                  >
                    <div className="text-[15px] font-semibold leading-6 line-clamp-2">{announcement.content}</div>
                    <div className="mt-2 text-xs text-muted-foreground/90">
                      {formatDistanceToNow(new Date(announcement.created_at), { addSuffix: true })}
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground/90 min-w-0">
                      <Avatar className="w-4 h-4 flex-shrink-0">
                        <AvatarImage src={announcement.user?.avatar_url} />
                        <AvatarFallback style={{ backgroundColor: announcement.user?.banner_color || "#5865F2" }} />
                      </Avatar>
                      <span className="truncate opacity-90">in #{announcement.channel_name}</span>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}

          {recentForumActivity.length > 0 && (
            <>
              <div className="flex items-center gap-2 mt-6 mb-3">
                <div className="text-sm font-semibold">Recent forum activity</div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {recentForumActivity.map((thread) => (
                  <button
                    key={thread.id}
                    onClick={() => navigate(`/app/servers/${currentServer.id}/channels/${thread.channel_id}`)}
                    className="min-h-[104px] w-full text-left rounded-md border border-border/40 bg-[#2F3138] p-4 hover:bg-[#393C46] transition-colors"
                  >
                    <div className="text-[15px] font-semibold leading-6 line-clamp-2">{thread.title}</div>
                    <div className="mt-1 text-sm text-muted-foreground/95">
                      {thread.reply_count} {thread.reply_count === 1 ? "reply" : "replies"}
                    </div>
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground/90 truncate">
                      <Avatar className="w-4 h-4 flex-shrink-0">
                        <AvatarImage src={currentServer.icon_url || undefined} />
                        <AvatarFallback style={{ backgroundColor: "#5865F2" }} />
                      </Avatar>
                      <span className="truncate">
                        {formatDistanceToNow(new Date(thread.last_activity), { addSuffix: true })}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
