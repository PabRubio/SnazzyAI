// Keep this pinned URL import until the deployed function's dependencies are migrated.
// deno-lint-ignore no-import-prefix
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

function currencyToCountryCode(currency?: string): string {
  const countryCodesByCurrency: Record<string, string> = {
    "USD": "us",
    "EUR": "es",
    "GBP": "uk",
    "JPY": "jp",
    "CAD": "ca",
    "AUD": "au",
  };
  return countryCodesByCurrency[currency || "USD"] || "us";
}

function mapLanguageCode(language?: string): string {
  const languageCodesByLanguage: Record<string, string> = {
    "English": "en",
    "Spanish": "es",
  };
  return languageCodesByLanguage[language || "English"] || "en";
}

function categorizeProduct(title: string, snippet?: string): string {
  const productText = `${title} ${snippet || ""}`.toLowerCase();

  if (
    productText.match(
      /\b(shirt|blouse|sweater|hoodie|jacket|coat|pullover|sweatshirt)\b/,
    )
  ) {
    return "shirts";
  }

  if (
    productText.match(
      /\b(pant|jean|trouser|short|skirt|legging|chino|cargo|jogger)\b/,
    )
  ) {
    return "pants";
  }

  if (
    productText.match(
      /\b(shoe|sneaker|boot|sandal|heel|loafer|slipper|footwear)\b/,
    )
  ) {
    return "shoes";
  }

  return "other";
}

function extractBrand(title: string, source?: string): string {
  if (source && source.length < 30 && !source.includes(".")) {
    return source;
  }

  const brandMatch = title.match(
    /^([A-Z][a-zA-Z0-9&\s]+?)(?:\s-\s|\s\||\s\(|$)/,
  );
  if (brandMatch) {
    return brandMatch[1].trim();
  }

  if (source) {
    return source;
  }

  return "Unknown Brand";
}

function getCurrencySymbol(currency?: string): string {
  const currencySymbols: Record<string, string> = {
    "USD": "$",
    "EUR": "€",
    "GBP": "£",
    "JPY": "¥",
    "CAD": "$",
    "AUD": "$",
  };
  return currencySymbols[currency || "USD"] || "$";
}

function formatPrice(
  priceString?: string,
  extractedPrice?: number,
  currency?: string,
): string {
  if (extractedPrice !== undefined && extractedPrice !== null) {
    const symbol = getCurrencySymbol(currency);
    return `${symbol}${extractedPrice.toFixed(2)}`;
  }
  if (priceString) {
    return priceString;
  }
  return "Price not available";
}

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { userProfile, base64Image, outfitName } = await request.json();

    if (!base64Image) {
      return new Response(
        JSON.stringify({ error: "base64Image is required", products: [] }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const claudeApiKey = Deno.env.get("CLAUDE_API_KEY");
    const serpApiKey = Deno.env.get("SERPAPI_API_KEY");

    if (!claudeApiKey) {
      throw new Error("CLAUDE_API_KEY not configured");
    }
    if (!serpApiKey) {
      throw new Error("SERPAPI_API_KEY not configured");
    }

    let personalizationContext = "";
    if (userProfile) {
      const profilePreferences = [];

      if (userProfile.location) {
        profilePreferences.push(`Location: ${userProfile.location}`);
      }

      if (
        userProfile.favorite_styles && userProfile.favorite_styles.length > 0
      ) {
        profilePreferences.push(
          `Favorite styles: ${userProfile.favorite_styles.join(", ")}`,
        );
      }

      if (
        userProfile.favorite_brands && userProfile.favorite_brands.length > 0
      ) {
        profilePreferences.push(
          `Favorite brands: ${userProfile.favorite_brands.join(", ")}`,
        );
      }

      if (profilePreferences.length > 0) {
        personalizationContext = `\n\nUser preferences:\n${
          profilePreferences.join("\n")
        }\n\nUse these preferences to personalize the search terms.`;
      }
    }

    const claudeRequest = {
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 200,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/jpeg",
                data: base64Image,
              },
            },
            {
              type: "text",
              text: `Look at this outfit${
                outfitName ? ` "${outfitName}"` : ""
              }. Generate five concise product search terms for complementary fashion items that would go well with this outfit.${personalizationContext}

IMPORTANT: Analyze the image to auto-detect the person's age, gender, height, weight, and clothing sizes. Keep their hair color, skin tone, and body shape in mind when generating recommendations. Use state of the art fashion principles to ensure the search terms will lead to items that complement their unique characteristics and the outfit shown.

Return ONLY the search terms as an array (search_term = brand + gender + color + item). Example: ["Ralph Lauren men's navy quarter zip", "...", "...", "...", "..."].`,
            },
          ],
        },
      ],
    };

    const claudeResponse = await fetch(
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: {
          "x-api-key": claudeApiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(claudeRequest),
      },
    );

    if (!claudeResponse.ok) {
      const errorDetails = await claudeResponse.text();
      return new Response(
        JSON.stringify({
          error: `Claude API error: ${claudeResponse.status}`,
          details: errorDetails,
          products: [],
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const claudeData = await claudeResponse.json();

    if (claudeData.usage) {
      const { input_tokens = 0, output_tokens = 0 } = claudeData.usage;
      const cost = (input_tokens / 1e6 * 3) + (output_tokens / 1e6 * 15);
      void cost.toFixed(6);
    }

    // Claude's external response does not provide a stable local type.
    // deno-lint-ignore no-explicit-any
    const claudeTextBlock = claudeData.content?.find((block: any) =>
      block.type === "text"
    );
    const searchTerms: string[] = JSON.parse(
      claudeTextBlock?.text?.match(/\[[\s\S]*?\]/)?.[0] || "[]",
    );

    if (searchTerms.length === 0) {
      return new Response(
        JSON.stringify({
          error: "Failed to generate search terms",
          products: [],
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // SerpAPI products are normalized before they leave this function.
    // deno-lint-ignore no-explicit-any
    const allProducts: any[] = [];

    for (const searchTerm of searchTerms) {
      const searchParameters: Record<string, string> = {
        engine: "google_shopping",
        q: searchTerm,
        api_key: serpApiKey,
        num: "10",
        gl: userProfile?.currency
          ? currencyToCountryCode(userProfile.currency)
          : "us",
        hl: userProfile?.language
          ? mapLanguageCode(userProfile.language)
          : "en",
      };

      if (
        userProfile?.price_min !== null && userProfile?.price_min !== undefined
      ) {
        searchParameters.min_price = userProfile.price_min.toString();
      }
      if (
        userProfile?.price_max !== null && userProfile?.price_max !== undefined
      ) {
        searchParameters.max_price = userProfile.price_max.toString();
      }

      const searchParams = new URLSearchParams(searchParameters);

      const serpApiUrl =
        `https://serpapi.com/search?${searchParams.toString()}`;

      const serpApiResponse = await fetch(serpApiUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!serpApiResponse.ok) {
        continue;
      }

      const serpData = await serpApiResponse.json();

      const shoppingResults = serpData.shopping_results || [];

      if (shoppingResults.length === 0) {
        continue;
      }

      // SerpAPI's shopping-result shape varies by merchant.
      const products = shoppingResults.slice(0, 3).map(
        // deno-lint-ignore no-explicit-any
        (shoppingResult: any) => ({
          name: shoppingResult.title || "Unknown Product",
          brand: extractBrand(
            shoppingResult.title || "",
            shoppingResult.source,
          ),
          description: shoppingResult.snippet || shoppingResult.title ||
            "No description available",
          price: formatPrice(
            shoppingResult.price,
            shoppingResult.extracted_price,
            userProfile?.currency,
          ),
          imageUrl: shoppingResult.thumbnail ||
            "https://via.placeholder.com/150",
          purchaseUrl: shoppingResult.link ||
            shoppingResult.product_link ||
            "#",
          category: categorizeProduct(
            shoppingResult.title || "",
            shoppingResult.snippet,
          ),
        }),
      );

      allProducts.push(...products);
    }

    allProducts.sort(() => Math.random() - 0.5);

    return new Response(
      JSON.stringify({ products: allProducts, searchTerms }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error.message || "Failed to search products",
        products: [],
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
