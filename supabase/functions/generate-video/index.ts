// =====================================================
// SnazzyAI - Video Generation Edge Function
// Uses xAI Grok Imagine API for image-to-video
// =====================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders } from "../_shared/cors.ts"

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { imagePath, prompt } = await req.json()

    if (!imagePath) {
      return new Response(
        JSON.stringify({ error: 'imagePath is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get xAI API key from environment
    const xaiApiKey = Deno.env.get('XAIGROK_API_KEY')
    if (!xaiApiKey) {
      throw new Error('XAIGROK_API_KEY not configured')
    }

    // Generate a signed URL for the private storage image
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('try-on-results')
      .createSignedUrl(imagePath, 600) // 10 minutes

    if (signedUrlError || !signedUrlData?.signedUrl) {
      throw new Error(`Failed to generate signed URL: ${signedUrlError?.message || 'Unknown error'}`)
    }

    const imageUrl = signedUrlData.signedUrl

    console.log('Image URL (signed):', imageUrl)
    console.log('Starting video generation...')

    // Default fashion try-on prompt
    const videoPrompt = prompt ||
      "The person slowly turns 360 degrees in place, showing off the outfit from all angles. Smooth rotation, natural movement."

    // Step 1: Start video generation
    console.log('Calling xAI API to start generation...')
    const startResponse = await fetch('https://api.x.ai/v1/videos/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${xaiApiKey}`
      },
      body: JSON.stringify({
        model: 'grok-imagine-video',
        image: { url: imageUrl },
        aspect_ratio: '9:16',
        prompt: videoPrompt,
        resolution: '720p',
        duration: 7,
      })
    })

    if (!startResponse.ok) {
      const errorData = await startResponse.text()
      console.error('xAI API error:', startResponse.status, errorData)
      throw new Error(`xAI API error: ${startResponse.status} - ${errorData}`)
    }

    const startData = await startResponse.json()
    const requestId = startData.request_id || startData.id

    if (!requestId) {
      console.error('No request ID in response:', startData)
      throw new Error('No request ID returned from API')
    }

    console.log('Video generation started, request ID:', requestId)

    // Step 2: Poll for completion (with timeout)
    const maxAttempts = 90  // 3 minutes max (90 * 2 seconds)
    const pollInterval = 2000  // 2 seconds

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(resolve => setTimeout(resolve, pollInterval))

      console.log(`Polling attempt ${attempt + 1}/${maxAttempts}...`)

      const statusResponse = await fetch(
        `https://api.x.ai/v1/videos/${requestId}`,
        {
          headers: { 'Authorization': `Bearer ${xaiApiKey}` }
        }
      )

      if (!statusResponse.ok) {
        console.log(`Poll failed with status ${statusResponse.status}, retrying...`)
        continue
      }

      const statusData = await statusResponse.json()
      console.log('Poll response:', JSON.stringify(statusData))

      // API returns { url, duration } when complete (no status field)
      if (statusData.video?.url) {
        console.log('Video generation completed!')
        console.log('Video URL:', statusData.video.url)

        return new Response(
          JSON.stringify({
            success: true,
            videoUrl: statusData.video.url,
            duration: statusData.video.duration
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Check for error in response
      if (statusData.error) {
        console.error('Video generation failed:', statusData)
        throw new Error(statusData.error.message || statusData.error || 'Video generation failed')
      }
    }

    throw new Error('Video generation timed out after 3 minutes')

  } catch (error) {
    console.error('Video generation failed:', error)
    return new Response(
      JSON.stringify({
        error: error.message || 'Video generation failed',
        details: error.toString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
