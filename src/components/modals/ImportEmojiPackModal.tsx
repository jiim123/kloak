import { useState, useRef, useCallback } from "react";
import { Loader2, Package, AlertCircle, CheckCircle2, ExternalLink, Download, Upload, FileArchive } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useUIStore } from "@/stores/uiStore";
import { useServerStore } from "@/stores/serverStore";
import { useAuthStore } from "@/stores/authStore";
import { supabase } from "@/integrations/supabase/client";
import { secureUpload, secureDelete } from "@/lib/storageUpload";
import { toast } from "sonner";
import { invalidateServerEmojis } from "@/lib/serverEmojis";
import { invalidateGlobalEmojiCache } from "@/lib/globalEmojiResolver";
import JSZip from "jszip";

const MAX_SERVER_EMOJIS = 50;
const MAX_ZIP_SIZE = 50 * 1024 * 1024; // 50MB
const EMOJI_NAME_REGEX = /^[a-z0-9_]{2,32}$/;
const IMAGE_EXTENSIONS = new Set(["png", "gif", "webp"]);

type ExtractedEmoji = {
  name: string;
  fileName: string;
  blob: Blob;
  previewUrl: string;
  ext: string;
};

export const ImportEmojiPackModal = () => {
  const { activeModal, closeModal } = useUIStore();
  const { currentServer } = useServerStore();
  const { user } = useAuthStore();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [extractedEmojis, setExtractedEmojis] = useState<ExtractedEmoji[]>([]);
  const [selectedEmojis, setSelectedEmojis] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);
  const [importResult, setImportResult] = useState<{ success: number; failed: number } | null>(null);
  const [zipName, setZipName] = useState<string | null>(null);

  const isOpen = activeModal === "import-emoji-pack";

  const cleanupPreviews = useCallback(() => {
    extractedEmojis.forEach((e) => URL.revokeObjectURL(e.previewUrl));
  }, [extractedEmojis]);

  const handleClose = () => {
    cleanupPreviews();
    setExtractedEmojis([]);
    setSelectedEmojis(new Set());
    setError(null);
    setImportProgress(null);
    setImportResult(null);
    setZipName(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    closeModal();
  };

  const normalizeEmojiName = (fileName: string): string => {
    // Strip extension
    const base = fileName.replace(/\.[^.]+$/, "");
    // Strip leading numeric ID prefix (e.g. "9563_" or "9563-")
    const stripped = base.replace(/^\d+[-_]/, "");
    // Slugify
    const slug = (stripped || base).replace(/[^a-z0-9_]/gi, "_").toLowerCase().slice(0, 32);
    return slug.length < 2 ? `emoji_${slug}` : slug;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_ZIP_SIZE) {
      setError("Zip file is too large (max 50MB)");
      return;
    }

    setIsExtracting(true);
    setError(null);
    cleanupPreviews();
    setExtractedEmojis([]);

    try {
      const zip = await JSZip.loadAsync(file);
      const emojis: ExtractedEmoji[] = [];

      const entries = Object.entries(zip.files).filter(([, f]) => !f.dir);

      for (const [path, zipEntry] of entries) {
        const fileName = path.split("/").pop() || path;
        const ext = fileName.split(".").pop()?.toLowerCase() || "";
        if (!IMAGE_EXTENSIONS.has(ext)) continue;

        const blob = await zipEntry.async("blob");
        const typedBlob = new Blob([blob], {
          type: ext === "gif" ? "image/gif" : ext === "webp" ? "image/webp" : "image/png",
        });
        const previewUrl = URL.createObjectURL(typedBlob);
        const name = normalizeEmojiName(fileName);

        emojis.push({ name, fileName, blob: typedBlob, previewUrl, ext });
      }

      if (emojis.length === 0) {
        setError("No image files (PNG, GIF, WebP) found in the zip");
        return;
      }

      setExtractedEmojis(emojis);
      setSelectedEmojis(new Set(emojis.map((e) => e.fileName)));
      setZipName(file.name);
    } catch (err: any) {
      console.error("Error extracting zip:", err);
      setError("Failed to read zip file. Make sure it's a valid zip archive.");
    } finally {
      setIsExtracting(false);
    }
  };

  const toggleEmoji = (fileName: string) => {
    setSelectedEmojis((prev) => {
      const next = new Set(prev);
      if (next.has(fileName)) next.delete(fileName);
      else next.add(fileName);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedEmojis.size === extractedEmojis.length) {
      setSelectedEmojis(new Set());
    } else {
      setSelectedEmojis(new Set(extractedEmojis.map((e) => e.fileName)));
    }
  };

  const importEmojis = async () => {
    if (!currentServer || !user || extractedEmojis.length === 0 || selectedEmojis.size === 0) return;

    setIsImporting(true);
    setImportProgress({ current: 0, total: selectedEmojis.size });

    const emojisToImport = extractedEmojis.filter((e) => selectedEmojis.has(e.fileName));
    let successCount = 0;
    let failedCount = 0;

    try {
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

      const { data: existingEmojis } = await supabase
        .from("server_emojis")
        .select("name")
        .eq("server_id", currentServer.id);

      const existingNames = new Set((existingEmojis ?? []).map((e) => e.name));

      for (let i = 0; i < emojisToProcess.length; i++) {
        const emoji = emojisToProcess[i];
        setImportProgress({ current: i + 1, total: emojisToProcess.length });

        try {
          let uniqueName = emoji.name;
          let counter = 1;
          while (existingNames.has(uniqueName)) {
            uniqueName = `${emoji.name.slice(0, 8)}_${counter}`;
            counter++;
          }

          if (!EMOJI_NAME_REGEX.test(uniqueName)) {
            console.warn(`Invalid emoji name: ${uniqueName}, skipping`);
            failedCount++;
            continue;
          }

          const filePath = `${currentServer.id}/${uniqueName}-${crypto.randomUUID()}.${emoji.ext}`;

          await secureUpload("server-emojis", filePath, emoji.blob, {
            contentType: emoji.blob.type,
            upsert: false,
          });

          const { error: insertError } = await (supabase.rpc as any)("upload_server_emoji", {
            _server_id: currentServer.id,
            _user_id: user.id,
            _name: uniqueName,
            _file_path: filePath,
          });

          if (insertError) {
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
      invalidateGlobalEmojiCache();
      window.dispatchEvent(new CustomEvent("server-emojis-changed", { detail: { serverId: currentServer.id } }));
      setImportResult({ success: successCount, failed: failedCount });

      if (successCount > 0) toast.success(`Imported ${successCount} emoji${successCount > 1 ? "s" : ""}`);
      if (failedCount > 0) toast.error(`Failed to import ${failedCount} emoji${failedCount > 1 ? "s" : ""}`);
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
                  Upload a zip file downloaded from{" "}
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
          ) : extractedEmojis.length === 0 ? (
            <div className="space-y-4">
              {/* File upload area */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip"
                onChange={handleFileSelect}
                className="hidden"
                disabled={isExtracting}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isExtracting}
                className="w-full border-2 border-dashed border-border/50 hover:border-primary/50 rounded-xl p-8 flex flex-col items-center gap-3 transition-colors text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                {isExtracting ? (
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                ) : (
                  <FileArchive className="w-8 h-8" />
                )}
                <div className="text-center">
                  <p className="text-sm font-medium">
                    {isExtracting ? "Extracting emojis..." : "Click to select a zip file"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Max 50MB</p>
                </div>
              </button>

              <div className="bg-secondary/30 backdrop-blur-sm rounded-xl p-3 border border-border/30">
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium">How to get a pack zip:</span>
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
                  <li>Select an emoji pack</li>
                  <li>Click the download button to get the zip</li>
                  <li>Upload the zip file here</li>
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
                  disabled={isExtracting}
                  className="flex-1 sm:flex-none rounded-xl"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 flex flex-col flex-1 overflow-hidden">
              {/* Pack Info */}
              <div className="bg-secondary/30 backdrop-blur-sm rounded-xl p-3 border border-border/30">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold">{zipName}</h4>
                    <p className="text-xs text-muted-foreground">{extractedEmojis.length} emojis found</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={toggleAll} className="text-xs rounded-xl">
                    {selectedEmojis.size === extractedEmojis.length ? "Deselect All" : "Select All"}
                  </Button>
                </div>
              </div>

              {/* Emoji Grid */}
              <ScrollArea className="flex-1 -mx-4 sm:-mx-6 px-4 sm:px-6">
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {extractedEmojis.map((emoji) => (
                    <button
                      key={emoji.fileName}
                      onClick={() => toggleEmoji(emoji.fileName)}
                      className={`
                        relative p-2 rounded-xl border transition-all
                        ${
                          selectedEmojis.has(emoji.fileName)
                            ? "border-primary bg-primary/10"
                            : "border-border/30 bg-secondary/30 hover:border-primary/50"
                        }
                      `}
                      title={emoji.name}
                    >
                      <img
                        src={emoji.previewUrl}
                        alt={emoji.name}
                        className="w-8 h-8 mx-auto object-contain"
                        loading="lazy"
                      />
                      {selectedEmojis.has(emoji.fileName) && (
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
                  onClick={() => {
                    cleanupPreviews();
                    setExtractedEmojis([]);
                    setSelectedEmojis(new Set());
                    setZipName(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
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
