// Keep this pinned URL import until the deployed function's dependencies are migrated.
// deno-lint-ignore no-import-prefix
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

type UserProfile = {
  currency?: string;
  language?: string;
  location?: string;
  price_min?: number | null;
  price_max?: number | null;
  favorite_brands?: string[];
  favorite_styles?: string[];
};

const countryCodes: Record<string, string> = {
  USD: "us",
  EUR: "es",
  GBP: "uk",
  JPY: "jp",
  CAD: "ca",
  AUD: "au",
};
const languageCodes: Record<string, string> = { English: "en", Spanish: "es" };
const currencySymbols: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  CAD: "$",
  AUD: "$",
};

function categorizeProduct(title: string, snippet?: string): string {
  const productText = `${title} ${snippet || ""}`.toLowerCase();
  if (
    /\b(shirt|blouse|sweater|hoodie|jacket|coat|pullover|sweatshirt)\b/.test(
      productText,
    )
  ) {
    return "shirts";
  }
  if (
    /\b(pant|jean|trouser|short|skirt|legging|chino|cargo|jogger)\b/.test(
      productText,
    )
  ) {
    return "pants";
  }
  if (
    /\b(shoe|sneaker|boot|sandal|heel|loafer|slipper|footwear)\b/.test(
      productText,
    )
  ) {
    return "shoes";
  }
  return "other";
}

function extractBrand(title: string, source?: string): string {
  if (source && source.length < 30 && !source.includes(".")) return source;
  const brandFromTitle = title.match(
    /^([A-Z][a-zA-Z0-9&\s]+?)(?:\s-\s|\s\||\s\(|$)/,
  )?.[1]?.trim();
  return brandFromTitle || source || "Unknown Brand";
}

function formatPrice(
  shoppingResult: Record<string, unknown>,
  currency: string,
): string {
  if (typeof shoppingResult.extracted_price === "number") {
    const currencySymbol = currencySymbols[currency] || "$";
    return `${currencySymbol}${shoppingResult.extracted_price.toFixed(2)}`;
  }
  return typeof shoppingResult.price === "string"
    ? shoppingResult.price
    : "Price not available";
}

function preferenceScore(
  shoppingResult: Record<string, unknown>,
  profile?: UserProfile,
): number {
  const preferences = [
    profile?.location,
    ...(profile?.favorite_brands || []),
    ...(profile?.favorite_styles || []),
  ].filter((value): value is string =>
    typeof value === "string" && value.trim().length > 0
  );
  const productText = `${shoppingResult.title || ""} ${
    shoppingResult.source || ""
  } ${shoppingResult.snippet || ""}`.toLowerCase();
  return preferences.reduce(
    (score, preference) =>
      score + (productText.includes(preference.trim().toLowerCase()) ? 1 : 0),
    0,
  );
}

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { prompt: rawPrompt, userProfile } = await request.json() as {
      prompt?: unknown;
      userProfile?: UserProfile;
    };
    const prompt = typeof rawPrompt === "string" ? rawPrompt.trim() : "";

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: "prompt is required", products: [] }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const serpApiKey = Deno.env.get("SERPAPI_API_KEY");
    if (!serpApiKey) throw new Error("SERPAPI_API_KEY not configured");

    const currency = userProfile?.currency || "USD";
    const searchParameters = new URLSearchParams({
      engine: "google_shopping",
      q: prompt,
      api_key: serpApiKey,
      num: "10",
      gl: countryCodes[currency] || "us",
      hl: languageCodes[userProfile?.language || "English"] || "en",
    });

    if (userProfile?.price_min != null) {
      searchParameters.set("min_price", String(userProfile.price_min));
    }
    if (userProfile?.price_max != null) {
      searchParameters.set("max_price", String(userProfile.price_max));
    }

    const searchResponse = await fetch(
      `https://serpapi.com/search?${searchParameters}`,
    );
    const searchData = await searchResponse.json();
    if (
      !searchResponse.ok ||
      (searchData.error && searchData.search_metadata?.status !== "Success")
    ) {
      throw new Error(
        searchData.error || `SerpAPI error: ${searchResponse.status}`,
      );
    }

    const rankedResults = (Array.isArray(searchData.shopping_results)
      ? searchData.shopping_results
      : [])
      .map((
        shoppingResult: Record<string, unknown>,
        originalIndex: number,
      ) => ({
        shoppingResult,
        originalIndex,
        score: preferenceScore(shoppingResult, userProfile),
      }))
      .sort(
        (leftResult, rightResult) =>
          rightResult.score - leftResult.score ||
          leftResult.originalIndex - rightResult.originalIndex,
      );

    const seenPurchaseUrls = new Set<string>();
    const products = [];

    for (const { shoppingResult } of rankedResults) {
      const title = typeof shoppingResult.title === "string"
        ? shoppingResult.title
        : "Unknown Product";
      const purchaseUrl = typeof shoppingResult.link === "string"
        ? shoppingResult.link
        : typeof shoppingResult.product_link === "string"
        ? shoppingResult.product_link
        : "";
      if (
        !/^https?:\/\//i.test(purchaseUrl) ||
        seenPurchaseUrls.has(purchaseUrl)
      ) {
        continue;
      }

      seenPurchaseUrls.add(purchaseUrl);
      const description = typeof shoppingResult.snippet === "string"
        ? shoppingResult.snippet
        : title;
      products.push({
        name: title,
        brand: extractBrand(
          title,
          typeof shoppingResult.source === "string"
            ? shoppingResult.source
            : undefined,
        ),
        description,
        price: formatPrice(shoppingResult, currency),
        imageUrl: typeof shoppingResult.thumbnail === "string"
          ? shoppingResult.thumbnail
          : "https://via.placeholder.com/150",
        purchaseUrl,
        category: categorizeProduct(title, description),
      });
      if (products.length === 10) {
        break;
      }
    }

    return new Response(JSON.stringify({ products }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error
          ? error.message
          : "Failed to search products",
        products: [],
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
