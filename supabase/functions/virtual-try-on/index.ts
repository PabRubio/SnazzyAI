// Keep this pinned URL import until the deployed function's dependencies are migrated.
// deno-lint-ignore no-import-prefix
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

async function downloadImageAsBase64(imageUrl: string): Promise<string> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(arrayBuffer)
        .reduce(
          (binaryString, byte) => binaryString + String.fromCharCode(byte),
          "",
        ),
    );

    return base64;
  } catch {
    throw new Error("Failed to download clothing image");
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { userPhotoBase64, clothingImageUrl } = await req.json();

    if (!userPhotoBase64 || !clothingImageUrl) {
      return new Response(
        JSON.stringify({
          error: "userPhotoBase64 and clothingImageUrl are required",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const googleApiKey = Deno.env.get("GOOGLE_API_KEY");
    if (!googleApiKey) {
      throw new Error("GOOGLE_API_KEY not configured");
    }

    const clothingImageBase64 = await downloadImageAsBase64(clothingImageUrl);

    const prompt =
      `You are an expert virtual try-on AI. Take the person from the first image and seamlessly place the clothing item from the second image onto them. Make it look realistic and natural, as if they are actually wearing the clothing item. Ensure proper fit, lighting, and shadows. The result should look like a professional photo of the person wearing the new clothing.`;

    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: prompt,
            },
            {
              inline_data: {
                mime_type: "image/jpeg",
                data: userPhotoBase64,
              },
            },
            {
              inline_data: {
                mime_type: "image/jpeg",
                data: clothingImageBase64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        responseModalities: ["IMAGE"],
        temperature: 0.4,
        topP: 0.95,
        topK: 40,
      },
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${googleApiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      },
    );

    if (!response.ok) {
      await response.text();
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const geminiResponse = await response.json();

    const { promptTokenCount = 0, candidatesTokenCount = 0 } =
      geminiResponse.usageMetadata || {};
    const cost = 0.0022 + 0.039 + (promptTokenCount / 1e6 * 0.30) +
      (candidatesTokenCount / 1e6 * 2.50);
    void cost.toFixed(6);

    if (
      geminiResponse && geminiResponse.candidates &&
      geminiResponse.candidates.length > 0
    ) {
      const candidate = geminiResponse.candidates[0];

      if (candidate.content && candidate.content.parts) {
        for (const part of candidate.content.parts) {
          // Check for both camelCase and snake_case formats
          const imageData = part.inlineData || part.inline_data;

          if (imageData && imageData.data) {
            const mimeType = imageData.mimeType || imageData.mime_type ||
              "image/jpeg";

            return new Response(
              JSON.stringify({
                success: true,
                base64: imageData.data,
                dataUri: `data:${mimeType};base64,${imageData.data}`,
              }),
              {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              },
            );
          }
        }
      }
    }

    throw new Error("No image generated in response");
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error.message || "Virtual try-on failed",
        details: error.toString(),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
