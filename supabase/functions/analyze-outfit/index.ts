// Keep this pinned URL import until the deployed function's dependencies are migrated.
// deno-lint-ignore no-import-prefix
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { base64Image } = await request.json();

    if (!base64Image) {
      return new Response(
        JSON.stringify({ error: "base64Image is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");

    if (!openaiApiKey) {
      throw new Error("OPENAI_API_KEY not configured");
    }

    const analysisRequest = {
      model: "gpt-5.1",
      reasoning: {
        effort: "none", // No reasoning for maximum speed
      },
      input: [
        {
          type: "message",
          role: "user",
          content: [
            {
              type: "input_image",
              image_url: `data:image/jpeg;base64,${base64Image}`,
            },
            {
              type: "input_text",
              text:
                `You are a fashion stylist AI that ONLY analyzes outfits worn by people.

STRICT VALIDATION RULES - ALL MUST BE TRUE:
- Photo MUST show a FULL BODY person (head to toe visible)
- Photo MUST include the person's FACE
- REJECT if face is not visible or cut off
- Photo MUST include the person's SHOES/FEET
- REJECT if shoes/feet are not visible or cut off
- REJECT if only showing upper body, lower body, or partial view
- REJECT photos of: rooms, furniture, objects, plants, tools, landscapes, animals, food, etc.
- If ANY requirement is missing, set "isValidPhoto": false and return minimal data

Analyze and rate this outfit (use fashion best practices).

Return a JSON response:
{
  "outfitName": "fashion style category (max 3 words)" OR "Invalid Photo" if invalid photo,
  "shortDescription": "fashion review description (must be 10-15 words exactly)" OR "Photo does not show a person wearing an outfit (full-body)!!!" if invalid photo,
  "rating": number from 1-10 (be generous) OR 0 if invalid photo,
  "isValidPhoto": true ONLY if ALL requirements met, false otherwise
}`,
            },
          ],
        },
      ],
    };

    const openAiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify(analysisRequest),
    });

    if (!openAiResponse.ok) {
      await openAiResponse.text();
      throw new Error(`OpenAI API error: ${openAiResponse.status}`);
    }

    const responseData = await openAiResponse.json();

    if (responseData.usage) {
      const { input_tokens = 0, output_tokens = 0 } = responseData.usage;
      const cost = (input_tokens / 1e6 * 1.25) + (output_tokens / 1e6 * 10);
      void cost.toFixed(6);
    }

    let textContent = "";

    if (responseData.output && Array.isArray(responseData.output)) {
      for (const outputItem of responseData.output) {
        if (outputItem.type === "message") {
          if (outputItem.content && Array.isArray(outputItem.content)) {
            for (const contentItem of outputItem.content) {
              if (contentItem.type === "output_text" && contentItem.text) {
                textContent = contentItem.text;
                break;
              }
            }
          }
          break;
        }
      }
    }

    if (!textContent) {
      throw new Error("No text content found in response");
    }

    const jsonMatch = textContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response content");
    }

    const analysisResult = JSON.parse(jsonMatch[0]);

    if (
      !analysisResult.outfitName || !analysisResult.shortDescription ||
      typeof analysisResult.rating !== "number" ||
      typeof analysisResult.isValidPhoto !== "boolean"
    ) {
      throw new Error("Invalid response format from GPT-5");
    }

    return new Response(
      JSON.stringify(analysisResult),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error.message || "Failed to analyze outfit",
        details: error.toString(),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
