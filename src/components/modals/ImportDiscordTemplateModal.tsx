import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Download, AlertCircle, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUIStore } from "@/stores/uiStore";
import { useServerStore } from "@/stores/serverStore";
import { useAuthStore } from "@/stores/authStore";
import { toast } from "sonner";

const importTemplateSchema = z.object({
  templateUrl: z
    .string()
    .trim()
    .min(1, "Template URL is required")
    .refine(
      (url) => {
        try {
          const urlObj = new URL(url);
          return (
            urlObj.hostname.includes("discord.com") ||
            urlObj.hostname.includes("discord.gg") ||
            urlObj.hostname === "discord.new"
          );
        } catch {
          // If URL parsing fails, allow it (might be just a code)
          return true;
        }
      },
      { message: "Please enter a valid Discord template URL" }
    ),
});

type ImportTemplateForm = z.infer<typeof importTemplateSchema>;

export const ImportDiscordTemplateModal = () => {
  const { activeModal, closeModal } = useUIStore();
  const { currentServer, importDiscordTemplate, fetchChannels, fetchRoles } = useServerStore();
  const { user } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    error?: string;
    imported?: { categories: number; channels: number; roles: number };
  } | null>(null);

  const form = useForm<ImportTemplateForm>({
    resolver: zodResolver(importTemplateSchema),
    defaultValues: { templateUrl: "" },
  });

  const isOpen = activeModal === "import-discord-template";

  const handleClose = () => {
    form.reset();
    setImportResult(null);
    closeModal();
  };

  const onSubmit = async (data: ImportTemplateForm) => {
    if (!currentServer || !user) return;

    setIsLoading(true);
    setImportResult(null);

    try {
      const result = await importDiscordTemplate(currentServer.id, user.id, data.templateUrl);

      setImportResult(result);

      if (result.success) {
        toast.success(
          `Imported ${result.imported?.categories || 0} categories, ${result.imported?.channels || 0} channels, and ${result.imported?.roles || 0} roles!`
        );
        // Refresh channels and roles to show the imported items
        await fetchChannels(currentServer.id);
        await fetchRoles(currentServer.id);
        // Close modal after a short delay to show success message
        setTimeout(() => {
          handleClose();
        }, 2000);
      } else {
        toast.error(result.error || "Failed to import template");
      }
    } catch (error: any) {
      console.error("Import error:", error);
      setImportResult({ success: false, error: error.message || "Failed to import template" });
      toast.error("Failed to import template");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md max-w-[calc(100vw-2rem)] bg-background/95 backdrop-blur-xl border-border/50 rounded-2xl p-0">
        <div className="p-4 sm:p-6">
          <DialogHeader className="pb-4">
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Download className="w-6 h-6 text-primary" />
              </div>
              <div className="text-center">
                <DialogTitle className="text-xl font-medium">Import Discord Template</DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground mt-1">
                  Import categories, channels, and roles from a Discord server template
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {importResult?.success ? (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-3 p-4 bg-[hsl(var(--kloak-success))]/10 border border-[hsl(var(--kloak-success))]/20 rounded-xl">
                <CheckCircle2 className="w-5 h-5 text-[hsl(var(--kloak-success))] flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-medium text-[hsl(var(--kloak-success))]">Import Successful!</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {importResult.imported?.categories || 0} categories, {importResult.imported?.channels || 0} channels, and {importResult.imported?.roles || 0} roles imported.
                  </p>
                </div>
              </div>
              <Button onClick={handleClose} className="w-full rounded-xl">
                Close
              </Button>
            </div>
          ) : (
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              {/* Template URL Input */}
              <div className="space-y-2">
                <Label htmlFor="templateUrl" className="text-xs font-medium uppercase text-muted-foreground tracking-wide">
                  Discord Template URL
                </Label>
                <Input
                  id="templateUrl"
                  placeholder="https://discord.new/..."
                  {...form.register("templateUrl")}
                  className={`rounded-xl ${form.formState.errors.templateUrl ? "border-destructive focus-visible:ring-destructive" : ""}`}
                  autoFocus
                  disabled={isLoading}
                />
                {form.formState.errors.templateUrl && (
                  <p className="text-xs text-destructive">{form.formState.errors.templateUrl.message}</p>
                )}
              </div>

              {/* Info Box */}
              <div className="bg-secondary/30 backdrop-blur-sm rounded-xl p-3 border border-border/30">
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium">How to get a template:</span>
                </p>
                <ol className="text-xs text-muted-foreground mt-1 list-decimal list-inside space-y-1">
                  <li>Open your Discord server settings</li>
                  <li>Go to Server Template</li>
                  <li>Create a template and copy the link</li>
                  <li>Paste it here</li>
                </ol>
              </div>

              {/* Error Display */}
              {importResult && !importResult.success && (
                <div className="flex items-start gap-3 p-4 bg-destructive/10 border border-destructive/20 rounded-xl">
                  <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-destructive">Import Failed</p>
                    <p className="text-sm text-muted-foreground mt-1">{importResult.error}</p>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 pt-2 border-t border-border/30">
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
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 sm:flex-none rounded-xl bg-primary hover:bg-primary/90"
                >
                  {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Import Template
                </Button>
              </div>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
