import { useState, useEffect } from "react";
import { useUIStore } from "@/stores/uiStore";
import { useServerStore } from "@/stores/serverStore";
import { useAuthStore } from "@/stores/authStore";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import {
  CheckSquare,
  FileVideo,
  Grid2X2,
  Hash,
  Loader2,
  Megaphone,
  Volume2,
  type LucideIcon,
} from "lucide-react";
import type { ChannelType } from "@/types";
import { useRateLimit } from "@/hooks/useRateLimit";
import { rateLimitToast } from "@/lib/rateLimitToast";

const CHANNEL_TYPE_OPTIONS: {
  value: "text" | "voice" | "forum" | "announcement" | "tasks" | "media";
  label: string;
  description: string;
  icon: LucideIcon;
}[] = [
  {
    value: "text",
    label: "Chat",
    description: "A place for everyone to have conversation over messages.",
    icon: Hash,
  },
  {
    value: "voice",
    label: "Voice",
    description: "Talk in real-time with voice and video.",
    icon: Volume2,
  },
  {
    value: "forum",
    label: "Forum",
    description: "Organize long-running conversations into dedicated posts.",
    icon: Grid2X2,
  },
  {
    value: "announcement",
    label: "Announcements",
    description: "Share one-way updates from admins with the whole server.",
    icon: Megaphone,
  },
  {
    value: "tasks",
    label: "Tasks",
    description: "Create tasks, assign tasks, and track progress.",
    icon: CheckSquare,
  },
  {
    value: "media",
    label: "Media",
    description: "A dedicated space for sharing images, videos, and visual inspiration.",
    icon: FileVideo,
  },
];

const ChannelTypePreview = ({ type }: { type: ChannelType }) => {
  if (type === "voice") {
    return (
      <div className="flex h-[144px] flex-col justify-between rounded-xl border border-border/50 bg-secondary/30 p-3">
        <div className="mb-3 flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-primary/20" />
          <div className="h-7 w-7 rounded-full bg-primary/30" />
          <div className="h-7 w-7 rounded-full bg-primary/15" />
        </div>
        <div className="flex items-end gap-1">
          <div className="h-2 w-2 rounded-full bg-primary/50" />
          <div className="h-4 w-2 rounded-full bg-primary/70" />
          <div className="h-6 w-2 rounded-full bg-primary/90" />
          <div className="h-3 w-2 rounded-full bg-primary/70" />
          <div className="h-5 w-2 rounded-full bg-primary/50" />
          <div className="h-2 w-2 rounded-full bg-primary/40" />
        </div>
      </div>
    );
  }

  if (type === "forum") {
    return (
      <div className="flex h-[144px] flex-col gap-2 rounded-xl border border-border/50 bg-secondary/30 p-3">
        <div className="rounded-lg border border-border/40 bg-background/40 p-2">
          <div className="h-2 w-24 rounded bg-muted-foreground/30" />
          <div className="mt-2 h-2 w-40 rounded bg-muted-foreground/20" />
        </div>
        <div className="rounded-lg border border-border/40 bg-background/30 p-2">
          <div className="h-2 w-20 rounded bg-muted-foreground/30" />
          <div className="mt-2 h-2 w-32 rounded bg-muted-foreground/20" />
        </div>
      </div>
    );
  }

  if (type === "announcement") {
    return (
      <div className="h-[144px] rounded-xl border border-border/50 bg-secondary/30 p-3">
        <div className="rounded-lg bg-primary/15 px-2 py-1.5">
          <div className="h-2 w-16 rounded bg-primary/50" />
        </div>
        <div className="mt-3 space-y-2">
          <div className="h-2 w-36 rounded bg-muted-foreground/30" />
          <div className="h-2 w-28 rounded bg-muted-foreground/20" />
        </div>
      </div>
    );
  }

  if (type === "tasks") {
    return (
      <div className="h-[144px] space-y-2 rounded-xl border border-border/50 bg-secondary/30 p-3">
        <div className="flex items-center gap-2">
          <div className="h-3.5 w-3.5 rounded border border-primary/60 bg-primary/15" />
          <div className="h-2 w-32 rounded bg-muted-foreground/30" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3.5 w-3.5 rounded border border-border/70 bg-background/50" />
          <div className="h-2 w-24 rounded bg-muted-foreground/20" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3.5 w-3.5 rounded border border-border/70 bg-background/50" />
          <div className="h-2 w-40 rounded bg-muted-foreground/20" />
        </div>
      </div>
    );
  }

  if (type === "media") {
    return (
      <div className="grid h-[144px] grid-cols-3 grid-rows-2 gap-2 rounded-xl border border-border/50 bg-secondary/30 p-3">
        <div className="rounded-md bg-primary/20" />
        <div className="rounded-md bg-primary/30" />
        <div className="rounded-md bg-primary/15" />
        <div className="rounded-md bg-primary/25" />
        <div className="rounded-md bg-primary/20" />
        <div className="rounded-md bg-primary/35" />
      </div>
    );
  }

  return (
    <div className="h-[144px] space-y-2 rounded-xl border border-border/50 bg-secondary/30 p-3">
      <div className="flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-primary/80" />
        <div className="h-2 w-24 rounded bg-muted-foreground/30" />
      </div>
      <div className="flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-primary/60" />
        <div className="h-2 w-36 rounded bg-muted-foreground/20" />
      </div>
      <div className="h-8 rounded-md bg-background/50" />
    </div>
  );
};

const CategoryForm = ({
  name,
  setName,
}: {
  name: string;
  setName: (value: string) => void;
}) => {
  return (
    <div className="px-6 py-4">
      <Label htmlFor="name" className="text-xs font-medium uppercase tracking-wide text-[#c4c8d0]">
        Category name
      </Label>
      <Input
        id="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder=""
        className="mt-2 h-9 rounded-none border-0 border-b border-white/80 bg-transparent px-0 text-sm text-[#f3f4f7] shadow-none outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
        maxLength={100}
      />
    </div>
  );
};

const ChannelIconButton = ({
  icon: Icon,
  id,
  value,
  isSelected,
  disabled,
}: {
  icon: LucideIcon;
  id: string;
  value?: string;
  isSelected?: boolean;
  disabled?: boolean;
}) => {
  const content = (
    <div
      className={`flex h-9 w-9 items-center justify-center rounded-[2px] border transition-colors ${
        isSelected
          ? "border-white/90 bg-[#4a5046] text-[#f4f5f7]"
          : "border-transparent bg-transparent text-[#9ea4af] hover:bg-[#3e434d] hover:text-[#d7dbe3]"
      } ${disabled ? "cursor-not-allowed opacity-45" : "cursor-pointer"}`}
    >
      <Icon className="h-4 w-4" />
      </div>
  );

  if (disabled || !value) {
    return content;
  }

  return (
    <Label htmlFor={id} className="block">
      {content}
      <RadioGroupItem value={value} id={id} className="sr-only" />
    </Label>
  );
};

export const CreateChannelModal = () => {
  const { activeModal, modalData, closeModal } = useUIStore();
  const { currentServer, createChannel, createCategory } = useServerStore();
  const { user } = useAuthStore();

  const [mode, setMode] = useState<"channel" | "category">("channel");
  const [name, setName] = useState("");
  const [selectedChannelType, setSelectedChannelType] = useState<"text" | "voice" | "forum" | "announcement" | "tasks" | "media">("text");
  const [isPrivate, setIsPrivate] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const checkCreateLimit = useRateLimit(5, 60_000);

  const isOpen = activeModal === "create-channel";
  const presetCategoryId = modalData?.categoryId as string | undefined;
  const isCategory = modalData?.isCategory as boolean | undefined;
  const selectedTypeMeta = CHANNEL_TYPE_OPTIONS.find((option) => option.value === selectedChannelType) ?? CHANNEL_TYPE_OPTIONS[0];

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

    if (!checkCreateLimit()) { rateLimitToast("Creating too fast"); return; }

    setIsSubmitting(true);
    setError("");

    try {
      if (mode === "category") {
        const result = await createCategory(currentServer.id, name.trim(), user.id);
        if (!result) {
          setError("Failed to create category. Please check your permissions.");
          return;
        }
      } else {
        const selectedCategoryId = presetCategoryId;
        const actualChannelType: ChannelType = selectedChannelType;
        const result = await createChannel(currentServer.id, name.trim(), actualChannelType, user.id, selectedCategoryId, undefined, isPrivate, false);
        if (!result) {
          setError("Failed to create channel. Please check your permissions.");
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
      <DialogContent className="max-h-[90vh] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-[4px] border border-[#4a4f5a] bg-[#333842] p-0 text-[#f4f5f7] shadow-2xl sm:max-w-[448px]">
        <form onSubmit={handleSubmit} className="flex max-h-[82vh] flex-col overflow-hidden">
          <div className="border-b border-[#2b3039] bg-[#2f343d] px-5 py-3">
            <div className="text-base font-medium leading-none tracking-tight">
              {mode === "category" ? "Create a category" : "Create a channel"}
            </div>
          </div>

          <div className="overflow-y-auto">
            {mode === "category" ? (
              <CategoryForm name={name} setName={setName} />
            ) : (
              <div className="px-6 py-4">
                <Label htmlFor="name" className="text-xs font-medium uppercase tracking-wide text-[#c4c8d0]">
                  Channel name
                </Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(formatChannelName(e.target.value))}
                  placeholder=""
                  className="mt-2 h-9 rounded-none border-0 border-b border-white/80 bg-transparent px-0 text-sm text-[#f3f4f7] shadow-none outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
                  maxLength={50}
                />
              </div>
            )}

          {mode === "channel" && (
            <>
              <div className="px-6 pb-4">
                <Label className="text-sm font-medium text-[#c4c8d0]">
                  Channel type
                </Label>
                <RadioGroup
                  value={selectedChannelType}
                  onValueChange={(value) => setSelectedChannelType(value as "text" | "voice" | "forum" | "announcement" | "tasks" | "media")}
                  className="mt-2"
                >
                  <div className="grid gap-4 sm:grid-cols-[130px_minmax(0,1fr)]">
                    <div className="min-w-0">
                      <div className="grid w-max grid-cols-3 gap-x-2 gap-y-1">
                        {CHANNEL_TYPE_OPTIONS.map((option) => (
                          <ChannelIconButton
                            key={option.value}
                            id={`channel-type-${option.value}`}
                            value={option.value}
                            icon={option.icon}
                            isSelected={selectedChannelType === option.value}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <ChannelTypePreview type={selectedChannelType} />
                    </div>
                  </div>
                  <div className="mt-3 w-full">
                    <p className="text-sm font-medium leading-none text-[#f3f4f7]">{selectedTypeMeta.label}</p>
                    <p className="mt-2 w-full text-xs leading-5 text-[#c4c8d0]">{selectedTypeMeta.description}</p>
                  </div>
                </RadioGroup>
              </div>
            </>
          )}

          {mode === "channel" && (
            <div className="px-6 pb-4 pt-3">
              <div className="flex items-start justify-between gap-5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-none text-[#f3f4f7]">Make channel public</p>
                  <p className="mt-2 text-xs leading-5 text-[#b8bec8]">
                    People who aren't a part of the server will be able to see this channel.
                  </p>
                </div>
                <Switch checked={!isPrivate} onCheckedChange={(checked) => setIsPrivate(!checked)} />
              </div>
            </div>
          )}

          {error && (
            <div className="mx-7 mb-5 rounded-[3px] border border-destructive/30 bg-destructive/15 p-3">
              <p className="text-sm text-destructive-foreground">{error}</p>
            </div>
          )}
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-[#2c3139] bg-[#30353f] px-5 py-3">
            <Button type="button" variant="ghost" onClick={handleClose} className="h-9 rounded-[3px] px-4 text-[#b9bec8] hover:bg-transparent hover:text-white">
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !name.trim()} className="h-9 rounded-[3px] bg-[#d7dbe3] px-5 font-medium text-[#363b44] hover:bg-white">
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
