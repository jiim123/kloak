import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Camera,
  Compass,
  Plus,
  Trash2,
  Users,
  ArrowLeft,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckmarkAnimation } from "@/components/ui/checkmark-animation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUIStore } from "@/stores/uiStore";
import { useServerStore } from "@/stores/serverStore";
import { useAuthStore } from "@/stores/authStore";
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
  const serverName = createForm.watch("name");
  const canContinue = serverName.trim().length > 0 && !isLoading;

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
        await new Promise((resolve) => setTimeout(resolve, 1000));
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
      <DialogContent className="sm:max-w-xl max-w-[calc(100vw-2rem)] max-h-[90vh] overflow-hidden bg-background/95 backdrop-blur-xl border-border/50 rounded-2xl p-0">
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
            <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="rounded-xl border border-border/50 bg-card/60 p-5 sm:p-6">
              {isLoading ? (
                <div className="flex min-h-[320px] w-full flex-col items-center justify-center gap-4">
                  <CheckmarkAnimation size={72} />
                  <p className="text-sm font-medium text-foreground">Creating server...</p>
                </div>
              ) : (
                <>
                  <DialogHeader className="pb-5">
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={handleBack}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground"
                        aria-label="Back"
                      >
                        <ArrowLeft className="h-4 w-4" />
                      </button>
                      <DialogTitle className="text-lg font-medium text-center">Personalize your server</DialogTitle>
                      <div className="h-8 w-8" />
                    </div>
                    <DialogDescription className="mx-auto mt-2 max-w-[360px] text-center text-sm text-muted-foreground">
                      Your server is where everyone gets to chat. Give it an avatar and name. You can always change it later.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="mb-6 flex flex-col items-center">
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="relative flex h-24 w-24 flex-col items-center justify-center gap-1 overflow-hidden rounded-xl border-2 border-dashed border-border bg-secondary/40 text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
                        aria-label="Upload server icon"
                      >
                        {iconPreview ? (
                          <img src={iconPreview} alt="Server icon preview" className="h-full w-full object-cover" />
                        ) : (
                          <>
                            <Camera className="h-5 w-5" />
                            <span className="text-xs font-medium">Upload</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-colors hover:bg-primary-hover"
                        aria-label="Choose server icon"
                      >
                        <Plus className="h-4 w-4" strokeWidth={3} />
                      </button>
                      {iconPreview && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            clearIcon();
                          }}
                          className="absolute -top-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full bg-background/95 text-muted-foreground shadow-md transition-colors hover:bg-secondary hover:text-foreground"
                          aria-label="Remove server icon"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="mx-auto mb-7 w-full max-w-[320px] space-y-2">
                    <Label htmlFor="name" className="text-xs font-medium text-muted-foreground">
                      Server Name
                    </Label>
                    <Input
                      id="name"
                      aria-label="Enter your server name"
                      {...createForm.register("name")}
                      className="h-10 rounded-xl border-border/60 bg-background/50 px-3 text-base text-foreground"
                      autoFocus
                      maxLength={50}
                    />
                    {createForm.formState.errors.name && (
                      <p className="text-xs font-medium text-destructive">{createForm.formState.errors.name.message}</p>
                    )}
                  </div>

                  <div className="mx-auto flex w-full max-w-[320px] flex-col gap-2">
                    <Button
                      type="submit"
                      disabled={!canContinue}
                      className="h-10 rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
                    >
                      Continue
                    </Button>
                    <Button type="button" variant="outline" rounded="xl" onClick={handleBack}>
                      Cancel
                    </Button>
                  </div>
                </>
              )}
            </form>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
