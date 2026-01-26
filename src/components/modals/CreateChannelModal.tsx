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
import { Hash, Volume2, FolderPlus, Loader2, Lock } from "lucide-react";
import type { ChannelType } from "@/types";

export const CreateChannelModal = () => {
  const { activeModal, modalData, closeModal } = useUIStore();
  const { currentServer, categories, createChannel, createCategory } = useServerStore();
  const { user } = useAuthStore();

  const [mode, setMode] = useState<"channel" | "category">("channel");
  const [name, setName] = useState("");
  const [channelType, setChannelType] = useState<ChannelType>("text");
  const [categoryId, setCategoryId] = useState<string>("none");
  const [isPrivate, setIsPrivate] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const isOpen = activeModal === "create-channel";
  const presetCategoryId = modalData?.categoryId as string | undefined;
  const isCategory = modalData?.isCategory as boolean | undefined;

  // Set mode based on modalData when modal opens
  useEffect(() => {
    if (isOpen) {
      if (isCategory === true) {
        setMode("category");
      } else {
        setMode("channel");
      }
    }
  }, [isOpen, isCategory]);

  const handleClose = () => {
    setName("");
    setChannelType("text");
    setCategoryId(presetCategoryId || "none");
    setIsPrivate(false);
    setError("");
    setMode("channel");
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
        await createCategory(currentServer.id, name.trim(), user.id);
      } else {
        const selectedCategoryId = presetCategoryId || (categoryId === "none" ? undefined : categoryId);
        await createChannel(currentServer.id, name.trim(), channelType, user.id, selectedCategoryId, undefined, isPrivate);
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
      <DialogContent className="sm:max-w-md max-w-[calc(100vw-2rem)] overflow-hidden p-0 rounded-2xl gap-0">
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
          {/* Mode toggle */}
          <div className="space-y-3">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Type</Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode("channel")}
                className={`flex-1 flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-medium transition-colors ${
                  mode === "channel"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary/50 text-muted-foreground hover:bg-secondary/80"
                }`}
              >
                <Hash className="w-4 h-4" />
                Channel
              </button>
              <button
                type="button"
                onClick={() => setMode("category")}
                className={`flex-1 flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-medium transition-colors ${
                  mode === "category"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary/50 text-muted-foreground hover:bg-secondary/80"
                }`}
              >
                <FolderPlus className="w-4 h-4" />
                Category
              </button>
            </div>
          </div>

          {mode === "channel" && (
            <>
              {/* Channel Type */}
              <div className="space-y-3">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Channel Type
                </Label>
                <RadioGroup
                  value={channelType}
                  onValueChange={(value) => setChannelType(value as ChannelType)}
                  className="space-y-2"
                >
                  <Label
                    htmlFor="text"
                    className={`flex items-center gap-4 p-3 rounded-xl cursor-pointer border transition-colors ${
                      channelType === "text"
                        ? "bg-primary/5 border-primary/50"
                        : "bg-secondary/50 border-border/50 hover:bg-secondary/80"
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        channelType === "text" ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      <Hash className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <span className="font-medium text-sm">Text Channel</span>
                      <p className="text-xs text-muted-foreground mt-0.5">Send messages, images, and files</p>
                    </div>
                    <RadioGroupItem value="text" id="text" className="sr-only" />
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        channelType === "text" ? "border-primary bg-primary" : "border-muted-foreground/30"
                      }`}
                    >
                      {channelType === "text" && <div className="w-2 h-2 rounded-full bg-primary-foreground" />}
                    </div>
                  </Label>

                  <Label
                    htmlFor="voice"
                    className={`flex items-center gap-4 p-3 rounded-xl cursor-pointer border transition-colors ${
                      channelType === "voice"
                        ? "bg-primary/5 border-primary/50"
                        : "bg-secondary/50 border-border/50 hover:bg-secondary/80"
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        channelType === "voice" ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      <Volume2 className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <span className="font-medium text-sm">Voice Channel</span>
                      <p className="text-xs text-muted-foreground mt-0.5">Talk with voice, video, and screen share</p>
                    </div>
                    <RadioGroupItem value="voice" id="voice" className="sr-only" />
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        channelType === "voice" ? "border-primary bg-primary" : "border-muted-foreground/30"
                      }`}
                    >
                      {channelType === "voice" && <div className="w-2 h-2 rounded-full bg-primary-foreground" />}
                    </div>
                  </Label>
                </RadioGroup>
              </div>

              {/* Category selector */}
              {!presetCategoryId && categories.length > 0 && (
                <div className="space-y-3">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Category
                  </Label>
                  <Select value={categoryId} onValueChange={setCategoryId}>
                    <SelectTrigger className="h-11 rounded-xl border-border/50 bg-secondary/30">
                      <SelectValue placeholder="No category" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-border/50">
                      <SelectItem value="none" className="rounded-lg">
                        No category
                      </SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id} className="rounded-lg">
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Private Channel Toggle */}
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
