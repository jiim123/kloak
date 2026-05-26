import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
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
      <DialogContent className="max-h-[90vh] max-w-[calc(100vw-1.5rem)] gap-0 overflow-hidden rounded-[4px] border border-border bg-card p-0 text-foreground shadow-2xl sm:max-w-[448px]">
        <div className="flex max-h-[82vh] flex-col overflow-hidden">
          <div className="border-b border-border bg-muted px-5 py-3">
            <div className="text-base font-medium leading-none tracking-tight">Import Discord Template</div>
          </div>
          {importResult?.success ? (
            <>
            <div className="space-y-4 overflow-y-auto px-6 py-4">
              <div className="flex items-start gap-3 rounded-[3px] border border-emerald-500/25 bg-emerald-500/10 p-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-400" />
                <div className="flex-1">
                  <p className="font-medium text-emerald-300">Import successful</p>
                  <p className="mt-1 text-sm leading-5 text-muted-foreground">
                    {importResult.imported?.categories || 0} categories, {importResult.imported?.channels || 0} channels, and {importResult.imported?.roles || 0} roles imported.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end border-t border-border bg-card px-5 py-3">
              <Button
                onClick={handleClose}
                className="h-9 rounded-[3px] bg-primary px-5 font-medium text-primary-foreground hover:bg-white"
              >
                Close
              </Button>
            </div>
            </>
          ) : (
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="space-y-5 overflow-y-auto px-6 py-4">
                <p className="text-sm leading-5 text-muted-foreground">
                  Import categories, channels, and roles from a Discord server template.
                </p>
              {/* Template URL Input */}
              <div className="space-y-2">
                <Label htmlFor="templateUrl" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Discord Template URL
                </Label>
                <Input
                  id="templateUrl"
                  placeholder="https://discord.new/..."
                  {...form.register("templateUrl")}
                  className={`mt-2 h-9 rounded-none border-0 border-b border-white/80 bg-transparent px-0 text-sm text-foreground shadow-none outline-none placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0 ${
                    form.formState.errors.templateUrl ? "border-destructive" : ""
                  }`}
                  autoFocus
                  disabled={isLoading}
                />
                {form.formState.errors.templateUrl && (
                  <p className="text-xs text-[#ff8a8a]">{form.formState.errors.templateUrl.message}</p>
                )}
              </div>

              {/* Info Box */}
              <div className="rounded-[3px] border border-border bg-muted p-3">
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">How to get a template:</span>
                </p>
                <ol className="mt-2 list-inside list-decimal space-y-1 text-xs leading-5 text-muted-foreground">
                  <li>Open your Discord server settings</li>
                  <li>Go to Server Template</li>
                  <li>Create a template and copy the link</li>
                  <li>Paste it here</li>
                </ol>
              </div>

              {/* Error Display */}
              {importResult && !importResult.success && (
                <div className="flex items-start gap-3 rounded-[3px] border border-destructive/30 bg-destructive/15 p-3">
                  <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-destructive" />
                  <div className="flex-1">
                    <p className="font-medium text-destructive-foreground">Import failed</p>
                    <p className="mt-1 text-sm leading-5 text-muted-foreground">{importResult.error}</p>
                  </div>
                </div>
              )}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 border-t border-border bg-card px-5 py-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleClose}
                  disabled={isLoading}
                  className="h-9 rounded-[3px] px-4 text-muted-foreground hover:bg-transparent hover:text-white"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="h-9 rounded-[3px] bg-primary px-5 font-medium text-primary-foreground hover:bg-white"
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
