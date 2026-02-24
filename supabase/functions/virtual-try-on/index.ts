// =====================================================
// SnazzyAI - Virtual Try-On Edge Function
// Uses Google Gemini 2.5 Flash Image for AI try-on
// =====================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from "../_shared/cors.ts"

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { userPhotoBase64, clothingImageUrl } = await req.json()

    if (!userPhotoBase64 || !clothingImageUrl) {
      return new Response(
        JSON.stringify({ error: 'userPhotoBase64 and clothingImageUrl are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get Google API key from environment
    const googleApiKey = Deno.env.get('GOOGLE_API_KEY')
    if (!googleApiKey) {
      throw new Error('GOOGLE_API_KEY not configured')
    }

    console.log('Starting virtual try-on...')
    console.log('Clothing image URL:', clothingImageUrl)

    // Download clothing image and convert to base64
    console.log('Downloading clothing image...')
    const clothingImageBase64 = await downloadImageAsBase64(clothingImageUrl)

    // Prepare the Gemini API request
    const prompt = `You are an expert virtual try-on AI. Take the person from the first image and seamlessly place the clothing item from the second image onto them. Make it look realistic and natural, as if they are actually wearing the clothing item. Ensure proper fit, lighting, and shadows. The result should look like a professional photo of the person wearing the new clothing.`

    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: prompt
            },
            {
              inline_data: {
                mime_type: 'image/jpeg',
                data: userPhotoBase64
              }
            },
            {
              inline_data: {
                mime_type: 'image/jpeg',
                data: clothingImageBase64
              }
            }
          ]
        }
      ],
      generationConfig: {
        responseModalities: ['IMAGE'],
        temperature: 0.4,
        topP: 0.95,
        topK: 40
      }
    }

    console.log('Sending request to Gemini API...')

    // Make the API request
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${googleApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      }
    )

    if (!response.ok) {
      const errorData = await response.text()
      console.error('Gemini API error:', response.status, errorData)
      throw new Error(`Gemini API error: ${response.status}`)
    }

    const data = await response.json()
    console.log('Received response from Gemini API')

    const { promptTokenCount = 0, candidatesTokenCount = 0 } = data.usageMetadata || {}
    const cost = 0.0022 + 0.039 + (promptTokenCount / 1e6 * 0.30) + (candidatesTokenCount / 1e6 * 2.50)
    console.log(`💰 [Gemini 2.5 Flash] $${cost.toFixed(6)}`)

    // Extract the generated image from response
    if (data && data.candidates && data.candidates.length > 0) {
      const candidate = data.candidates[0]

      if (candidate.content && candidate.content.parts) {
        for (const part of candidate.content.parts) {
          // Check for both camelCase and snake_case formats
          const imageData = part.inlineData || part.inline_data

          if (imageData && imageData.data) {
            console.log('Successfully extracted generated image')

            // Get the mime type
            const mimeType = imageData.mimeType || imageData.mime_type || 'image/jpeg'

            // Return the result
            return new Response(
              JSON.stringify({
                success: true,
                base64: imageData.data,
                dataUri: `data:${mimeType};base64,${imageData.data}`
              }),
              {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              }
            )
          }
        }
      }
    }

    // If we get here, no image was found in the response
    console.error('No image found in Gemini response:', JSON.stringify(data).substring(0, 500))
    throw new Error('No image generated in response')

  } catch (error) {
    console.error('Virtual try-on failed:', error)
    return new Response(
      JSON.stringify({
        error: error.message || 'Virtual try-on failed',
        details: error.toString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

// Helper function to download image from URL and convert to base64
async function downloadImageAsBase64(imageUrl: string): Promise<string> {
  try {
    console.log('Downloading image:', imageUrl)

    const response = await fetch(imageUrl)
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status}`)
    }

    // Get the image as an array buffer
    const arrayBuffer = await response.arrayBuffer()

    // Convert to base64
    const base64 = btoa(
      new Uint8Array(arrayBuffer)
        .reduce((data, byte) => data + String.fromCharCode(byte), '')
    )

    return base64
  } catch (error) {
    console.error('Error downloading image:', error)
    throw new Error('Failed to download clothing image')
  }
}
