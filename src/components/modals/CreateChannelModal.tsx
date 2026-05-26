import { useState, useEffect } from "react";
import { useUIStore } from "@/stores/uiStore";
import { useServerStore } from "@/stores/serverStore";
import { useAuthStore } from "@/stores/authStore";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CheckSquare,
  CalendarDays,
  FileVideo,
  Grid2X2,
  Hash,
  Loader2,
  Lock,
  Megaphone,
  Volume2,
  type LucideIcon,
} from "lucide-react";
import type { ChannelType } from "@/types";
import { useRateLimit } from "@/hooks/useRateLimit";
import { rateLimitToast } from "@/lib/rateLimitToast";

type ChannelTypeValue = "text" | "voice" | "forum" | "announcement" | "tasks" | "media" | "calendar";

const CHANNEL_TYPE_OPTIONS: {
  value: ChannelTypeValue;
  label: string;
  description: string;
  icon: LucideIcon;
}[] = [
  { value: "text", label: "Chat", description: "A place for everyone to have conversation over messages.", icon: Hash },
  { value: "voice", label: "Voice", description: "Talk in real-time with voice and video.", icon: Volume2 },
  { value: "forum", label: "Forum", description: "Organize long-running conversations into dedicated posts.", icon: Grid2X2 },
  { value: "announcement", label: "Announcements", description: "Share one-way updates from admins with the whole server.", icon: Megaphone },
  { value: "tasks", label: "Tasks", description: "Create tasks, assign tasks, and track progress.", icon: CheckSquare },
  { value: "media", label: "Media", description: "A dedicated space for sharing images, videos, and visual inspiration.", icon: FileVideo },
  { value: "calendar", label: "Calendar", description: "Schedule events, coordinate game nights, and keep everyone in sync.", icon: CalendarDays },
];

const CategoryForm = ({
  name,
  setName,
}: {
  name: string;
  setName: (value: string) => void;
}) => {
  return (
    <div className="px-6 py-5">
      <Label htmlFor="name" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Category name
      </Label>
      <Input
        id="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="mt-2 h-10"
        maxLength={100}
      />
    </div>
  );
};

export const CreateChannelModal = () => {
  const { activeModal, modalData, closeModal } = useUIStore();
  const { currentServer, createChannel, createCategory } = useServerStore();
  const { user } = useAuthStore();

  const [mode, setMode] = useState<"channel" | "category">("channel");
  const [name, setName] = useState("");
  const [selectedChannelType, setSelectedChannelType] = useState<ChannelTypeValue>("text");
  const [isPrivate, setIsPrivate] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const checkCreateLimit = useRateLimit(5, 60_000);

  const isOpen = activeModal === "create-channel";
  const presetCategoryId = modalData?.categoryId as string | undefined;
  const isCategory = modalData?.isCategory as boolean | undefined;
  const selectedTypeMeta =
    CHANNEL_TYPE_OPTIONS.find((option) => option.value === selectedChannelType) ?? CHANNEL_TYPE_OPTIONS[0];
  const SelectedIcon = selectedTypeMeta.icon;

  useEffect(() => {
    if (isOpen) {
      setMode(isCategory === true ? "category" : "channel");
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
    if (!checkCreateLimit()) {
      rateLimitToast("Creating too fast");
      return;
    }

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
        const actualChannelType: ChannelType = selectedChannelType;
        const result = await createChannel(
          currentServer.id,
          name.trim(),
          actualChannelType,
          user.id,
          presetCategoryId,
          undefined,
          isPrivate,
          false,
        );
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

  const formatChannelName = (value: string) =>
    value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border border-border bg-card p-0 text-card-foreground shadow-2xl sm:max-w-[460px]">
        <form onSubmit={handleSubmit} className="flex max-h-[82vh] flex-col overflow-hidden">
          <div className="border-b border-border/60 px-6 py-4">
            <h2 className="text-base font-semibold leading-none tracking-tight">
              {mode === "category" ? "Create a category" : "Create a channel"}
            </h2>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {mode === "category"
                ? "Group related channels together."
                : "Pick a name, choose a type, and set its visibility."}
            </p>
          </div>

          <div className="overflow-y-auto">
            {mode === "category" ? (
              <CategoryForm name={name} setName={setName} />
            ) : (
              <div className="space-y-5 px-6 py-5">
                {/* Channel name */}
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Channel name
                  </Label>
                  <div className="relative">
                    <Hash className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(formatChannelName(e.target.value))}
                      placeholder="new-channel"
                      className="h-10 pl-9"
                      maxLength={50}
                      autoFocus
                    />
                  </div>
                </div>

                {/* Channel type */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Channel type
                  </Label>
                  <Select
                    value={selectedChannelType}
                    onValueChange={(value) => setSelectedChannelType(value as ChannelTypeValue)}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue>
                        <div className="flex items-center gap-2">
                          <SelectedIcon className="h-4 w-4 text-muted-foreground" />
                          <span>{selectedTypeMeta.label}</span>
                        </div>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {CHANNEL_TYPE_OPTIONS.map((option) => {
                        const Icon = option.icon;
                        return (
                          <SelectItem key={option.value} value={option.value}>
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4 text-muted-foreground" />
                              <span>{option.label}</span>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <p className="text-xs leading-5 text-muted-foreground">
                    {selectedTypeMeta.description}
                  </p>
                </div>

                {/* Private toggle */}
                <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <Lock className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-none">Private channel</p>
                        <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                          Only selected members and roles will be able to view this channel.
                        </p>
                      </div>
                    </div>
                    <Switch checked={isPrivate} onCheckedChange={setIsPrivate} />
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="mx-6 mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-border/60 bg-muted/30 px-6 py-3">
            <Button type="button" variant="ghost" onClick={handleClose} className="h-9">
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !name.trim()} className="h-9">
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
