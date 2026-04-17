import { Check, CircleNotch, MagnifyingGlass, User as User, UserPlus, X } from "@phosphor-icons/react";
import { useState, useEffect, useMemo } from "react";
import { useServerStore } from "@/stores/serverStore";
import { useAuthStore } from "@/stores/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AvatarWithDecoration } from "@/components/ui/avatar-with-decoration";

import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { ChannelMember, ServerMember, User } from "@/types";

interface ChannelMembersEditorProps {
 channelId: string;
 serverId: string;
 onClose: () => void;
}

export const ChannelMembersEditor = ({ channelId, serverId, onClose }: ChannelMembersEditorProps) => {
 const { user } = useAuthStore();
 const { 
 members: serverMembers, 
 channelMembers,
 fetchChannelMembers,
 addChannelMember,
 removeChannelMember,
 } = useServerStore();

 const [searchQuery, setSearchQuery] = useState("");
 const [isLoading, setIsLoading] = useState(true);
 const [addingMember, setAddingMember] = useState<string | null>(null);
 const [removingMember, setRemovingMember] = useState<string | null>(null);

 // Get members for this channel
 const channelMemberData = channelMembers.find(cm => cm.channelId === channelId);
 const currentChannelMembers = channelMemberData?.members || [];
 const memberUserIds = new Set(currentChannelMembers.map(m => m.user_id));

 // Fetch channel members on mount
 useEffect(() => {
 const loadMembers = async () => {
 setIsLoading(true);
 await fetchChannelMembers(channelId);
 setIsLoading(false);
 };
 loadMembers();
 }, [channelId, fetchChannelMembers]);

 // Filter server members who are NOT in the channel
 const availableMembers = useMemo(() => {
 return serverMembers.filter(member => {
 if (memberUserIds.has(member.user_id)) return false;
 if (!member.user) return false;
 
 const searchLower = searchQuery.toLowerCase();
 const username = member.user.username?.toLowerCase() || "";
 const displayName = member.user.display_name?.toLowerCase() || "";
 
 return username.includes(searchLower) || displayName.includes(searchLower);
 });
 }, [serverMembers, memberUserIds, searchQuery]);

 const handleAddMember = async (targetUserId: string) => {
 if (!user) return;
 
 setAddingMember(targetUserId);
 const success = await addChannelMember(channelId, targetUserId, user.id);
 
 if (success) {
 toast.success("Member added to channel");
 } else {
 toast.error("Failed to add member");
 }
 
 setAddingMember(null);
 };

 const handleRemoveMember = async (targetUserId: string) => {
 if (!user) return;
 
 setRemovingMember(targetUserId);
 const success = await removeChannelMember(channelId, targetUserId, user.id);
 
 if (success) {
 toast.success("Member removed from channel");
 } else {
 toast.error("Failed to remove member");
 }
 
 setRemovingMember(null);
 };

 if (isLoading) {
 return (
 <div className="flex flex-col items-center justify-center py-12 text-center">
 <div className="w-12 h-12 rounded-xl bg-secondary/80 flex items-center justify-center mb-4">
 <CircleNotch className="w-6 h-6 text-muted-foreground animate-spin" />
 </div>
 <p className="text-sm text-muted-foreground">Loading members...</p>
 </div>
 );
 }

 return (
 <div className="space-y-6">
 {/* Current Members */}
 <div className="space-y-3">
 <div className="flex items-center justify-between">
 <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
 Channel Members ({currentChannelMembers.length})
 </h3>
 </div>

 {currentChannelMembers.length === 0 ? (
 <div className="p-4 rounded-xl bg-secondary/30 border border-border/50 text-center">
 <p className="text-sm text-muted-foreground">No members yet. Add members below.</p>
 </div>
 ) : (
 <ScrollArea className="max-h-[200px]">
 <div className="space-y-2">
 {currentChannelMembers.map((member) => (
 <div
 key={member.id}
 className="flex items-center gap-3 p-3 rounded-xl bg-secondary/30 border border-border/50"
 >
 <AvatarWithDecoration user={member.user} size={32} freezeGifUntilHover />
 <div className="flex-1 min-w-0">
 <p className="text-sm font-medium truncate">
 {member.user?.display_name || member.user?.username || "Unknown"}
 </p>
 <p className="text-xs text-muted-foreground truncate">
 @{member.user?.username || "unknown"}
 </p>
 </div>
 <Button
 variant="ghost"
 size="sm"
 onClick={() => handleRemoveMember(member.user_id)}
 disabled={removingMember === member.user_id}
 className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
 >
 {removingMember === member.user_id ? (
 <CircleNotch className="w-4 h-4 animate-spin" />
 ) : (
 <X className="w-4 h-4" />
 )}
 </Button>
 </div>
 ))}
 </div>
 </ScrollArea>
 )}
 </div>

 {/* Add Members */}
 <div className="space-y-3">
 <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
 Add Members
 </h3>

 {/* MagnifyingGlass */}
 <div className="relative">
 <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
 <Input
 placeholder="MagnifyingGlass server members..."
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 className="pl-10 h-10 rounded-xl border-border/50 bg-secondary/30"
 />
 </div>

 {/* Available members */}
 <ScrollArea className="max-h-[250px]">
 {availableMembers.length === 0 ? (
 <div className="p-4 rounded-xl bg-secondary/30 border border-border/50 text-center">
 <p className="text-sm text-muted-foreground">
 {searchQuery ? "No members found" : "All server members are already in this channel"}
 </p>
 </div>
 ) : (
 <div className="space-y-2">
 {availableMembers.map((member) => (
 <div
 key={member.id}
 className="flex items-center gap-3 p-3 rounded-xl bg-secondary/30 border border-border/50 hover:bg-secondary/50 transition-colors"
 >
 <AvatarWithDecoration user={member.user} size={32} freezeGifUntilHover />
 <div className="flex-1 min-w-0">
 <p className="text-sm font-medium truncate">
 {member.user?.display_name || member.user?.username || "Unknown"}
 </p>
 <p className="text-xs text-muted-foreground truncate">
 @{member.user?.username || "unknown"}
 </p>
 </div>
 <Button
 variant="secondary"
 size="sm"
 onClick={() => handleAddMember(member.user_id)}
 disabled={addingMember === member.user_id}
 className="h-8 rounded-lg"
 >
 {addingMember === member.user_id ? (
 <CircleNotch className="w-4 h-4 animate-spin" />
 ) : (
 <>
 <UserPlus className="w-4 h-4 mr-1" />
 Add
 </>
 )}
 </Button>
 </div>
 ))}
 </div>
 )}
 </ScrollArea>
 </div>

 {/* Footer */}
 <div className="flex gap-3 pt-4">
 <Button variant="outline" onClick={onClose} className="flex-1 h-11 rounded-xl">
 Done
 </Button>
 </div>
 </div>
 );
};
