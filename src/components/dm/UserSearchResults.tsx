import { useState, useEffect, useRef } from "react";
import { UserPlus, Check, Clock, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { AvatarWithDecoration } from "@/components/ui/avatar-with-decoration";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/authStore";
import { useFriendStore } from "@/stores/friendStore";
import { getEffectivePresence } from "@/lib/presence";
import type { UserStatus } from "@/types";

interface SearchResult {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  avatar_decoration: string | null;
  status: string | null;
  last_seen: string | null;
}

interface UserSearchResultsProps {
  query: string;
}

export const UserSearchResults = ({ query }: UserSearchResultsProps) => {
  const { user } = useAuthStore();
  const { friends, pendingRequests, outgoingRequests, sendRequest } = useFriendStore();
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<Set<string>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query || query.length < 2 || !user?.id) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    debounceRef.current = setTimeout(async () => {
      const { data, error } = await supabase.rpc("search_users_by_username", {
        _query: query,
        _requesting_user_id: user.id,
        _limit: 8,
      });

      if (!error && data) {
        setResults(data as SearchResult[]);
      } else {
        setResults([]);
      }
      setIsSearching(false);
    }, 350);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, user?.id]);

  // Reset sent state when query changes
  useEffect(() => {
    setSentTo(new Set());
  }, [query]);

  if (!query || query.length < 2) return null;

  const getFriendshipStatus = (userId: string) => {
    if (friends.some(f => f.id === userId)) return "friends";
    if (outgoingRequests.some(f => f.id === userId)) return "pending_outgoing";
    if (pendingRequests.some(f => f.id === userId)) return "pending_incoming";
    if (sentTo.has(userId)) return "just_sent";
    return null;
  };

  const handleSendRequest = async (targetUser: SearchResult) => {
    if (!user?.id) return;
    setSendingTo(targetUser.id);
    const success = await sendRequest(user.id, targetUser.username);
    if (success) {
      setSentTo(prev => new Set(prev).add(targetUser.id));
    }
    setSendingTo(null);
  };

  const getStatusClass = (status?: string) => {
    switch (status) {
      case "online": return "status-online";
      case "idle": return "status-idle";
      case "dnd": return "status-dnd";
      default: return "status-offline";
    }
  };

  if (isSearching) {
    return (
      <div className="px-4 py-3 flex items-center gap-2 text-muted-foreground text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Searching users…</span>
      </div>
    );
  }

  if (results.length === 0) return null;

  return (
    <div className="px-2 pb-1">
      <h3 className="px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Users
      </h3>
      {results.map((result) => {
        const status = getFriendshipStatus(result.id);
        const presence = getEffectivePresence(
          (result.status as UserStatus) || "offline",
          result.last_seen,
          result.id,
        );

        return (
          <div
            key={result.id}
            className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-secondary/50 transition-smooth"
          >
            <div className="relative flex-shrink-0">
              <AvatarWithDecoration
                user={{
                  username: result.username,
                  display_name: result.display_name,
                  avatar_url: result.avatar_url,
                  avatar_decoration: result.avatar_decoration,
                } as any}
                className="w-8 h-8"
                freezeGifUntilHover
              />
              <div
                className={cn(
                  "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-layout-sidebar-secondary",
                  getStatusClass(presence.status),
                )}
              />
            </div>

            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium text-foreground truncate block">
                {result.display_name || result.username}
              </span>
              {result.display_name && (
                <span className="text-xs text-muted-foreground truncate block">
                  {result.username}
                </span>
              )}
            </div>

            {status === "friends" ? (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Friends
              </span>
            ) : status === "pending_outgoing" || status === "just_sent" ? (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Pending
              </span>
            ) : status === "pending_incoming" ? (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Accept?
              </span>
            ) : (
              <Button
                variant="ghost"
                size="icon-sm"
                className="h-7 w-7"
                onClick={() => handleSendRequest(result)}
                disabled={sendingTo === result.id}
                title="Send friend request"
              >
                {sendingTo === result.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <UserPlus className="w-4 h-4" />
                )}
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
};
