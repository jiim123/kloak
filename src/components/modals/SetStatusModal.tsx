import { useEffect, useRef, useState } from "react";
import { Clock3, Smile, X } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
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
const MODAL_CONTENT_CLASS =
  "max-h-[90vh] max-w-[calc(100vw-1.5rem)] gap-0 overflow-hidden rounded-[4px] border border-[#4a4f5a] bg-[#333842] p-0 text-[#f4f5f7] shadow-2xl sm:max-w-[448px]";

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
      <DialogContent className={MODAL_CONTENT_CLASS}>
        <div className="flex max-h-[82vh] flex-col overflow-hidden">
          <div className="border-b border-[#2b3039] bg-[#2f343d] px-5 py-3">
            <div className="text-base font-medium leading-none tracking-tight">Set Custom Status</div>
          </div>

          <div className="space-y-5 overflow-y-auto px-6 py-4">
            <div className="flex items-center gap-2 rounded-[3px] border border-[#4a4f5a] bg-[#2f343d] px-2.5 py-2">
            <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 rounded-[3px] text-[#d7dbe3] hover:bg-[#3a404b] hover:text-white"
                >
                  {selectedEmoji || <Smile className="h-4 w-4" />}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-auto border border-[#4a4f5a] bg-[#2f343d] p-2 text-[#f4f5f7]"
                side="bottom"
                align="start"
              >
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
                        "h-8 w-8 rounded-[3px] text-lg transition-colors hover:bg-[#3a404b]",
                        selectedEmoji === emoji && "bg-[#3a404b]",
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
                    className="mt-2 w-full justify-start rounded-[3px] text-xs text-[#d7dbe3] hover:bg-[#3a404b] hover:text-white"
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
              className="h-7 border-0 bg-transparent px-0 text-sm text-[#f3f4f7] placeholder:text-[#9ea4af] focus-visible:ring-0"
              maxLength={CUSTOM_STATUS_MAX_LENGTH}
            />
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-[#c4c8d0]">Clear status after</p>
              <Select value={clearAfter} onValueChange={setClearAfter}>
                <SelectTrigger className="h-9 rounded-[3px] border border-[#4a4f5a] bg-[#2f343d] text-sm text-[#f3f4f7]">
                  <div className="flex items-center gap-2">
                    <Clock3 className="h-4 w-4 text-[#9ea4af]" />
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent className="border border-[#4a4f5a] bg-[#2f343d] text-[#f4f5f7]">
                  {CLEAR_AFTER_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value} className="text-sm">
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-[#2c3139] bg-[#30353f] px-5 py-3">
            <Button
              type="button"
              variant="ghost"
              onClick={handleClearCustomStatus}
              disabled={!user?.custom_status && !customStatusText && !selectedEmoji}
              className="h-9 rounded-[3px] px-4 text-[#b9bec8] hover:bg-transparent hover:text-white"
            >
              Clear
            </Button>
            <Button
              type="button"
              onClick={handleSaveCustomStatus}
              className="h-9 rounded-[3px] bg-[#d7dbe3] px-5 font-medium text-[#363b44] hover:bg-white"
            >
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
