import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Upload, Plus, Users, X, Compass } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUIStore } from "@/stores/uiStore";
import { useServerStore } from "@/stores/serverStore";
import { useAuthStore } from "@/stores/authStore";
import { supabase } from "@/integrations/supabase/client";
import { secureUpload } from "@/lib/storageUpload";
import { toast } from "sonner";

const MAX_ICON_SIZE = 1 * 1024 * 1024; // 1MB
const ALLOWED_ICON_TYPES = ["image/jpeg", "image/png", "image/webp"];

const createServerSchema = z.object({
  name: z.string().trim().min(1, "Server name is required").max(50, "Server name must be less than 50 characters"),
});

type CreateServerForm = z.infer<typeof createServerSchema>;
type ModalView = "choose" | "create";

export const CreateServerModal = () => {
  const navigate = useNavigate();
  const { activeModal, closeModal, openModal } = useUIStore();
  const { createServer, updateServer, setCurrentServer, fetchChannels } = useServerStore();
  const { user } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [view, setView] = useState<ModalView>("choose");

  // Icon upload state
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createForm = useForm<CreateServerForm>({
    resolver: zodResolver(createServerSchema),
    defaultValues: { name: "" },
  });

  const isOpen = activeModal === "create-server";

  const handleIconSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_ICON_TYPES.includes(file.type)) {
      toast.error("Please select a JPEG, PNG, or WebP image");
      return;
    }

    if (file.size > MAX_ICON_SIZE) {
      toast.error("Image must be less than 1MB");
      return;
    }

    setIconFile(file);
    setIconPreview(URL.createObjectURL(file));
  };

  const clearIcon = () => {
    setIconFile(null);
    if (iconPreview) {
      URL.revokeObjectURL(iconPreview);
      setIconPreview(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const uploadIcon = async (serverId: string, file: File): Promise<string | null> => {
    const { compressImage } = await import("@/lib/imageCompression");
    const compressed = await compressImage(file, "server-icon");
    const ext = compressed.name.split(".").pop() || "webp";
    const filePath = `${serverId}/icon-${Date.now()}.${ext}`;

    try {
      const result = await secureUpload("server-icons", filePath, file, { upsert: true });
      return result.publicUrl;
    } catch (err) {
      console.error("Failed to upload icon:", err);
      return null;
    }
  };

  const onCreateSubmit = async (data: CreateServerForm) => {
    if (!user) return;

    setIsLoading(true);
    try {
      const server = await createServer(data.name, user.id);
      if (server) {
        if (iconFile) {
          const iconUrl = await uploadIcon(server.id, iconFile);
          if (iconUrl) {
            await updateServer(server.id, user.id, { icon_url: iconUrl });
          }
        }

        await updateServer(server.id, user.id, { banner_url: "/default_server_banner.png" });

        const serverWithBanner = { ...server, banner_url: "/default_server_banner.png" };

        toast.success(`Server "${server.name}" created!`);
        setCurrentServer(serverWithBanner);
        await fetchChannels(server.id);
        navigate(`/app/servers/${server.id}`);
        handleClose();
      }
    } catch (error) {
      toast.error("Failed to create server");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    createForm.reset();
    setView("choose");
    clearIcon();
    closeModal();
  };

  const handleJoinClick = () => {
    closeModal();
    openModal("join-server");
  };

  const handleExploreClick = () => {
    handleClose();
    setCurrentServer(null); // Switch to DM/home view so Explore content is visible
    navigate("/app/explore");
  };

  const handleBack = () => {
    setView("choose");
    clearIcon();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md max-w-[calc(100vw-2rem)] max-h-[90vh] overflow-hidden bg-background/95 backdrop-blur-xl border-border/50 rounded-2xl p-0">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleIconSelect}
          className="hidden"
        />

        {/* Choose View */}
        {view === "choose" && (
          <div className="p-4 sm:p-6">
            <DialogHeader className="pb-4">
              <DialogTitle className="text-xl font-medium">Add a Server</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-1">
                Create your own server or join an existing one
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <button
                onClick={() => setView("create")}
                className="w-full p-4 rounded-xl border border-border/50 bg-secondary/30 hover:bg-secondary/50 hover:border-primary/50 transition-all duration-200 flex items-center gap-4 group"
              >
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-secondary flex items-center justify-center group-hover:bg-secondary/80 transition-colors flex-shrink-0">
                  <Plus className="w-5 h-5 sm:w-6 sm:h-6 text-muted-foreground" />
                </div>
                <div className="text-left flex-1 min-w-0">
                  <p className="font-medium tracking-tight">Create My Own</p>
                  <p className="text-sm text-muted-foreground truncate">Start fresh with your own server</p>
                </div>
              </button>

              <button
                onClick={handleJoinClick}
                className="w-full p-4 rounded-xl border border-border/50 bg-secondary/30 hover:bg-secondary/50 hover:border-primary/50 transition-all duration-200 flex items-center gap-4 group"
              >
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-secondary flex items-center justify-center group-hover:bg-secondary/80 transition-colors flex-shrink-0">
                  <Users className="w-5 h-5 sm:w-6 sm:h-6 text-muted-foreground" />
                </div>
                <div className="text-left flex-1 min-w-0">
                  <p className="font-medium tracking-tight">Join a Server</p>
                  <p className="text-sm text-muted-foreground truncate">Enter an invite code to join</p>
                </div>
              </button>

              <button
                onClick={handleExploreClick}
                className="w-full p-4 rounded-xl border border-border/50 bg-secondary/30 hover:bg-secondary/50 hover:border-primary/50 transition-all duration-200 flex items-center gap-4 group"
              >
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-secondary flex items-center justify-center group-hover:bg-secondary/80 transition-colors flex-shrink-0">
                  <Compass className="w-5 h-5 sm:w-6 sm:h-6 text-muted-foreground" />
                </div>
                <div className="text-left flex-1 min-w-0">
                  <p className="font-medium tracking-tight">Explore Servers</p>
                  <p className="text-sm text-muted-foreground truncate">Discover and join public communities</p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Create View */}
        {view === "create" && (
          <div className="p-4 sm:p-6">
            <DialogHeader className="pb-4">
              <div className="text-center">
                <DialogTitle className="text-xl font-medium">Create Your Server</DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground mt-1">
                  Make yours and start talking
                </DialogDescription>
              </div>
            </DialogHeader>

            <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-5">
              {/* Icon Upload */}
              <div className="flex flex-col items-center gap-2 p-4 bg-secondary/30 backdrop-blur-sm rounded-xl border border-border/30">
                <div className="relative">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-secondary flex items-center justify-center border-2 border-dashed border-muted-foreground/30 cursor-pointer hover:border-primary/50 transition-all duration-200 overflow-hidden"
                  >
                    {iconPreview ? (
                      <img src={iconPreview} alt="Server icon preview" className="w-full h-full object-cover" />
                    ) : (
                      <Upload className="w-6 h-6 text-muted-foreground" />
                    )}
                  </div>
                  {iconPreview && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        clearIcon();
                      }}
                      className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:bg-destructive/90 transition-colors shadow-lg"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Click to upload an icon (optional)</p>
              </div>

              {/* Server Name */}
              <div className="space-y-2">
                <Label htmlFor="name" className="text-xs font-medium uppercase text-muted-foreground tracking-wide">
                  Server Name
                </Label>
                <Input
                  id="name"
                  placeholder="My Awesome Server"
                  {...createForm.register("name")}
                  className={`rounded-xl ${createForm.formState.errors.name ? "border-destructive focus-visible:ring-destructive" : ""}`}
                  autoFocus
                />
                {createForm.formState.errors.name && (
                  <p className="text-xs text-destructive">{createForm.formState.errors.name.message}</p>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                By creating a server, you agree to our Community Guidelines.
              </p>

              {/* Actions */}
              <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-2 sm:gap-3 pt-2 border-t border-border/30">
                <Button type="button" variant="outline" rounded="xl" onClick={handleBack} className="flex-1 sm:flex-none">
                  Back
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading}
                  rounded="xl"
                  className="flex-1 sm:flex-none"
                >
                  {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Create Server
                </Button>
              </div>
            </form>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
