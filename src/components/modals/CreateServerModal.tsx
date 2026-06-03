import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Camera,
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

        const serverWithBanner = {
          ...server,
          icon_url: finalIconUrl,
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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        className={
          view === "create"
            ? "!left-0 !top-0 !h-screen !w-screen !max-w-none !translate-x-0 !translate-y-0 overflow-hidden border-0 bg-transparent p-0 shadow-none sm:rounded-none [&>button]:right-5 [&>button]:top-5 [&>button]:text-muted-foreground [&>button:hover]:text-white"
            : "max-h-[90vh] max-w-[calc(100vw-1.5rem)] gap-0 overflow-hidden rounded-[4px] border border-border bg-card p-0 text-foreground shadow-2xl sm:max-w-[448px]"
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
          <div className="flex max-h-[82vh] flex-col overflow-hidden">
            <div className="border-b border-border bg-muted px-5 py-3">
              <div className="text-base font-medium leading-none tracking-tight">
                Create a server
              </div>
            </div>

            <div className="space-y-4 overflow-y-auto px-6 py-4">
              <div className="space-y-3">
                <p className="text-sm leading-5 text-muted-foreground">
                  Your server is where your people hang out. Create your own space and start chatting.
                </p>

                <Button
                  type="button"
                  onClick={() => setView("create")}
                  className="h-9 w-full rounded-[3px] border border-border bg-secondary px-4 text-[13px] font-medium text-foreground hover:border-muted-foreground/40 hover:bg-muted"
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Create my own
                </Button>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <div className="h-px flex-1 bg-border" />
                <p className="text-xs text-muted-foreground">Have an invite already?</p>
                <div className="h-px flex-1 bg-border" />
              </div>

              <div className="flex justify-center">
                <Button
                  type="button"
                  onClick={handleJoinClick}
                  className="h-7 rounded-[3px] border border-border bg-card px-3 text-[12px] font-medium text-foreground hover:border-muted-foreground/40 hover:bg-muted [&_svg]:size-3"
                >
                  <Users className="mr-1 h-3 w-3" />
                  Join by invite
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Create View */}
        {view === "create" && (
          <div className="relative flex min-h-screen w-full items-center justify-center px-4 py-10 text-white">
            <CreateServerBackdrop />
            <form
              onSubmit={createForm.handleSubmit(onCreateSubmit)}
              className="relative z-10 w-full max-w-[400px] rounded-[4px] border border-border bg-card px-8 pb-8 pt-7 text-foreground shadow-2xl sm:px-10"
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
                      <DialogTitle className="text-base font-medium leading-none tracking-tight text-foreground">
                        Personalize your server
                      </DialogTitle>
                    </div>
                    <DialogDescription className="mx-auto mt-3 max-w-[310px] text-center text-sm leading-5 text-muted-foreground">
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
                            <span className="text-[10px] uppercase leading-none">Upload</span>
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
                    <Label htmlFor="name" className="block text-center text-xs font-medium leading-5 text-muted-foreground">
                      Enter your server name
                    </Label>
                    <Input
                      id="name"
                      aria-label="Enter your server name"
                      {...createForm.register("name")}
                      className="mx-auto h-10 rounded-none border-0 border-b border-input/75 bg-transparent px-0 text-center text-sm font-medium text-foreground shadow-none outline-none ring-0 placeholder:text-muted-foreground focus-visible:border-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
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
                      className={`h-9 w-full rounded-[3px] border text-[13px] font-medium disabled:opacity-100 ${
                        canContinue
                          ? "border-border bg-secondary text-foreground hover:border-muted-foreground/40 hover:bg-muted"
                          : "border-border bg-muted text-muted-foreground"
                      }`}
                    >
                      Continue
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={handleClose}
                      className="h-8 rounded-[3px] px-3 text-[13px] font-medium text-muted-foreground hover:bg-transparent hover:text-foreground"
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
