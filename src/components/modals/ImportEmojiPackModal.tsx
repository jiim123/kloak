import { useState } from "react";
import { Loader2, Package, AlertCircle, CheckCircle2, ExternalLink, Download } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useUIStore } from "@/stores/uiStore";
import { useServerStore } from "@/stores/serverStore";
import { useAuthStore } from "@/stores/authStore";
import { supabase } from "@/integrations/supabase/client";
import { secureUpload, secureDelete } from "@/lib/storageUpload";
import { toast } from "sonner";
import { invalidateServerEmojis } from "@/lib/serverEmojis";

const MAX_SERVER_EMOJIS = 30;
const EMOJI_NAME_REGEX = /^[a-z0-9_]{2,32}$/;

type EmojiPackEmoji = {
  name: string;
  imageUrl: string;
  originalName: string;
};

type EmojiPackData = {
  name: string;
  slug: string;
  emojiCount: number;
  emojis: EmojiPackEmoji[];
};

export const ImportEmojiPackModal = () => {
  const { activeModal, closeModal } = useUIStore();
  const { currentServer } = useServerStore();
  const { user } = useAuthStore();

  const [packUrl, setPackUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [packData, setPackData] = useState<EmojiPackData | null>(null);
  const [selectedEmojis, setSelectedEmojis] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);
  const [importResult, setImportResult] = useState<{ success: number; failed: number } | null>(null);

  const isOpen = activeModal === "import-emoji-pack";

  const handleClose = () => {
    setPackUrl("");
    setPackData(null);
    setSelectedEmojis(new Set());
    setError(null);
    setImportProgress(null);
    setImportResult(null);
    closeModal();
  };

  const fetchPack = async () => {
    if (!packUrl.trim()) {
      setError("Please enter an emoji.gg pack URL");
      return;
    }

    setIsLoading(true);
    setError(null);
    setPackData(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("fetch-emoji-pack", {
        body: { packUrl: packUrl.trim() },
      });

      if (fnError) throw fnError;

      if (data?.error) {
        setError(data.error);
        return;
      }

      if (data?.pack) {
        setPackData(data.pack);
        // Auto-select all emojis by default
        setSelectedEmojis(new Set(data.pack.emojis.map((e: EmojiPackEmoji) => e.name)));
      }
    } catch (err: any) {
      console.error("Error fetching pack:", err);
      setError(err?.message || "Failed to fetch emoji pack");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleEmoji = (emojiName: string) => {
    setSelectedEmojis((prev) => {
      const next = new Set(prev);
      if (next.has(emojiName)) {
        next.delete(emojiName);
      } else {
        next.add(emojiName);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (!packData) return;

    if (selectedEmojis.size === packData.emojis.length) {
      setSelectedEmojis(new Set());
    } else {
      setSelectedEmojis(new Set(packData.emojis.map((e) => e.name)));
    }
  };

  const importEmojis = async () => {
    if (!currentServer || !user || !packData || selectedEmojis.size === 0) return;

    setIsImporting(true);
    setImportProgress({ current: 0, total: selectedEmojis.size });

    const emojisToImport = packData.emojis.filter((e) => selectedEmojis.has(e.name));
    let successCount = 0;
    let failedCount = 0;

    try {
      // Check current emoji count
      const { count: currentCount } = await supabase
        .from("server_emojis")
        .select("*", { count: "exact", head: true })
        .eq("server_id", currentServer.id);

      const availableSlots = MAX_SERVER_EMOJIS - (currentCount ?? 0);
      
      if (availableSlots <= 0) {
        toast.error(`Server already has ${MAX_SERVER_EMOJIS} emojis. Delete some to import more.`);
        setIsImporting(false);
        return;
      }

      const emojisToProcess = emojisToImport.slice(0, availableSlots);

      if (emojisToProcess.length < emojisToImport.length) {
        toast.warning(`Only importing ${emojisToProcess.length} of ${emojisToImport.length} emojis due to limit`);
      }

      // Get existing emoji names to avoid duplicates
      const { data: existingEmojis } = await supabase
        .from("server_emojis")
        .select("name")
        .eq("server_id", currentServer.id);

      const existingNames = new Set((existingEmojis ?? []).map((e) => e.name));

      for (let i = 0; i < emojisToProcess.length; i++) {
        const emoji = emojisToProcess[i];
        setImportProgress({ current: i + 1, total: emojisToProcess.length });

        try {
          // Normalize name for storage
          let normalizedName = emoji.name.replace(/[^a-z0-9_]/gi, "_").toLowerCase().slice(0, 32);
          
          // Ensure minimum length
          if (normalizedName.length < 2) {
            normalizedName = `emoji_${normalizedName}`;
          }

          // Make unique if exists
          let uniqueName = normalizedName;
          let counter = 1;
          while (existingNames.has(uniqueName)) {
            uniqueName = `${normalizedName.slice(0, 28)}_${counter}`;
            counter++;
          }

          if (!EMOJI_NAME_REGEX.test(uniqueName)) {
            console.warn(`Invalid emoji name: ${uniqueName}, skipping`);
            failedCount++;
            continue;
          }

          // Fetch the image
          const imgResponse = await fetch(emoji.imageUrl);
          if (!imgResponse.ok) throw new Error("Failed to fetch image");

          const imgBlob = await imgResponse.blob();
          
          // Determine extension from content-type
          const contentType = imgBlob.type;
          let ext = "png";
          if (contentType.includes("gif")) ext = "gif";
          else if (contentType.includes("webp")) ext = "webp";

          const filePath = `${currentServer.id}/${uniqueName}-${crypto.randomUUID()}.${ext}`;

          // Upload to storage
          await secureUpload("server-emojis", filePath, imgBlob, {
            contentType: imgBlob.type,
            upsert: false,
          });

          // Insert to database via RPC
          const { error: insertError } = await (supabase.rpc as any)('upload_server_emoji', {
            _server_id: currentServer.id,
            _user_id: user.id,
            _name: uniqueName,
            _file_path: filePath
          });

          if (insertError) {
            // Try to clean up uploaded file
            await secureDelete("server-emojis", filePath);
            throw insertError;
          }

          existingNames.add(uniqueName);
          successCount++;
        } catch (emojiError) {
          console.error(`Failed to import emoji ${emoji.name}:`, emojiError);
          failedCount++;
        }
      }

      invalidateServerEmojis(currentServer.id);
      setImportResult({ success: successCount, failed: failedCount });

      if (successCount > 0) {
        toast.success(`Imported ${successCount} emoji${successCount > 1 ? "s" : ""}`);
      }
      if (failedCount > 0) {
        toast.error(`Failed to import ${failedCount} emoji${failedCount > 1 ? "s" : ""}`);
      }
    } catch (err: any) {
      console.error("Import error:", err);
      toast.error(err?.message || "Failed to import emojis");
    } finally {
      setIsImporting(false);
      setImportProgress(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-lg max-w-[calc(100vw-2rem)] bg-background/95 backdrop-blur-xl border-border/50 rounded-2xl p-0 max-h-[90vh] flex flex-col">
        <div className="p-4 sm:p-6 pb-0">
          <DialogHeader className="pb-4">
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Package className="w-6 h-6 text-primary" />
              </div>
              <div className="text-center">
                <DialogTitle className="text-xl font-semibold">Import Emoji Pack</DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground mt-1">
                  Import emojis from{" "}
                  <a
                    href="https://emoji.gg/packs"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1"
                  >
                    emoji.gg
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="px-4 sm:px-6 pb-4 sm:pb-6 flex-1 overflow-hidden flex flex-col">
          {importResult ? (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-3 p-4 bg-[hsl(var(--kloak-success))]/10 border border-[hsl(var(--kloak-success))]/20 rounded-xl">
                <CheckCircle2 className="w-5 h-5 text-[hsl(var(--kloak-success))] flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold text-[hsl(var(--kloak-success))]">Import Complete!</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Successfully imported {importResult.success} emoji
                    {importResult.success !== 1 ? "s" : ""}
                    {importResult.failed > 0 && ` (${importResult.failed} failed)`}
                  </p>
                </div>
              </div>
              <Button onClick={handleClose} className="w-full rounded-xl">
                Close
              </Button>
            </div>
          ) : !packData ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="packUrl" className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
                  Emoji Pack URL
                </Label>
                <Input
                  id="packUrl"
                  value={packUrl}
                  onChange={(e) => setPackUrl(e.target.value)}
                  placeholder="https://emoji.gg/pack/1234-pack-name"
                  className="rounded-xl"
                  disabled={isLoading}
                  onKeyDown={(e) => e.key === "Enter" && fetchPack()}
                />
              </div>

              <div className="bg-secondary/30 backdrop-blur-sm rounded-xl p-3 border border-border/30">
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium">How to get a pack URL:</span>
                </p>
                <ol className="text-xs text-muted-foreground mt-1 list-decimal list-inside space-y-1">
                  <li>
                    Visit{" "}
                    <a
                      href="https://emoji.gg/packs"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      emoji.gg/packs
                    </a>
                  </li>
                  <li>Browse and select an emoji pack</li>
                  <li>Copy the URL from your browser</li>
                  <li>Paste it above</li>
                </ol>
              </div>

              {error && (
                <div className="flex items-start gap-3 p-4 bg-destructive/10 border border-destructive/20 rounded-xl">
                  <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold text-destructive">Error</p>
                    <p className="text-sm text-muted-foreground mt-1">{error}</p>
                  </div>
                </div>
              )}

              <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2 border-t border-border/30">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleClose}
                  disabled={isLoading}
                  className="flex-1 sm:flex-none rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  onClick={fetchPack}
                  disabled={isLoading || !packUrl.trim()}
                  className="flex-1 sm:flex-none rounded-xl"
                >
                  {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Fetch Pack
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 flex flex-col flex-1 overflow-hidden">
              {/* Pack Info */}
              <div className="bg-secondary/30 backdrop-blur-sm rounded-xl p-3 border border-border/30">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold">{packData.name}</h4>
                    <p className="text-xs text-muted-foreground">{packData.emojiCount} emojis in pack</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleAll}
                    className="text-xs rounded-xl"
                  >
                    {selectedEmojis.size === packData.emojis.length ? "Deselect All" : "Select All"}
                  </Button>
                </div>
              </div>

              {/* Emoji Grid */}
              <ScrollArea className="flex-1 -mx-4 sm:-mx-6 px-4 sm:px-6">
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {packData.emojis.map((emoji) => (
                    <button
                      key={emoji.name}
                      onClick={() => toggleEmoji(emoji.name)}
                      className={`
                        relative p-2 rounded-xl border transition-all
                        ${
                          selectedEmojis.has(emoji.name)
                            ? "border-primary bg-primary/10"
                            : "border-border/30 bg-secondary/30 hover:border-primary/50"
                        }
                      `}
                      title={emoji.originalName}
                    >
                      <img
                        src={emoji.imageUrl}
                        alt={emoji.originalName}
                        className="w-8 h-8 mx-auto object-contain"
                        loading="lazy"
                      />
                      {selectedEmojis.has(emoji.name) && (
                        <div className="absolute top-1 right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                          <CheckCircle2 className="w-3 h-3 text-primary-foreground" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </ScrollArea>

              {/* Progress */}
              {importProgress && (
                <div className="bg-secondary/30 backdrop-blur-sm rounded-xl p-3 border border-border/30">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    <span className="text-sm">
                      Importing {importProgress.current} of {importProgress.total}...
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2 border-t border-border/30">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setPackData(null)}
                  disabled={isImporting}
                  className="flex-1 sm:flex-none rounded-xl"
                >
                  Back
                </Button>
                <Button
                  onClick={importEmojis}
                  disabled={isImporting || selectedEmojis.size === 0}
                  className="flex-1 sm:flex-none rounded-xl"
                >
                  {isImporting ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 mr-2" />
                  )}
                  Import {selectedEmojis.size} Emoji{selectedEmojis.size !== 1 ? "s" : ""}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
