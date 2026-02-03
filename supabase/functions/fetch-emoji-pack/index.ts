import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

interface EmojiGGEmoji {
  title: string;
  slug: string;
  image: string;
}

interface EmojiGGPack {
  name: string;
  slug: string;
  emojis: EmojiGGEmoji[];
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { packUrl } = await req.json();

    if (!packUrl || typeof packUrl !== "string") {
      return new Response(
        JSON.stringify({ error: "Pack URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract pack slug from URL
    // Formats: 
    // - https://emoji.gg/pack/1234-pack-name
    // - https://emoji.gg/emojis/pack/1234-pack-name
    const urlMatch = packUrl.match(/emoji\.gg(?:\/emojis)?\/pack\/(\d+(?:-[\w-]+)?)/i);
    if (!urlMatch) {
      return new Response(
        JSON.stringify({ error: "Invalid emoji.gg pack URL. Please provide a valid pack URL like https://emoji.gg/pack/1234-pack-name" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const packSlug = urlMatch[1];
    console.log("Fetching pack:", packSlug);

    // Fetch all packs from emoji.gg API
    const packsResponse = await fetch("https://emoji.gg/api/packs", {
      headers: {
        "Accept": "application/json",
        "User-Agent": "Kloak/1.0",
      },
    });

    if (!packsResponse.ok) {
      throw new Error(`Failed to fetch packs from emoji.gg: ${packsResponse.status}`);
    }

    const allPacks: EmojiGGPack[] = await packsResponse.json();

    // Find the matching pack by slug
    const packIdMatch = packSlug.match(/^(\d+)/);
    const packId = packIdMatch ? packIdMatch[1] : packSlug;
    
    const pack = allPacks.find((p) => 
      p.slug === packSlug || 
      p.slug.startsWith(packId + "-") ||
      p.slug === packId
    );

    if (!pack) {
      return new Response(
        JSON.stringify({ error: "Pack not found. Please check the URL and try again." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Map emojis with proper image URLs
    const emojis = pack.emojis.map((emoji) => ({
      name: emoji.slug.replace(/-/g, "_").toLowerCase().slice(0, 32),
      imageUrl: emoji.image,
      originalName: emoji.title,
    }));

    return new Response(
      JSON.stringify({
        success: true,
        pack: {
          name: pack.name,
          slug: pack.slug,
          emojiCount: emojis.length,
          emojis,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error fetching emoji pack:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to fetch emoji pack";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
