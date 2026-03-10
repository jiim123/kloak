import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createServiceClient, enforceRateLimit, getAuthContext } from "../_shared/edgeSecurity.ts";

// Discord template API endpoint: https://discord.com/api/v9/guilds/templates/{code}

interface DiscordTemplateResponse {
  code: string;
  name: string;
  description: string | null;
  usage_count: number;
  creator_id: string;
  creator: {
    id: string;
    username: string;
    avatar: string | null;
    discriminator: string;
    public_flags: number;
  };
  created_at: string;
  updated_at: string;
  source_guild_id: string;
  serialized_source_guild: {
    name: string;
    description: string | null;
    region: string | null;
    verification_level: number;
    default_message_notifications: number;
    explicit_content_filter: number;
    preferred_locale: string;
    afk_timeout: number;
    roles: Array<{
      id: string;
      name: string;
      color: number;
      hoist: boolean;
      mentionable: boolean;
      permissions: string;
      position: number;
      icon?: string | null;
      unicode_emoji?: string | null;
    }>;
    channels: Array<{
      id: string;
      name: string;
      type: number;
      topic?: string | null;
      bitrate?: number;
      user_limit?: number;
      rate_limit_per_user?: number;
      position: number;
      permission_overwrites: Array<{
        id: string;
        type: number;
        allow: string;
        deny: string;
      }>;
      nsfw?: boolean;
      parent_id?: string | null;
    }>;
    afk_channel_id: string | null;
    system_channel_id: string | null;
    system_channel_flags: number;
    widget_enabled: boolean;
    widget_channel_id: string | null;
  };
  is_dirty: boolean | null;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { 
      status: 200,
      headers: corsHeaders 
    });
  }
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabase = createServiceClient();
    const auth = await getAuthContext(supabase, req);
    if (!auth.requestUserId) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const rateOk = await enforceRateLimit(supabase, auth.scopeBase, "edge_fetch_discord_template", 20, 60);
    if (!rateOk) {
      return new Response(
        JSON.stringify({ error: "Rate limited: too many template lookups" }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const templateUrl = typeof body?.templateUrl === "string" ? body.templateUrl : null;

    if (!templateUrl || templateUrl.length > 512) {
      return new Response(
        JSON.stringify({ error: "Template URL is required (max 512 characters)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract template code from Discord template URL
    // Formats: discord.new/CODE, discord.com/template/CODE, discord.gg/CODE
    let templateCode = "";
    try {
      const url = new URL(templateUrl);
      if (url.hostname === "discord.new") {
        templateCode = url.pathname.replace("/", "");
      } else if (url.hostname.includes("discord.com") || url.hostname.includes("discord.gg")) {
        const match = url.pathname.match(/\/template\/([^\/]+)/) || url.pathname.match(/\/([^\/]+)/);
        templateCode = match ? match[1] : "";
      } else {
        // Assume it's just the code
        templateCode = templateUrl;
      }
    } catch {
      // If URL parsing fails, assume it's just the code
      templateCode = templateUrl;
    }

    if (!templateCode) {
      return new Response(
        JSON.stringify({ error: "Invalid template URL or code" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch template from Discord API
    // Discord's template endpoint: https://discord.com/api/v9/guilds/templates/{code}
    const discordResponse = await fetch(`https://discord.com/api/v9/guilds/templates/${templateCode}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!discordResponse.ok) {
      if (discordResponse.status === 404) {
        return new Response(
          JSON.stringify({ error: "Template not found. Make sure the template link is valid and public." }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`Discord API returned ${discordResponse.status}`);
    }

    const templateData: DiscordTemplateResponse = await discordResponse.json();

    // Transform Discord template data to our format
    const transformed = {
      name: templateData.name,
      description: templateData.description,
      categories: [] as Array<{ name: string; position: number; channels: any[] }>,
      channels: [] as any[],
      roles: [] as any[],
    };

    // Process roles
    if (templateData.serialized_source_guild.roles) {
      transformed.roles = templateData.serialized_source_guild.roles
        .filter((role) => role.name !== "@everyone") // Filter out @everyone role
        .map((role) => ({
          name: role.name,
          color: role.color ? `#${role.color.toString(16).padStart(6, "0")}` : "#5865F2",
          position: role.position,
          icon: role.icon || role.unicode_emoji || null,
        }))
        .sort((a, b) => b.position - a.position); // Sort by position descending
    }

    // Process channels and categories
    const channels = templateData.serialized_source_guild.channels || [];
    const categoryMap = new Map<string, { name: string; position: number; channels: any[] }>();

    // First pass: identify categories and uncategorized channels
    channels.forEach((channel) => {
      // Discord channel types: 4 = category, 0 = text, 2 = voice, 5 = announcement, 15 = forum
      if (channel.type === 4) {
        // Category
        categoryMap.set(channel.id, {
          name: channel.name,
          position: channel.position,
          channels: [],
        });
      }
    });

    // Second pass: assign channels to categories
    channels.forEach((channel) => {
      if (channel.type === 4) return; // Skip categories themselves

      const channelData = {
        name: channel.name,
        type: channel.type === 0 ? "text" : channel.type === 2 ? "voice" : channel.type === 5 ? "announcement" : channel.type === 15 ? "forum" : "text",
        topic: channel.topic || null,
        position: channel.position,
        is_nsfw: channel.nsfw || false,
        slowmode_seconds: channel.rate_limit_per_user || 0,
      };

      if (channel.parent_id && categoryMap.has(channel.parent_id)) {
        categoryMap.get(channel.parent_id)!.channels.push(channelData);
      } else {
        // Uncategorized channel
        transformed.channels.push(channelData);
      }
    });

    // Convert category map to array and sort
    transformed.categories = Array.from(categoryMap.values())
      .map((cat) => ({
        ...cat,
        channels: cat.channels.sort((a, b) => a.position - b.position),
      }))
      .sort((a, b) => a.position - b.position);

    // Sort uncategorized channels
    transformed.channels.sort((a, b) => a.position - b.position);

    return new Response(
      JSON.stringify(transformed),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error fetching Discord template:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch template" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
