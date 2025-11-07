// =====================================================
// SnazzyAI - Analyze Outfit Edge Function
// Replaces client-side Claude API calls for better security
// =====================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from "../_shared/cors.ts"

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { base64Image } = await req.json()

    if (!base64Image) {
      return new Response(
        JSON.stringify({ error: 'base64Image is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get Claude API key from environment
    const claudeApiKey = Deno.env.get('CLAUDE_API_KEY')
    if (!claudeApiKey) {
      throw new Error('CLAUDE_API_KEY not configured')
    }

    // Analyze the image with Claude Sonnet 4.5
    const analysisRequest = {
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 500,
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
              text: `You are a fashion stylist AI that ONLY analyzes outfits worn by people.

STRICT VALIDATION RULES:
- ONLY accept photos showing a person wearing clothing/outfit
- REJECT photos of: rooms, furniture, objects, plants, tools, landscapes, animals, food, etc.
- REJECT photos without a visible person in clothing
- If the photo is not fashion-related, set "isValidPhoto": false and return minimal data

Analyze this outfit and suggest specific product search terms.

Return a JSON response:
{
  "outfitName": "creative name for the outfit (max 3 words)" OR "Invalid Photo" if not fashion,
  "shortDescription": "fashion review description (must be 10-15 words exactly)" OR "Photo does not show a person wearing an outfit" if invalid,
  "rating": number from 3-7 (be moderate with ratings) OR 0 if invalid photo,
  "isValidPhoto": true ONLY if photo shows a person in clothing, false otherwise,
  "searchTerms": "specific search terms for complementary fashion items" OR "" if invalid
}

If isValidPhoto is false, set searchTerms to empty string "".`
            }
          ]
        }
      ]
    }

    // Make request to Claude API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': claudeApiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(analysisRequest)
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error('Claude API error:', response.status, errorData)
      throw new Error(`Claude API error: ${response.status}`)
    }

    const data = await response.json()

    // Parse the response
    const textBlock = data.content?.find((block: any) => block.type === 'text')
    if (!textBlock || !textBlock.text) {
      throw new Error('No text content found in response')
    }

    // Extract JSON from response
    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in response content')
    }

    const result = JSON.parse(jsonMatch[0])

    // Validate the result
    if (!result.outfitName || !result.shortDescription || typeof result.rating !== 'number' || typeof result.isValidPhoto !== 'boolean') {
      throw new Error('Invalid response format from Claude')
    }

    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error in analyze-outfit function:', error)
    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to analyze outfit',
        details: error.toString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
