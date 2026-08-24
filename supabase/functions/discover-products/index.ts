import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from "../_shared/cors.ts"

type UserProfile = {
  currency?: string
  language?: string
  location?: string
  price_min?: number | null
  price_max?: number | null
  favorite_brands?: string[]
  favorite_styles?: string[]
}

const countryCodes: Record<string, string> = {
  USD: 'us', EUR: 'es', GBP: 'uk', JPY: 'jp', CAD: 'ca', AUD: 'au'
}
const languageCodes: Record<string, string> = { English: 'en', Spanish: 'es' }
const currencySymbols: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', JPY: '¥', CAD: '$', AUD: '$'
}

function categorizeProduct(title: string, snippet?: string): string {
  const text = `${title} ${snippet || ''}`.toLowerCase()
  if (text.match(/\b(shirt|blouse|sweater|hoodie|jacket|coat|pullover|sweatshirt)\b/)) return 'shirts'
  if (text.match(/\b(pant|jean|trouser|short|skirt|legging|chino|cargo|jogger)\b/)) return 'pants'
  if (text.match(/\b(shoe|sneaker|boot|sandal|heel|loafer|slipper|footwear)\b/)) return 'shoes'
  return 'other'
}

function extractBrand(title: string, source?: string): string {
  if (source && source.length < 30 && !source.includes('.')) return source
  return title.match(/^([A-Z][a-zA-Z0-9&\s]+?)(?:\s-\s|\s\||\s\(|$)/)?.[1]?.trim() || source || 'Unknown Brand'
}

function formatPrice(item: Record<string, unknown>, currency: string): string {
  if (typeof item.extracted_price === 'number') {
    return `${currencySymbols[currency] || '$'}${item.extracted_price.toFixed(2)}`
  }
  return typeof item.price === 'string' ? item.price : 'Price not available'
}

function preferenceScore(item: Record<string, unknown>, profile?: UserProfile): number {
  const preferences = [
    profile?.location,
    ...(profile?.favorite_brands || []),
    ...(profile?.favorite_styles || []),
  ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
  const productText = `${item.title || ''} ${item.source || ''} ${item.snippet || ''}`.toLowerCase()
  return preferences.reduce((score, preference) =>
    score + (productText.includes(preference.trim().toLowerCase()) ? 1 : 0), 0)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { prompt: rawPrompt, userProfile } = await req.json() as {
      prompt?: unknown
      userProfile?: UserProfile
    }
    const prompt = typeof rawPrompt === 'string' ? rawPrompt.trim() : ''

    if (!prompt) {
      return new Response(JSON.stringify({ error: 'prompt is required', products: [] }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const serpApiKey = Deno.env.get('SERPAPI_API_KEY')
    if (!serpApiKey) throw new Error('SERPAPI_API_KEY not configured')

    const currency = userProfile?.currency || 'USD'
    const params = new URLSearchParams({
      engine: 'google_shopping',
      q: prompt,
      api_key: serpApiKey,
      num: '10',
      gl: countryCodes[currency] || 'us',
      hl: languageCodes[userProfile?.language || 'English'] || 'en',
    })

    if (userProfile?.price_min != null) params.set('min_price', String(userProfile.price_min))
    if (userProfile?.price_max != null) params.set('max_price', String(userProfile.price_max))

    const response = await fetch(`https://serpapi.com/search?${params}`)
    const data = await response.json()
    if (!response.ok || (data.error && data.search_metadata?.status !== 'Success')) {
      throw new Error(data.error || `SerpAPI error: ${response.status}`)
    }

    const rankedResults = (Array.isArray(data.shopping_results) ? data.shopping_results : [])
      .map((item: Record<string, unknown>, index: number) => ({ item, index, score: preferenceScore(item, userProfile) }))
      .sort((a, b) => b.score - a.score || a.index - b.index)

    const seen = new Set<string>()
    const products = []

    for (const { item } of rankedResults) {
      const title = typeof item.title === 'string' ? item.title : 'Unknown Product'
      const purchaseUrl = typeof item.link === 'string' ? item.link :
        typeof item.product_link === 'string' ? item.product_link : ''
      if (!/^https?:\/\//i.test(purchaseUrl) || seen.has(purchaseUrl)) continue

      seen.add(purchaseUrl)
      const description = typeof item.snippet === 'string' ? item.snippet : title
      products.push({
        name: title,
        brand: extractBrand(title, typeof item.source === 'string' ? item.source : undefined),
        description,
        price: formatPrice(item, currency),
        imageUrl: typeof item.thumbnail === 'string' ? item.thumbnail : 'https://via.placeholder.com/150',
        purchaseUrl,
        category: categorizeProduct(title, description),
      })
      if (products.length === 10) break
    }

    return new Response(JSON.stringify({ products }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Discover product search error:', error)
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Failed to search products',
      products: [],
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
