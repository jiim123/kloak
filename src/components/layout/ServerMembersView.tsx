import { useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ArrowUpDown, MessageSquare, MoreVertical, Plus, Search, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { useDMStore } from "@/stores/dmStore";
import { useServerStore } from "@/stores/serverStore";
import { useUIStore } from "@/stores/uiStore";
import { cn } from "@/lib/utils";
import { canModerate } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { useMemberPermissions } from "@/hooks/useMemberPermissions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ServerMember } from "@/types";

type SortMode = "joined_desc" | "joined_asc";

const getDisplayName = (m: ServerMember) =>
  m.nickname || m.user?.display_name || m.user?.username || "Unknown";

/** Label for the members table JOIN METHOD column from join_source + join_invite_code */
function getJoinMethodLabel(member: ServerMember): string {
  const source = member.join_source;
  if (source === "discover") return "Discover";
  if (source === "invite_link") return "Invite link";
  if (source === "invite" && member.join_invite_code) return member.join_invite_code;
  if (source === "invite") return "Invite";
  return "—";
}

export const ServerMembersView = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { openConversation } = useDMStore();
  const {
    currentServer,
    members,
    roles,
    assignRoleToMember,
    removeRoleFromMember,
  } = useServerStore();
  const { openModal } = useUIStore();
  const { hasPermission } = useMemberPermissions();

  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("joined_desc");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = !q
      ? members
      : members.filter((m) => {
          const name = getDisplayName(m).toLowerCase();
          const username = (m.user?.username || "").toLowerCase();
          return name.includes(q) || username.includes(q) || m.user_id.toLowerCase().includes(q);
        });

    const sorted = [...list].sort((a, b) => {
      const ta = a.joined_at ? new Date(a.joined_at).getTime() : 0;
      const tb = b.joined_at ? new Date(b.joined_at).getTime() : 0;
      return sortMode === "joined_desc" ? tb - ta : ta - tb;
    });

    return sorted;
  }, [members, query, sortMode]);

  const handleOpenProfile = (member: ServerMember) => {
    openModal("userProfile", { userId: member.user_id, user: member.user });
  };

  const handleMessage = async (member: ServerMember) => {
    if (!user) return;
    try {
      const conversation = await openConversation(user.id, member.user_id);
      if (conversation) {
        // Navigate using the app's built-in DM deep-link handler (avoids URL/store race with server routes)
        navigate(`/app?conversation=${conversation.id}`, { replace: true });
      }
    } catch (error) {
      console.error("Failed to open conversation:", error);
      toast.error("Failed to open conversation");
    }
  };

  if (!currentServer) return null;

  const currentUserMember = user ? members.find((m) => m.user_id === user.id) : undefined;
  const currentUserRole = currentUserMember?.role;

  const canManageRoles = hasPermission("manage_roles");
  const canKick = hasPermission("kick_members");
  const canBan = hasPermission("ban_members");
  const canMute = hasPermission("mute_members");
  const canChangeNickname = hasPermission("manage_nicknames");

  const handleChangeNickname = (member: ServerMember) => {
    openModal("changeNickname", { member });
  };

  const handleKick = (member: ServerMember) => {
    openModal("confirmAction", {
      action: "kick",
      member,
      title: `Kick ${member.nickname || member.user?.username}`,
      message: `Are you sure you want to kick ${member.nickname || member.user?.username} from the server?`,
    });
  };

  const handleBan = (member: ServerMember) => {
    openModal("confirmAction", {
      action: "ban",
      member,
      title: `Ban ${member.nickname || member.user?.username}`,
      message: `Are you sure you want to ban ${member.nickname || member.user?.username} from the server? They will not be able to rejoin.`,
    });
  };

  const handleToggleMute = (member: ServerMember) => {
    openModal("confirmAction", {
      action: member.is_muted ? "unmute" : "mute",
      member,
      title: member.is_muted
        ? `Unmute ${member.nickname || member.user?.username}`
        : `Mute ${member.nickname || member.user?.username}`,
      message: member.is_muted
        ? `Are you sure you want to unmute ${member.nickname || member.user?.username}?`
        : `Are you sure you want to mute ${member.nickname || member.user?.username}? They will be able to view but not send messages.`,
    });
  };

  const toggleRole = async (member: ServerMember, roleId: string) => {
    if (!user) return;
    const memberRoles = member.roles || [];
    const hasRole = memberRoles.some((r) => r.id === roleId);
    try {
      if (hasRole) {
        await removeRoleFromMember(member.id, roleId, user.id);
      } else {
        await assignRoleToMember(member.id, roleId, user.id);
      }
    } catch (error) {
      console.error("Failed to update roles:", error);
      toast.error("Failed to update roles");
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Recent Members</h2>
            <span className="text-sm text-muted-foreground">({members.length})</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by username or id"
                className="pl-9 w-64"
              />
            </div>

            <Button
              variant="secondary"
              className="gap-2"
              onClick={() => setSortMode((s) => (s === "joined_desc" ? "joined_asc" : "joined_desc"))}
            >
              <ArrowUpDown className="w-4 h-4" />
              Sort
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-border/50 bg-background/40 overflow-hidden">
          <Table>
            <TableHeader className="bg-secondary/20">
              <TableRow className="hover:bg-secondary/20">
                <TableHead>MEMBER</TableHead>
                <TableHead className="w-40">MEMBER SINCE</TableHead>
                <TableHead className="w-40">JOINED KLOAK</TableHead>
                <TableHead className="w-40">JOIN METHOD</TableHead>
                <TableHead className="w-56">ROLES</TableHead>
                <TableHead className="w-24 text-right">ACTIONS</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {filtered.map((member) => {
                const name = getDisplayName(member);
                const memberSince = member.joined_at ? new Date(member.joined_at) : null;
                const joinedKloak = member.user?.created_at ? new Date(member.user.created_at) : null;
                const memberRoles = member.roles || [];
                const isSelf = !!user && member.user_id === user.id;
                const canModerateMember = canModerate(currentUserRole, member.role) && !isSelf && member.role !== "owner";
                const showRoleEditor = canManageRoles && canModerateMember;
                const showKick = canKick && canModerateMember;
                const showBan = canBan && canModerateMember;
                const showMute = canMute && canModerateMember;
                const showChangeNickname = canChangeNickname && (canModerate(currentUserRole, member.role) || isSelf);

                return (
                  <TableRow key={member.id} className="hover:bg-secondary/30">
                    <TableCell className="min-w-[280px]">
                      <button
                        className="flex items-center gap-3 text-left w-full"
                        onClick={() => handleOpenProfile(member)}
                      >
                        <Avatar className="w-9 h-9">
                          <AvatarImage src={member.user?.avatar_url || undefined} />
                          <AvatarFallback style={{ backgroundColor: member.user?.banner_color || "#5865F2" }}>
                            {name?.[0]?.toUpperCase() || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="font-medium truncate">{name}</div>
                          <div className="text-xs text-muted-foreground truncate">{member.user?.username || member.user_id}</div>
                        </div>
                      </button>
                    </TableCell>

                    <TableCell className="text-sm text-muted-foreground">
                      {memberSince ? formatDistanceToNow(memberSince, { addSuffix: true }) : "—"}
                    </TableCell>

                    <TableCell className="text-sm text-muted-foreground">
                      {joinedKloak ? formatDistanceToNow(joinedKloak, { addSuffix: true }) : "—"}
                    </TableCell>

                    <TableCell>
                      <Badge variant="secondary" className="text-xs font-normal">
                        {getJoinMethodLabel(member)}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {memberRoles.length > 0 ? (
                          memberRoles.slice(0, 3).map((r) => (
                            <Badge
                              key={r.id}
                              variant="outline"
                              className={cn("text-[10px] px-1.5 py-0 h-5 font-medium border-0", r.color.startsWith("linear-gradient") ? "text-white" : "")}
                              style={
                                r.color.startsWith("linear-gradient")
                                  ? { background: r.color }
                                  : { backgroundColor: `${r.color}20`, color: r.color }
                              }
                            >
                              {r.name}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                        {memberRoles.length > 3 && (
                          <Badge variant="secondary" className="text-xs">
                            +{memberRoles.length - 3}
                          </Badge>
                        )}
                        {showRoleEditor && roles.length > 0 && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                title="Manage roles"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Plus className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-56">
                              {roles.map((role) => {
                                const hasRole = memberRoles.some((r) => r.id === role.id);
                                return (
                                  <DropdownMenuItem
                                    key={role.id}
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      toggleRole(member, role.id);
                                    }}
                                  >
                                    <div className="flex items-center gap-2 w-full">
                                      <div
                                        className="w-3 h-3 rounded-full flex-shrink-0"
                                        style={
                                          role.color.startsWith("linear-gradient")
                                            ? { background: role.color }
                                            : { backgroundColor: role.color }
                                        }
                                      />
                                      <span className="flex-1 truncate">{role.name}</span>
                                      {hasRole && <span className="text-xs text-muted-foreground">✓</span>}
                                    </div>
                                  </DropdownMenuItem>
                                );
                              })}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => handleMessage(member)}
                          title="Message"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              title="More"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem
                              onClick={() => handleOpenProfile(member)}
                            >
                              View profile
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleMessage(member)}
                            >
                              Message
                            </DropdownMenuItem>
                            {(showChangeNickname || showMute || showKick || showBan) && (
                              <DropdownMenuSeparator />
                            )}
                            {showChangeNickname && (
                              <DropdownMenuItem onClick={() => handleChangeNickname(member)}>
                                Change nickname
                              </DropdownMenuItem>
                            )}
                            {showMute && (
                              <DropdownMenuItem onClick={() => handleToggleMute(member)}>
                                {member.is_muted ? "Unmute" : "Mute"}
                              </DropdownMenuItem>
                            )}
                            {showKick && (
                              <DropdownMenuItem onClick={() => handleKick(member)}>
                                Kick
                              </DropdownMenuItem>
                            )}
                            {showBan && (
                              <DropdownMenuItem className="text-destructive" onClick={() => handleBan(member)}>
                                Ban
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}

              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    No members found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};

