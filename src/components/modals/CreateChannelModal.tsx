import { ChatTeardrop, CircleNotch, ClipboardText, FilmStrip, Hash, Megaphone, SpeakerHigh } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
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

import type { ChannelType } from "@/types";

const CHANNEL_TYPE_OPTIONS: {
 value: "text" | "voice" | "forum" | "announcement" | "tasks" | "media";
 label: string;
 description: string;
 icon: Icon;
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
 icon: SpeakerHigh,
 },
 {
 value: "forum",
 label: "Forum",
 description: "Organize long-running conversations into dedicated posts.",
 icon: ChatTeardrop,
 },
 {
 value: "announcement",
 label: "Announcements",
 description: "Share one-way updates from admins and moderators with the whole server.",
 icon: Megaphone,
 },
 {
 value: "tasks",
 label: "Tasks",
 description: "Create tasks, assign tasks, and track progress.",
 icon: ClipboardText,
 },
 {
 value: "media",
 label: "Media",
 description: "A dedicated space for sharing images, videos, and visual inspiration.",
 icon: FilmStrip,
 },
];

const ChannelTypePreview = ({ type }: { type: ChannelType }) => {
 if (type === "voice") {
 return (
 <div className="flex h-full flex-col justify-between rounded-xl border border-border/50 bg-secondary/30 p-3">
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
 <div className="flex h-full flex-col gap-2 rounded-xl border border-border/50 bg-secondary/30 p-3">
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
 <div className="h-full rounded-xl border border-border/50 bg-secondary/30 p-3">
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
 <div className="h-full space-y-2 rounded-xl border border-border/50 bg-secondary/30 p-3">
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
 <div className="grid h-full grid-cols-3 grid-rows-2 gap-2 rounded-xl border border-border/50 bg-secondary/30 p-3">
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
 <div className="h-full space-y-2 rounded-xl border border-border/50 bg-secondary/30 p-3">
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

export const CreateChannelModal = () => {
 const { activeModal, modalData, closeModal } = useUIStore();
 const { currentServer, categories, createChannel, createCategory } = useServerStore();
 const { user } = useAuthStore();

 const [mode, setMode] = useState<"channel" | "category">("channel");
 const [name, setName] = useState("");
 const [selectedChannelType, setSelectedChannelType] = useState<"text" | "voice" | "forum" | "announcement" | "tasks" | "media">("text");
 const [categoryId, setCategoryId] = useState<string>("none");
 const [isPrivate, setIsPrivate] = useState(false);
 const [isSubmitting, setIsSubmitting] = useState(false);
 const [error, setError] = useState("");

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
 setError("Failed to create category. Please check your permissions.");
 return;
 }
 } else {
 const selectedCategoryId = presetCategoryId || (categoryId === "none" ? undefined : categoryId);
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
 <DialogContent className="sm:max-w-lg max-w-[calc(100vw-2rem)] max-h-[90vh] overflow-hidden bg-background/95 backdrop-blur-xl border-border/50 rounded-2xl p-0 gap-0">
 <form onSubmit={handleSubmit} className="flex max-h-[85vh] flex-col overflow-hidden">
 <div className="border-b border-border/50 px-6 py-4">
 <div className="text-lg font-medium tracking-tight">
 {mode === "category" ? "Create a category" : "Create a channel"}
 </div>
 </div>

 <div className="space-y-5 overflow-y-auto px-6 py-5">
 {mode === "channel" && (
 <div className="space-y-2">
 <Label htmlFor="name" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
 Channel name
 </Label>
 <Input
 id="name"
 value={name}
 onChange={(e) => setName(formatChannelName(e.target.value))}
 placeholder="new-channel"
 className="h-10 rounded-xl border-border/50 bg-secondary/30"
 maxLength={50}
 />
 </div>
 )}

 {mode === "category" && (
 <div className="space-y-2">
 <Label htmlFor="name" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
 Category name
 </Label>
 <Input
 id="name"
 value={name}
 onChange={(e) => setName(e.target.value)}
 placeholder="New Category"
 className="h-10 rounded-xl border-border/50 bg-secondary/30"
 maxLength={100}
 />
 </div>
 )}

 {mode === "channel" && (
 <>
 <div className="space-y-2">
 <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
 Channel Type
 </Label>
 <RadioGroup
 value={selectedChannelType}
 onValueChange={(value) => setSelectedChannelType(value as "text" | "voice" | "forum" | "announcement" | "tasks" | "media")}
 className="space-y-3 rounded-xl border border-border/50 bg-secondary/20 p-3"
 >
 <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
 <div className="grid w-full self-start content-start grid-cols-3 gap-x-2 gap-y-1">
 {CHANNEL_TYPE_OPTIONS.map((option) => {
 const Icon = option.icon;
 const isSelected = selectedChannelType === option.value;
 return (
 <Label
 key={option.value}
 htmlFor={`channel-type-${option.value}`}
 className={`flex h-10 w-full cursor-pointer items-center justify-center rounded-lg border transition-colors ${
 isSelected
 ? "border-primary/50 bg-primary/10 text-primary"
 : "border-border/50 bg-secondary/40 text-muted-foreground hover:border-primary/30 hover:text-foreground"
 }`}
 >
 <Icon className="h-4 w-4" />
 <RadioGroupItem value={option.value} id={`channel-type-${option.value}`} className="sr-only" />
 </Label>
 );
 })}
 </div>
 <div className="hidden h-[138px] min-w-0 sm:block">
 <ChannelTypePreview type={selectedChannelType} />
 </div>
 </div>
 </RadioGroup>
 <div className="rounded-xl border border-border/50 bg-secondary/20 p-3">
 <p className="text-sm font-medium">{selectedTypeMeta.label}</p>
 <p className="mt-1 text-xs text-muted-foreground leading-5">{selectedTypeMeta.description}</p>
 </div>
 </div>

 {!presetCategoryId && currentServer && categories.length > 0 && (
 <div className="space-y-2">
 <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
 Category
 </Label>
 <Select value={categoryId} onValueChange={setCategoryId}>
 <SelectTrigger className="h-10 rounded-xl border-border/50 bg-secondary/30">
 <SelectValue placeholder="No category" />
 </SelectTrigger>
 <SelectContent className="rounded-xl border-border/50">
 <SelectItem value="none" className="rounded-lg focus:bg-muted focus:text-foreground">
 No category
 </SelectItem>
 {categories.map((cat) => (
 <SelectItem key={cat.id} value={cat.id} className="rounded-lg focus:bg-muted focus:text-foreground">
 {cat.name}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 )}
 </>
 )}

 {mode === "channel" && (
 <div className="space-y-2">
 <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
 Privacy
 </Label>
 <div className="flex items-center justify-between rounded-xl border border-border/50 bg-secondary/20 px-3 py-3">
 <div className="flex-1 min-w-0">
 <p className="text-sm font-medium">Private Channel</p>
 <p className="mt-1 text-xs leading-5 text-muted-foreground">
 Only selected members can view this channel
 </p>
 </div>
 <Switch checked={isPrivate} onCheckedChange={setIsPrivate} />
 </div>
 </div>
 )}

 {error && (
 <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3">
 <p className="text-sm text-destructive">{error}</p>
 </div>
 )}
 </div>

 <div className="flex items-center justify-end border-t border-border/50 bg-secondary/20 px-6 py-3">
 <Button type="submit" disabled={isSubmitting || !name.trim()} className="h-11 rounded-xl px-6">
 {isSubmitting ? (
 <>
 <CircleNotch className="w-4 h-4 mr-2 animate-spin" />
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
