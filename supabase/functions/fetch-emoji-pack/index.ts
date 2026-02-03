const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface EmojiGGEmoji {
  id: number;
  title: string;
  slug: string;
  image: string; // This is just the filename like "99951-smallflowers.gif"
}

interface EmojiGGPack {
  id: number;
  name: string;
  slug: string; // e.g., "140792-blue-white-text-reactions"
  emojis: EmojiGGEmoji[];
}

Deno.serve(async (req) => {
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
    // - https://emoji.gg/pack/140792-blue-white-text-reactions
    // - https://emoji.gg/emojis/pack/140792-blue-white-text-reactions
    const urlMatch = packUrl.match(/emoji\.gg(?:\/emojis)?\/pack\/([\w-]+)/i);
    if (!urlMatch) {
      return new Response(
        JSON.stringify({ error: "Invalid emoji.gg pack URL. Please provide a valid pack URL like https://emoji.gg/pack/140792-pack-name" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const packSlug = urlMatch[1];
    console.log("Looking for pack with slug:", packSlug);

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
    console.log(`Fetched ${allPacks.length} packs from emoji.gg`);

    // Find the matching pack by slug
    const pack = allPacks.find((p) => p.slug === packSlug);

    if (!pack) {
      console.log("Available pack slugs (first 10):", allPacks.slice(0, 10).map(p => p.slug));
      return new Response(
        JSON.stringify({ error: "Pack not found. Please check the URL and try again." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found pack: ${pack.name} with ${pack.emojis.length} emojis`);

    // Map emojis with proper CDN URLs
    // Image URL format: https://cdn3.emoji.gg/emojis/{image}
    const emojis = pack.emojis.map((emoji) => ({
      name: emoji.slug.replace(/-/g, "_").toLowerCase().slice(0, 32),
      imageUrl: `https://cdn3.emoji.gg/emojis/${emoji.image}`,
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