import { Clock, Smiley, X } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useUIStore } from "@/stores/uiStore";
import { useAuthStore } from "@/stores/authStore";
import { cn } from "@/lib/utils";

const COMMON_EMOJIS = [
 "\u{1F60A}",
 "\u{1F604}",
 "\u{1F3AE}",
 "\u{1F4BB}",
 "\u{1F3B5}",
 "\u{2615}",
 "\u{1F525}",
 "\u{2728}",
 "\u{1F4A4}",
 "\u{1F3E0}",
 "\u{1F4DA}",
 "\u{1F3AF}",
];

const CUSTOM_STATUS_MAX_LENGTH = 20;

const CLEAR_AFTER_OPTIONS = [
 { value: "never", label: "Don't clear" },
 { value: "30m", label: "30 minutes", ms: 30 * 60 * 1000 },
 { value: "1h", label: "1 hour", ms: 60 * 60 * 1000 },
 { value: "4h", label: "4 hours", ms: 4 * 60 * 60 * 1000 },
 { value: "today", label: "Today", ms: null },
 { value: "1d", label: "24 hours", ms: 24 * 60 * 60 * 1000 },
];

export const SetStatusModal = () => {
 const { activeModal, closeModal } = useUIStore();
 const { user, updateUser } = useAuthStore();
 const [customStatusText, setCustomStatusText] = useState("");
 const [selectedEmoji, setSelectedEmoji] = useState("");
 const [clearAfter, setClearAfter] = useState("never");
 const [showEmojiPicker, setShowEmojiPicker] = useState(false);
 const clearTimeoutRef = useRef<NodeJS.Timeout | null>(null);

 const isOpen = activeModal === "set-status";

 useEffect(() => {
 if (!isOpen) return;
 if (user?.custom_status) {
 const emojiMatch = user.custom_status.match(/^(\p{Emoji})\s*/u);
 if (emojiMatch) {
 setSelectedEmoji(emojiMatch[1]);
 setCustomStatusText(user.custom_status.slice(emojiMatch[0].length));
 } else {
 setSelectedEmoji("");
 setCustomStatusText(user.custom_status);
 }
 } else {
 setSelectedEmoji("");
 setCustomStatusText("");
 }
 setClearAfter("never");
 }, [isOpen, user?.custom_status]);

 useEffect(() => {
 return () => {
 if (clearTimeoutRef.current) clearTimeout(clearTimeoutRef.current);
 };
 }, []);

 const handleSaveCustomStatus = async () => {
 const fullStatus = selectedEmoji ? `${selectedEmoji} ${customStatusText}`.trim() : customStatusText.trim();
 await updateUser({ custom_status: fullStatus || null });

 if (clearAfter !== "never" && fullStatus) {
 const option = CLEAR_AFTER_OPTIONS.find((o) => o.value === clearAfter);
 if (option) {
 let timeout: number;
 if (clearAfter === "today") {
 const now = new Date();
 const endOfDay = new Date(now);
 endOfDay.setHours(23, 59, 59, 999);
 timeout = endOfDay.getTime() - now.getTime();
 } else {
 timeout = option.ms ?? 0;
 }

 if (clearTimeoutRef.current) clearTimeout(clearTimeoutRef.current);
 clearTimeoutRef.current = setTimeout(async () => {
 await updateUser({ custom_status: null });
 setCustomStatusText("");
 setSelectedEmoji("");
 setClearAfter("never");
 }, timeout);
 }
 }

 closeModal();
 };

 const handleClearCustomStatus = async () => {
 setCustomStatusText("");
 setSelectedEmoji("");
 setClearAfter("never");
 if (clearTimeoutRef.current) clearTimeout(clearTimeoutRef.current);
 await updateUser({ custom_status: null });
 };

 return (
 <Dialog open={isOpen} onOpenChange={(open) => !open && closeModal()}>
 <DialogContent className="sm:max-w-md">
 <DialogHeader>
 <DialogTitle>Set Custom Status</DialogTitle>
 </DialogHeader>
 <div className="space-y-4">
 <div className="flex items-center gap-2 rounded-md border border-input bg-background px-2.5 py-2">
 <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
 <PopoverTrigger asChild>
 <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 rounded-sm">
 {selectedEmoji || <Smiley className="h-4 w-4" />}
 </Button>
 </PopoverTrigger>
 <PopoverContent className="w-auto p-2" side="bottom" align="start">
 <div className="grid grid-cols-6 gap-1">
 {COMMON_EMOJIS.map((emoji) => (
 <button
 key={emoji}
 type="button"
 onClick={() => {
 setSelectedEmoji(emoji);
 setShowEmojiPicker(false);
 }}
 className={cn(
 "h-8 w-8 rounded text-lg transition-colors hover:bg-secondary",
 selectedEmoji === emoji && "bg-secondary",
 )}
 >
 {emoji}
 </button>
 ))}
 </div>
 {selectedEmoji && (
 <Button
 variant="ghost"
 size="sm"
 className="mt-2 w-full justify-start text-xs"
 onClick={() => {
 setSelectedEmoji("");
 setShowEmojiPicker(false);
 }}
 >
 <X className="mr-1 h-3 w-3" />
 Remove emoji
 </Button>
 )}
 </PopoverContent>
 </Popover>

 <Input
 placeholder="What's your status?"
 value={customStatusText}
 onChange={(event) => setCustomStatusText(event.target.value)}
 className="h-7 border-0 bg-transparent px-0 text-sm focus-visible:ring-0"
 maxLength={CUSTOM_STATUS_MAX_LENGTH}
 />
 </div>

 <div className="h-px w-full bg-border" />

 <div className="space-y-2">
 <p className="text-xs font-semibold text-muted-foreground">Clear status after</p>
 <Select value={clearAfter} onValueChange={setClearAfter}>
 <SelectTrigger className="h-9 text-sm">
 <div className="flex items-center gap-2">
 <Clock className="h-4 w-4 text-muted-foreground" />
 <SelectValue />
 </div>
 </SelectTrigger>
 <SelectContent>
 {CLEAR_AFTER_OPTIONS.map((option) => (
 <SelectItem key={option.value} value={option.value} className="text-sm">
 {option.label}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>

 <div className="flex items-center justify-end gap-2 pt-1">
 <Button
 variant="secondary"
 size="sm"
 onClick={handleClearCustomStatus}
 disabled={!user?.custom_status && !customStatusText && !selectedEmoji}
 >
 Clear
 </Button>
 <Button size="sm" onClick={handleSaveCustomStatus}>
 Save
 </Button>
 </div>
 </div>
 </DialogContent>
 </Dialog>
 );
};
