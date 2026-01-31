import { useState, useEffect } from "react";
import { useUIStore } from "@/stores/uiStore";
import { useServerStore } from "@/stores/serverStore";
import { useAuthStore } from "@/stores/authStore";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Hash, Volume2, FolderPlus, Loader2, Lock, MessageSquare } from "lucide-react";
import type { ChannelType } from "@/types";

// Ghost Icon Component
const GhostIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
    <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
    <g id="SVGRepo_iconCarrier">
      <path d="M16 10.5C16 11.3284 15.5523 12 15 12C14.4477 12 14 11.3284 14 10.5C14 9.67157 14.4477 9 15 9C15.5523 9 16 9.67157 16 10.5Z" fill="currentColor"></path>
      <ellipse cx="9" cy="10.5" rx="1" ry="1.5" fill="currentColor"></ellipse>
      <path d="M22 19.723V12.3006C22 6.61173 17.5228 2 12 2C6.47715 2 2 6.61173 2 12.3006V19.723C2 21.0453 3.35098 21.9054 4.4992 21.314C5.42726 20.836 6.5328 20.9069 7.39614 21.4998C8.36736 22.1667 9.63264 22.1667 10.6039 21.4998L10.9565 21.2576C11.5884 20.8237 12.4116 20.8237 13.0435 21.2576L13.3961 21.4998C14.3674 22.1667 15.6326 22.1667 16.6039 21.4998C17.4672 20.9069 18.5727 20.836 19.5008 21.314C20.649 21.9054 22 21.0453 22 19.723Z" stroke="currentColor" strokeWidth="1.5"></path>
    </g>
  </svg>
);

export const CreateChannelModal = () => {
  const { activeModal, modalData, closeModal } = useUIStore();
  const { currentServer, categories, createChannel, createCategory } = useServerStore();
  const { user } = useAuthStore();

  const [mode, setMode] = useState<"channel" | "category">("channel");
  const [name, setName] = useState("");
  const [selectedChannelType, setSelectedChannelType] = useState<"text" | "voice" | "ghost" | "forum">("text");
  const [categoryId, setCategoryId] = useState<string>("none");
  const [isPrivate, setIsPrivate] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const isOpen = activeModal === "create-channel";
  const presetCategoryId = modalData?.categoryId as string | undefined;
  const isCategory = modalData?.isCategory as boolean | undefined;

  // Set mode based on modalData when modal opens; reset form when closed to avoid flash when reopening
  useEffect(() => {
    if (isOpen) {
      if (isCategory === true) {
        setMode("category");
      } else {
        setMode("channel");
      }
    } else {
      setMode("channel");
    }
  }, [isOpen, isCategory]);

  const handleClose = () => {
    setName("");
    setSelectedChannelType("text");
    setCategoryId(presetCategoryId || "none");
    setIsPrivate(false);
    setError("");
    closeModal();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    if (!currentServer || !user) return;

    setIsSubmitting(true);
    setError("");

    try {
      if (mode === "category") {
        const result = await createCategory(currentServer.id, name.trim(), user.id);
        if (!result) {
          setError("Failed to create category. Check permissions.");
          return;
        }
      } else {
        const selectedCategoryId = presetCategoryId || (categoryId === "none" ? undefined : categoryId);
        // Ghost mode is a UI-only "channel type" but stored as a setting with text channel type
        const actualChannelType: ChannelType = selectedChannelType === "ghost" ? "text" : (selectedChannelType === "forum" ? "forum" : selectedChannelType);
        const ghostMode = selectedChannelType === "ghost";
        const result = await createChannel(currentServer.id, name.trim(), actualChannelType, user.id, selectedCategoryId, undefined, isPrivate, ghostMode);
        if (!result) {
          setError("Failed to create channel. Check permissions.");
          return;
        }
      }
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatChannelName = (value: string) => {
    return value
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-w-[calc(100vw-2rem)] overflow-hidden p-0 rounded-2xl gap-0">
        {/* Header */}
        <div className="relative px-6 pt-6 pb-4">
          {/* Decorative gradient blob */}
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-primary/20 rounded-full blur-3xl pointer-events-none" />

          {/* Badge */}
          <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary mb-4">
            {mode === "category" ? <FolderPlus className="w-3 h-3" /> : <Hash className="w-3 h-3" />}
            {mode === "category" ? "New Category" : "New Channel"}
          </div>

          {/* Title & Description */}
          <h2 className="text-xl font-semibold">{mode === "category" ? "Create Category" : "Create Channel"}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === "category"
              ? "Categories help organize your channels"
              : "Channels are where your members communicate"}
          </p>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-6">
          {mode === "channel" && (
            <>
              {/* Channel Type - icon + label, compact row */}
              <div className="space-y-3">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Channel Type
                </Label>
                <RadioGroup
                  value={selectedChannelType}
                  onValueChange={(value) => setSelectedChannelType(value as "text" | "voice" | "ghost" | "forum")}
                  className="grid grid-cols-4 gap-2"
                >
                  <Label
                    htmlFor="text"
                    className={`flex items-center gap-3 py-2 px-3 rounded-xl cursor-pointer border transition-colors ${
                      selectedChannelType === "text"
                        ? "bg-primary/5 border-primary/50"
                        : "bg-secondary/50 border-border/50 hover:bg-secondary/80"
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        selectedChannelType === "text" ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      <Hash className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-medium">Text</span>
                    <RadioGroupItem value="text" id="text" className="sr-only" />
                  </Label>

                  <Label
                    htmlFor="voice"
                    className={`flex items-center gap-3 py-2 px-3 rounded-xl cursor-pointer border transition-colors ${
                      selectedChannelType === "voice"
                        ? "bg-primary/5 border-primary/50"
                        : "bg-secondary/50 border-border/50 hover:bg-secondary/80"
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        selectedChannelType === "voice" ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      <Volume2 className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-medium">Voice</span>
                    <RadioGroupItem value="voice" id="voice" className="sr-only" />
                  </Label>

                  <Label
                    htmlFor="ghost"
                    className={`flex items-center gap-3 py-2 px-3 rounded-xl cursor-pointer border transition-colors ${
                      selectedChannelType === "ghost"
                        ? "bg-primary/5 border-primary/50"
                        : "bg-secondary/50 border-border/50 hover:bg-secondary/80"
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        selectedChannelType === "ghost" ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      <GhostIcon className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-medium">Ghost</span>
                    <RadioGroupItem value="ghost" id="ghost" className="sr-only" />
                  </Label>

                  <Label
                    htmlFor="forum"
                    className={`flex items-center gap-3 py-2 px-3 rounded-xl cursor-pointer border transition-colors ${
                      selectedChannelType === "forum"
                        ? "bg-primary/5 border-primary/50"
                        : "bg-secondary/50 border-border/50 hover:bg-secondary/80"
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        selectedChannelType === "forum" ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      <MessageSquare className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-medium">Forum</span>
                    <RadioGroupItem value="forum" id="forum" className="sr-only" />
                  </Label>
                </RadioGroup>
                
                {/* Channel Type Description */}
                <div className="mt-2 p-3 rounded-xl bg-muted/50 border border-border/50">
                  {selectedChannelType === "text" && (
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">Text Channel:</span> Perfect for conversations, sharing messages, and collaboration. Members can send text messages, images, and files.
                    </p>
                  )}
                  {selectedChannelType === "voice" && (
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">Voice Channel:</span> For voice and video calls. Members can join to talk in real-time with others in the channel.
                    </p>
                  )}
                  {selectedChannelType === "ghost" && (
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">Ghost Mode:</span> A text channel where usernames and avatars are hidden for privacy. Admins and owners remain visible to maintain moderation.
                    </p>
                  )}
                  {selectedChannelType === "forum" && (
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">Forum Channel:</span> A traditional forum where users can create threads and reply to them. Perfect for organized discussions and topic-based conversations.
                    </p>
                  )}
                </div>
              </div>

              {/* Category selector - only when this server has categories */}
              {!presetCategoryId && currentServer && categories.length > 0 && (
                <div className="space-y-3">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Category
                  </Label>
                  <Select value={categoryId} onValueChange={setCategoryId}>
                    <SelectTrigger className="h-11 rounded-xl border-border/50 bg-secondary/30">
                      <SelectValue placeholder="No category" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-border/50">
                      <SelectItem value="none" className="rounded-lg focus:bg-muted focus:text-foreground hover:bg-muted hover:text-foreground">
                        No category
                      </SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id} className="rounded-lg focus:bg-muted focus:text-foreground hover:bg-muted hover:text-foreground">
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}

          {/* Name input */}
          <div className="space-y-3">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {mode === "category" ? "Category Name" : "Channel Name"}
            </Label>
            <div className="relative">
              {mode === "channel" && (
                <div className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-secondary/80 flex items-center justify-center">
                  <Hash className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(mode === "channel" ? formatChannelName(e.target.value) : e.target.value)}
                placeholder={mode === "category" ? "Category name" : "new-channel"}
                className={`h-11 rounded-xl border-border/50 bg-secondary/30 ${mode === "channel" ? "pl-14" : ""}`}
                maxLength={mode === "category" ? 100 : 50}
              />
            </div>
            {mode === "channel" && name && (
              <p className="text-xs text-muted-foreground">
                Preview: <span className="text-primary font-medium">#{name}</span>
              </p>
            )}
          </div>

          {/* Private Channel Toggle - after channel name */}
          {mode === "channel" && (
            <div className="space-y-3">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Privacy
              </Label>
              <div className="flex items-center gap-4 p-4 rounded-xl bg-secondary/30 border border-border/50">
                <div className="w-10 h-10 rounded-xl bg-secondary/80 flex items-center justify-center flex-shrink-0">
                  <Lock className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Private Channel</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Only selected members can view this channel</p>
                </div>
                <Switch checked={isPrivate} onCheckedChange={setIsPrivate} />
              </div>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Footer */}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={handleClose} className="flex-1 h-11 rounded-xl">
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !name.trim()} className="flex-1 h-11 rounded-xl">
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                `Create ${mode === "category" ? "Category" : "Channel"}`
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
