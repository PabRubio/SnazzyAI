// =====================================================
// SnazzyAI - Analyze Outfit Edge Function
// Uses OpenAI GPT-5 Responses API with vision
// =====================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from "../_shared/cors.ts"

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { base64Image, userProfile } = await req.json()

    if (!base64Image) {
      return new Response(
        JSON.stringify({ error: 'base64Image is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get API keys from environment
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')

    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY not configured')
    }

    // Analyze the image with GPT-5.1 Responses API
    const analysisRequest = {
      model: 'gpt-5.1',
      reasoning: {
        effort: 'none'  // No reasoning for maximum speed
      },
      input: [
        {
          type: 'message',
          role: 'user',
          content: [
            {
              type: 'input_image',
              image_url: `data:image/jpeg;base64,${base64Image}`
            },
            {
              type: 'input_text',
              text: `You are a fashion stylist AI that ONLY analyzes outfits worn by people.

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
}`
            }
          ]
        }
      ]
    }

    // Make request to OpenAI Responses API
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify(analysisRequest)
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error('OpenAI API error:', response.status, errorData)
      throw new Error(`OpenAI API error: ${response.status}`)
    }

    const data = await response.json()

    if (data.usage) {
      const { input_tokens = 0, output_tokens = 0 } = data.usage
      const cost = (input_tokens / 1e6 * 1.25) + (output_tokens / 1e6 * 10)
      console.log(`💰 [GPT-5.1] $${cost.toFixed(6)}`)
    }

    // Parse the response from Responses API format
    let content = ''

    // The response has an 'output' array with message items
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

    if (!content) {
      throw new Error('No text content found in response')
    }

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in response content')
    }

    const gptResult = JSON.parse(jsonMatch[0])

    // Validate the GPT-5 result
    if (!gptResult.outfitName || !gptResult.shortDescription || typeof gptResult.rating !== 'number' || typeof gptResult.isValidPhoto !== 'boolean') {
      throw new Error('Invalid response format from GPT-5')
    }

    // Return the GPT-5 analysis result
    return new Response(
      JSON.stringify(gptResult),
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
