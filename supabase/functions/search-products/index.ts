// =====================================================
// SnazzyAI - Search Products Edge Function
// Replaces Django backend product search endpoint
// Uses OpenAI Responses API with web search
// =====================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from "../_shared/cors.ts"

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { searchTerms } = await req.json()

    if (!searchTerms) {
      return new Response(
        JSON.stringify({ error: 'searchTerms is required', products: [] }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get OpenAI API key from environment
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY not configured')
    }

    console.log('Searching for products with web search:', searchTerms)

    // Use OpenAI Responses API with web search tool
    const searchRequest = {
      model: 'gpt-5',
      tools: [{ type: 'web_search' }],
      input: `Search the web for 3 real fashion products currently for sale that match: ${searchTerms}.

Focus on finding actual products from retailers like Amazon, Nordstrom, ASOS, Nike, Adidas, Zara, H&M with:
- Exact product names and brands
- Current prices in USD
- Direct product page URLs
- Product images

Return ONLY a JSON array with exactly 3 products in this format (do not ask for clarification):
[
  {
    "name": "exact product name",
    "brand": "brand name",
    "description": "brief description",
    "price": "$XX.XX",
    "imageUrl": "direct image URL",
    "purchaseUrl": "product page URL",
    "category": "shirts or pants or shoes or other"
  }
]

IMPORTANT: Classify each product into one of these categories:
- "shirts" - tops, t-shirts, shirts, blouses, sweaters, hoodies, jackets, coats
- "pants" - jeans, trousers, shorts, skirts, leggings
- "shoes" - all footwear including sneakers, boots, sandals, heels
- "other" - accessories, hats, bags, jewelry, watches, belts, etc.`
    }

    // Make request to OpenAI Responses API
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify(searchRequest)
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error('OpenAI API error:', response.status, errorData)
      return new Response(
        JSON.stringify({
          error: `OpenAI API error: ${response.status}`,
          details: errorData,
          products: []
        }),
        {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const data = await response.json()

    // Parse the response from the Responses API format
    let content = ''

    // According to docs, the response has an 'output' array with web_search_call and message items
    if (data.output && Array.isArray(data.output)) {
      // Find the message output item (type: 'message')
      for (const item of data.output) {
        if (item.type === 'message') {
          if (item.content && Array.isArray(item.content)) {
            // The content is an array with output_text objects
            for (const c of item.content) {
              if (c.type === 'output_text' && c.text) {
                content = c.text
                break
              }
            }
          }
          break
        }
      }
    }

    console.log('Raw search response:', content)

    if (!content) {
      console.log('No content found in response:', JSON.stringify(data, null, 2))
      return new Response(
        JSON.stringify({ products: [] }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Extract JSON array from content
    const jsonMatch = content.match(/\[\s*\{[\s\S]*?\}\s*\]/)
    if (jsonMatch) {
      try {
        const products = JSON.parse(jsonMatch[0])
        console.log('Parsed products:', products)

        return new Response(
          JSON.stringify({ products }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      } catch (parseError) {
        console.error('JSON decode error:', parseError)
        console.error('Attempted to parse:', jsonMatch[0].substring(0, 200) + '...')
        return new Response(
          JSON.stringify({ products: [] }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }
    }

    console.log('No products found in response')
    return new Response(
      JSON.stringify({ products: [] }),
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
