// Keep these pinned URL imports until the deployed function's dependencies are migrated.
// deno-lint-ignore no-import-prefix
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// deno-lint-ignore no-import-prefix
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { imagePath, prompt } = await req.json();

    if (!imagePath) {
      return new Response(
        JSON.stringify({ error: "imagePath is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const xaiApiKey = Deno.env.get("XAIGROK_API_KEY");
    if (!xaiApiKey) {
      throw new Error("XAIGROK_API_KEY not configured");
    }

    // Generate a signed URL for the private storage image
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: signedUrlData, error: signedUrlError } = await supabaseClient
      .storage
      .from("try-on-results")
      .createSignedUrl(imagePath, 600); // 10 minutes

    if (signedUrlError || !signedUrlData?.signedUrl) {
      throw new Error(
        `Failed to generate signed URL: ${
          signedUrlError?.message || "Unknown error"
        }`,
      );
    }

    const imageUrl = signedUrlData.signedUrl;

    const videoPrompt = prompt ||
      "The person slowly turns 360 degrees in place, showing off the outfit from all angles. Smooth rotation, natural movement.";

    const startResponse = await fetch(
      "https://api.x.ai/v1/videos/generations",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${xaiApiKey}`,
        },
        body: JSON.stringify({
          model: "grok-imagine-video",
          image: { url: imageUrl },
          aspect_ratio: "9:16",
          prompt: videoPrompt,
          resolution: "720p",
          duration: 7,
        }),
      },
    );

    if (!startResponse.ok) {
      const errorResponseText = await startResponse.text();
      throw new Error(
        `xAI API error: ${startResponse.status} - ${errorResponseText}`,
      );
    }

    const startData = await startResponse.json();
    const requestId = startData.request_id || startData.id;

    if (!requestId) {
      throw new Error("No request ID returned from API");
    }

    // Poll for completion with a three-minute timeout.
    const maxAttempts = 90; // 3 minutes max (90 * 2 seconds)
    const pollInterval = 2000; // 2 seconds

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, pollInterval));

      const statusResponse = await fetch(
        `https://api.x.ai/v1/videos/${requestId}`,
        {
          headers: { "Authorization": `Bearer ${xaiApiKey}` },
        },
      );

      if (!statusResponse.ok) {
        continue;
      }

      const statusData = await statusResponse.json();

      // API returns { url, duration } when complete (no status field)
      if (statusData.video?.url) {
        return new Response(
          JSON.stringify({
            success: true,
            videoUrl: statusData.video.url,
            duration: statusData.video.duration,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (statusData.error) {
        throw new Error(
          statusData.error.message || statusData.error ||
            "Video generation failed",
        );
      }
    }

    throw new Error("Video generation timed out after 3 minutes");
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error.message || "Video generation failed",
        details: error.toString(),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
