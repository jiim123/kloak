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
                      style={{ backgroundColor: "#15171C", color: "#FFFFFF" }}
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

          {!hasAnnouncements && recentForumActivity.length === 0 && (
            <div className="mt-6 flex min-h-[220px] flex-col items-center justify-center rounded-[8px] px-6 py-10 text-center">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="mb-4 h-16 w-16 text-muted-foreground/50"
                aria-hidden="true"
              >
                <path
                  d="M14.5 7.5H16.1C16.9401 7.5 17.3601 7.5 17.681 7.66349C17.9632 7.8073 18.1927 8.03677 18.3365 8.31901C18.5 8.63988 18.5 9.05992 18.5 9.9V17.5C18.5 18.6046 17.6046 19.5 16.5 19.5V19.5C15.3954 19.5 14.5 18.6046 14.5 17.5V7.7C14.5 6.57989 14.5 6.01984 14.282 5.59202C14.0903 5.21569 13.7843 4.90973 13.408 4.71799C12.9802 4.5 12.4201 4.5 11.3 4.5H7.7C6.57989 4.5 6.01984 4.5 5.59202 4.71799C5.21569 4.90973 4.90973 5.21569 4.71799 5.59202C4.5 6.01984 4.5 6.5799 4.5 7.7V16.3C4.5 17.4201 4.5 17.9802 4.71799 18.408C4.90973 18.7843 5.21569 19.0903 5.59202 19.282C6.01984 19.5 6.5799 19.5 7.7 19.5H16.5"
                  stroke="currentColor"
                />
                <path
                  d="M11 6.5H8C7.53406 6.5 7.30109 6.5 7.11732 6.57612C6.87229 6.67761 6.67761 6.87229 6.57612 7.11732C6.5 7.30109 6.5 7.53406 6.5 8C6.5 8.46594 6.5 8.69891 6.57612 8.88268C6.67761 9.12771 6.87229 9.32239 7.11732 9.42388C7.30109 9.5 7.53406 9.5 8 9.5H11C11.4659 9.5 11.6989 9.5 11.8827 9.42388C12.1277 9.32239 12.3224 9.12771 12.4239 8.88268C12.5 8.69891 12.5 8.46594 12.5 8C12.5 7.53406 12.5 7.30109 12.4239 7.11732C12.3224 6.87229 12.1277 6.67761 11.8827 6.57612C11.6989 6.5 11.4659 6.5 11 6.5Z"
                  stroke="currentColor"
                />
                <path d="M6.5 11.5H12.5" stroke="currentColor" strokeLinecap="round" />
                <path d="M6.5 13.5H12.5" stroke="currentColor" strokeLinecap="round" />
                <path d="M6.5 15.5H12.5" stroke="currentColor" strokeLinecap="round" />
                <path d="M6.5 17.5H10.5" stroke="currentColor" strokeLinecap="round" />
              </svg>
              <p className="text-sm font-medium text-foreground">Nothing to show yet</p>
              <p className="mt-1 text-xs text-muted-foreground">Announcements and forum activity will appear here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
