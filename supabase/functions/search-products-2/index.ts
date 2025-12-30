// =====================================================
// SnazzyAI - Search Products V2 Edge Function
// Uses Google Shopping API via SerpAPI (FAST!)
// =====================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from "../_shared/cors.ts"

// Helper function to map currency to country code
function currencyToCountryCode(currency?: string): string {
  const currencyMap: { [key: string]: string } = {
    'USD': 'us',
    'EUR': 'es',
    'GBP': 'uk',
    'JPY': 'jp',
    'CAD': 'ca',
    'AUD': 'au'
  }
  return currencyMap[currency || 'USD'] || 'us'
}

// Helper function to map language to language code
function mapLanguageCode(language?: string): string {
  const languageMap: { [key: string]: string } = {
    'English': 'en',
    'Spanish': 'es'
  }
  return languageMap[language || 'English'] || 'en'
}

// Helper function to categorize products based on title/description
function categorizeProduct(title: string, snippet?: string): string {
  const text = `${title} ${snippet || ''}`.toLowerCase()

  // Shirts keywords
  if (text.match(/\b(shirt|blouse|sweater|hoodie|jacket|coat|pullover|sweatshirt)\b/)) {
    return 'shirts'
  }

  // Pants keywords
  if (text.match(/\b(pant|jean|trouser|short|skirt|legging|chino|cargo|jogger)\b/)) {
    return 'pants'
  }

  // Shoes keywords
  if (text.match(/\b(shoe|sneaker|boot|sandal|heel|loafer|slipper|footwear)\b/)) {
    return 'shoes'
  }

  // Default to other for accessories, etc.
  return 'other'
}

// Helper function to extract brand from product title or source
function extractBrand(title: string, source?: string): string {
  // If source is provided and looks like a brand name, use it
  if (source && source.length < 30 && !source.includes('.')) {
    return source
  }

  // Common brand patterns in titles
  const brandMatch = title.match(/^([A-Z][a-zA-Z0-9&\s]+?)(?:\s-\s|\s\||\s\(|$)/)
  if (brandMatch) {
    return brandMatch[1].trim()
  }

  // If source looks like a domain, use it
  if (source) {
    return source
  }

  return 'Unknown Brand'
}

// Helper function to get currency symbol
function getCurrencySymbol(currency?: string): string {
  const symbols: { [key: string]: string } = {
    'USD': '$',
    'EUR': '€',
    'GBP': '£',
    'JPY': '¥',
    'CAD': '$',
    'AUD': '$'
  }
  return symbols[currency || 'USD'] || '$'
}

// Helper function to format price
function formatPrice(priceString?: string, extractedPrice?: number, currency?: string): string {
  if (extractedPrice !== undefined && extractedPrice !== null) {
    const symbol = getCurrencySymbol(currency)
    return `${symbol}${extractedPrice.toFixed(2)}`
  }
  if (priceString) {
    return priceString
  }
  return 'Price not available'
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { base64Image, userProfile } = await req.json()

    if (!base64Image) {
      return new Response(
        JSON.stringify({ error: 'base64Image is required', products: [] }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get API keys from environment
    const claudeApiKey = Deno.env.get('CLAUDE_API_KEY')
    const serpApiKey = Deno.env.get('SERPAPI_API_KEY')

    if (!claudeApiKey) {
      throw new Error('CLAUDE_API_KEY not configured')
    }
    if (!serpApiKey) {
      throw new Error('SERPAPI_API_KEY not configured')
    }

    // Generate search terms with Claude
    console.log('Generating search terms with Claude...')

    // Build personalization context from user profile
    let personalizationContext = ''
    if (userProfile) {
      const preferences = []

      if (userProfile.location) {
        preferences.push(`Location: ${userProfile.location}`)
      }

      if (userProfile.favorite_brands && userProfile.favorite_brands.length > 0) {
        preferences.push(`Favorite brands: ${userProfile.favorite_brands.join(', ')}`)
      }

      if (userProfile.favorite_styles && userProfile.favorite_styles.length > 0) {
        preferences.push(`Preferred styles: ${userProfile.favorite_styles.join(', ')}`)
      }

      if (preferences.length > 0) {
        personalizationContext = `\n\nUser preferences:\n${preferences.join('\n')}\n\nUse these preferences to personalize the search terms.`
      }
    }

    const claudeRequest = {
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 200,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: base64Image
              }
            },
            {
              type: 'text',
              text: `Look at this outfit. Generate five concise product search terms for complementary fashion items that would go well with this outfit.${personalizationContext}

IMPORTANT: Analyze the image to auto-detect the person's age, gender, height, weight, and clothing sizes. Keep their hair color, skin tone, and body shape in mind when generating recommendations. Use state of the art fashion principles to ensure the search terms will lead to items that complement their unique characteristics and the outfit shown.

Return ONLY the search terms as an array (search_term = brand + gender + color + item). Example: ["Ralph Lauren men's navy quarter zip", "...", "...", "...", "..."]`
            }
          ]
        }
      ]
    }

    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': claudeApiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(claudeRequest)
    })

    if (!claudeResponse.ok) {
      const errorData = await claudeResponse.text()
      console.error('Claude API error:', claudeResponse.status, errorData)
      return new Response(
        JSON.stringify({
          error: `Claude API error: ${claudeResponse.status}`,
          details: errorData,
          products: []
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const data = await claudeResponse.json()

    if (data.usage) {
      const { input_tokens = 0, output_tokens = 0 } = data.usage
      const cost = (input_tokens / 1e6 * 3) + (output_tokens / 1e6 * 15)
      console.log(`💰 [Claude 4.5] $${cost.toFixed(6)}`)
    }

    const claudeTextBlock = data.content?.find((block: any) => block.type === 'text')
    const searchTerms: string[] = JSON.parse(claudeTextBlock?.text?.match(/\[[\s\S]*?\]/)?.[0] || '[]')

    if (searchTerms.length === 0) {
      console.error('Claude returned empty search terms')
      return new Response(
        JSON.stringify({ error: 'Failed to generate search terms', products: [] }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('Claude generated search terms:', searchTerms)

    const allProducts: any[] = []

    for (const searchTerm of searchTerms) {
    // Build SerpAPI Google Shopping request URL
    const baseParams: { [key: string]: string } = {
      engine: 'google_shopping',
      q: searchTerm,
      api_key: serpApiKey,
      num: '10', // Get 10 results
      gl: userProfile?.currency ? currencyToCountryCode(userProfile.currency) : 'us',
      hl: userProfile?.language ? mapLanguageCode(userProfile.language) : 'en'
    }

    // Add price range filters if user has set them
    if (userProfile?.price_min !== null && userProfile?.price_min !== undefined) {
      baseParams.min_price = userProfile.price_min.toString()
    }
    if (userProfile?.price_max !== null && userProfile?.price_max !== undefined) {
      baseParams.max_price = userProfile.price_max.toString()
    }

    const params = new URLSearchParams(baseParams)

    console.log('Personalized search params:', Object.fromEntries(params))

    const serpApiUrl = `https://serpapi.com/search?${params.toString()}`

    // Make request to SerpAPI
    const response = await fetch(serpApiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      console.error('SerpAPI error:', response.status)
      continue
    }

    const serpData = await response.json()
    console.log('SerpAPI response status:', serpData.search_metadata?.status)

    // Extract products from shopping_results
    const shoppingResults = serpData.shopping_results || []

    if (shoppingResults.length === 0) {
      console.log('No shopping results found for:', searchTerm)
      continue
    }

    console.log(`Found ${shoppingResults.length} shopping results`)

    // Map SerpAPI results to our product format (top 3 per search)
    const products = shoppingResults.slice(0, 3).map((item: any) => ({
      name: item.title || 'Unknown Product',
      brand: extractBrand(item.title || '', item.source),
      description: item.snippet || item.title || 'No description available',
      price: formatPrice(item.price, item.extracted_price, userProfile?.currency),
      imageUrl: item.thumbnail || 'https://via.placeholder.com/150',
      purchaseUrl: item.link || item.product_link || '#',
      category: categorizeProduct(item.title || '', item.snippet)
    }))

    allProducts.push(...products)
    }

    allProducts.sort(() => Math.random() - 0.5)

    console.log(`Returning ${allProducts.length} products from ${searchTerms.length} searches`)

    return new Response(
      JSON.stringify({ products: allProducts, searchTerms }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Product search error:', error)
    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to search products',
        products: []
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
