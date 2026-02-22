import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cleanup-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CLEANUP_ATTACHMENTS_TOKEN = Deno.env.get("CLEANUP_ATTACHMENTS_TOKEN") || "";
const BUCKET_NAME = "attachments";
const RETENTION_DAYS = 14;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    if (!CLEANUP_ATTACHMENTS_TOKEN) {
      console.error("CLEANUP_ATTACHMENTS_TOKEN is not configured");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const providedToken = req.headers.get("x-cleanup-token") ?? "";
    if (providedToken !== CLEANUP_ATTACHMENTS_TOKEN) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Starting cleanup of attachments older than 14 days...");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // List all files in the attachments bucket
    const { data: files, error: listError } = await supabase.storage
      .from(BUCKET_NAME)
      .list("", {
        limit: 1000,
        sortBy: { column: "created_at", order: "asc" },
      });

    if (listError) {
      console.error("Error listing files:", listError);
      throw listError;
    }

    if (!files || files.length === 0) {
      console.log("No files found in attachments bucket");
      return new Response(
        JSON.stringify({ message: "No files to clean up", deleted: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);
    console.log(`Cutoff date for deletion: ${cutoffDate.toISOString()}`);

    // Filter files older than retention period
    const filesToDelete = files.filter((file) => {
      if (!file.created_at) return false;
      const fileDate = new Date(file.created_at);
      return fileDate < cutoffDate;
    });

    console.log(`Found ${filesToDelete.length} files to delete out of ${files.length} total`);

    if (filesToDelete.length === 0) {
      return new Response(
        JSON.stringify({ message: "No expired files found", deleted: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Delete the old files
    const filePaths = filesToDelete.map((file) => file.name);
    const { error: deleteError } = await supabase.storage
      .from(BUCKET_NAME)
      .remove(filePaths);

    if (deleteError) {
      console.error("Error deleting files:", deleteError);
      throw deleteError;
    }

    console.log(`Successfully deleted ${filePaths.length} expired files`);
    console.log("Deleted files:", filePaths);

    return new Response(
      JSON.stringify({
        message: `Successfully deleted ${filePaths.length} expired files`,
        deleted: filePaths.length,
        files: filePaths,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Cleanup error:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
