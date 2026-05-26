import { useEffect, useState, useRef } from "react";
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
  Gamepad2,
  Gift,
  Headphones,
  IceCream,
  Mic2,
  Music2,
  Paintbrush,
  Sparkles,
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
import { getServerInitials } from "@/lib/serverUtils";
import { toast } from "sonner";

const MAX_ICON_SIZE = 1 * 1024 * 1024; // 1MB
const ALLOWED_ICON_TYPES = ["image/jpeg", "image/png", "image/webp"];

const createServerSchema = z.object({
  name: z.string().trim().min(1, "Server name is required").max(50, "Server name must be less than 50 characters"),
});

type CreateServerForm = z.infer<typeof createServerSchema>;
type ModalView = "choose" | "create";

const CreateServerBackdrop = () => {
  const iconClass = "absolute h-7 w-7 text-muted-foreground/70 animate-[create-server-icon-float_18s_linear_infinite]";

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden bg-background"
    >
      <Sparkles className={`${iconClass} left-[17%] top-[25%] rotate-[-8deg]`} strokeWidth={1.4} />
      <IceCream className={`${iconClass} left-[42%] top-[4%] rotate-[-5deg] [animation-delay:-7s]`} strokeWidth={1.4} />
      <Headphones className={`${iconClass} right-[16%] top-[2%] [animation-delay:-12s]`} strokeWidth={1.4} />
      <Gift className={`${iconClass} right-[4%] top-[-1%] [animation-delay:-3s]`} strokeWidth={1.4} />
      <Mic2 className={`${iconClass} right-[29%] top-[34%] [animation-delay:-15s]`} strokeWidth={1.4} />
      <Gamepad2 className={`${iconClass} right-[10%] top-[38%] [animation-delay:-5s]`} strokeWidth={1.4} />
      <Music2 className={`${iconClass} left-[33%] top-[48%] rotate-[10deg] [animation-delay:-10s]`} strokeWidth={1.4} />
      <Paintbrush className={`${iconClass} right-[24%] top-[63%] rotate-[8deg] [animation-delay:-2s]`} strokeWidth={1.4} />
      <Gamepad2 className={`${iconClass} bottom-[8%] right-[6%] [animation-delay:-13s]`} strokeWidth={1.4} />
      <Mic2 className={`${iconClass} bottom-[7%] left-[7%] [animation-delay:-8s]`} strokeWidth={1.4} />
      <Sparkles className={`${iconClass} bottom-[16%] left-[14%] rotate-[7deg] [animation-delay:-16s]`} strokeWidth={1.4} />
      <IceCream className={`${iconClass} bottom-[2%] left-[36%] [animation-delay:-4s]`} strokeWidth={1.4} />
      <Gift className={`${iconClass} bottom-[31%] right-[0.5%] rotate-[8deg] [animation-delay:-11s]`} strokeWidth={1.4} />
      <Paintbrush className={`${iconClass} top-[64%] left-[75%] rotate-[-12deg] [animation-delay:-6s]`} strokeWidth={1.4} />
    </div>
  );
};

export const CreateServerModal = () => {
  const navigate = useNavigate();
  const { activeModal, modalData, closeModal, openModal } = useUIStore();
  const { createServer, updateServer, setCurrentServer, fetchChannels } = useServerStore();
  const { user } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [createdServer, setCreatedServer] = useState<{ id: string; name: string; icon_url?: string | null } | null>(null);
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
  const defaultView = modalData?.defaultView === "create" ? "create" : "choose";
  const serverName = createForm.watch("name");
  const canContinue = serverName.trim().length > 0 && !isLoading;

  // Allow callers (e.g. left add-server panel) to skip chooser.
  useEffect(() => {
    if (!isOpen) return;
    setView(defaultView);
  }, [defaultView, isOpen]);

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
        let finalIconUrl = server.icon_url;
        if (iconFile) {
          const iconUrl = await uploadIcon(server.id, iconFile);
          if (iconUrl) {
            await updateServer(server.id, user.id, { icon_url: iconUrl });
            finalIconUrl = iconUrl;
          }
        }

        await updateServer(server.id, user.id, { banner_url: "/default_server_banner.png" });

        const serverWithBanner = {
          ...server,
          icon_url: finalIconUrl,
          banner_url: "/default_server_banner.png",
        };

        setCurrentServer(serverWithBanner);
        await fetchChannels(server.id);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        setCreatedServer({
          id: server.id,
          name: server.name,
          icon_url: serverWithBanner.icon_url,
        });
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
    setCreatedServer(null);
    clearIcon();
    closeModal();
  };

  const handleEnterCreatedServer = () => {
    if (!createdServer) return;
    navigate(`/app/servers/${createdServer.id}`);
    handleClose();
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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        className={
          view === "create"
            ? "!left-0 !top-0 !h-screen !w-screen !max-w-none !translate-x-0 !translate-y-0 overflow-hidden border-0 bg-transparent p-0 shadow-none sm:rounded-none [&>button]:right-5 [&>button]:top-5 [&>button]:text-muted-foreground [&>button:hover]:text-white"
            : "!left-0 !right-0 !top-auto !bottom-0 !w-full !max-w-none !translate-x-0 !translate-y-0 max-h-[85vh] overflow-hidden rounded-t-2xl rounded-b-none border-border/50 bg-background/95 p-0 backdrop-blur-xl data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-left-0 data-[state=open]:slide-in-from-top-0 data-[state=closed]:slide-out-to-left-0 data-[state=closed]:slide-out-to-top-0 data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-100 sm:!left-[50%] sm:!right-auto sm:!top-[50%] sm:!bottom-auto sm:!w-full sm:!max-w-xl sm:!translate-x-[-50%] sm:!translate-y-[-50%] sm:max-h-[90vh] sm:rounded-2xl"
        }
      >
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
          <div className="relative flex min-h-screen w-full items-center justify-center px-4 py-10 text-white">
            <CreateServerBackdrop />
            <form
              onSubmit={createForm.handleSubmit(onCreateSubmit)}
              className="relative z-10 w-full max-w-[400px] rounded-[5px] border border-white/[0.03] bg-card px-8 pb-8 pt-7 shadow-[0_18px_40px_rgba(0,0,0,0.35)] sm:px-10"
            >
              {isLoading ? (
                <div className="flex min-h-[320px] w-full flex-col items-center justify-center gap-4">
                  <CheckmarkAnimation size={72} />
                  <p className="text-sm font-medium text-white">Creating server...</p>
                </div>
              ) : createdServer ? (
                <div className="flex min-h-[320px] w-full flex-col items-center justify-center">
                  <div className="mb-6 text-center">
                    <p className="text-[28px] font-semibold leading-none text-white">Nice work!</p>
                  </div>

                  <div className="mb-4 flex h-[72px] w-[72px] items-center justify-center overflow-hidden rounded-[12px] bg-background text-[30px] font-semibold text-white">
                    {createdServer.icon_url ? (
                      <img src={createdServer.icon_url} alt={createdServer.name} className="h-full w-full object-cover" />
                    ) : (
                      <span>{getServerInitials(createdServer.name)}</span>
                    )}
                  </div>

                  <p className="mb-2 max-w-[280px] truncate pb-1 text-center text-[32px] font-semibold leading-[1.15] text-white">{createdServer.name}</p>
                  <p className="mb-8 text-center text-[14px] text-foreground">Your server is personalized and ready for you.</p>

                  <Button
                    type="button"
                    onClick={handleEnterCreatedServer}
                    className="h-[34px] w-full max-w-[235px] rounded-[3px] bg-primary text-[13px] font-medium text-primary-foreground hover:bg-primary"
                  >
                    Let&apos;s go
                  </Button>
                </div>
              ) : (
                <>
                  <DialogHeader className="pb-6 text-center sm:text-center">
                    <div className="relative flex items-center justify-center">
                      <DialogTitle className="text-[20px] font-medium leading-6 text-white">
                        Personalize your server
                      </DialogTitle>
                    </div>
                    <DialogDescription className="mx-auto mt-2 max-w-[310px] text-center text-[12px] font-normal leading-[16px] text-foreground">
                      Your server is where everyone gets to chat. Give it an avatar and name. You can always change it later.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="mb-6 flex flex-col items-center">
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="relative flex h-[74px] w-[74px] flex-col items-center justify-center gap-1 overflow-hidden rounded-[12px] border-2 border-dashed border-input bg-transparent text-muted-foreground transition-colors hover:border-white hover:text-white"
                        aria-label="Upload server icon"
                      >
                        {iconPreview ? (
                          <img src={iconPreview} alt="Server icon preview" className="h-full w-full object-cover" />
                        ) : (
                          <>
                            <Camera className="h-6 w-6" />
                            <span className="text-[10px] font-normal uppercase leading-none">Upload</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute -bottom-3 -right-3 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_3px_8px_rgba(0,0,0,0.35)] transition-colors hover:bg-primary"
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
                          className="absolute -top-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground shadow-md transition-colors hover:bg-muted hover:text-white"
                          aria-label="Remove server icon"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="mx-auto mb-8 w-full max-w-[235px] space-y-1 text-center">
                    <Label htmlFor="name" className="block text-center text-[12px] font-normal leading-4 text-muted-foreground">
                      Enter your server name
                    </Label>
                    <Input
                      id="name"
                      aria-label="Enter your server name"
                      {...createForm.register("name")}
                      className="mx-auto h-8 rounded-none border-0 border-b border-input/75 bg-transparent px-0 text-center text-[15px] font-normal text-white shadow-none outline-none ring-0 placeholder:text-muted-foreground focus-visible:border-white focus-visible:ring-0 focus-visible:ring-offset-0"
                      autoFocus
                      maxLength={50}
                    />
                    {createForm.formState.errors.name && (
                      <p className="text-xs font-normal text-red-300">{createForm.formState.errors.name.message}</p>
                    )}
                  </div>

                  <div className="mx-auto flex w-full max-w-[235px] flex-col items-center gap-3">
                    <Button
                      type="submit"
                      disabled={!canContinue}
                      className={`h-[28px] w-full rounded-[3px] text-[12px] font-normal disabled:opacity-100 ${
                        canContinue
                          ? "bg-primary text-primary-foreground hover:bg-primary"
                          : "bg-primary text-primary-foreground/70"
                      }`}
                    >
                      Continue
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={handleClose}
                      className="h-6 rounded-[3px] px-3 text-[12px] font-normal text-muted-foreground hover:bg-transparent hover:text-white"
                    >
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
