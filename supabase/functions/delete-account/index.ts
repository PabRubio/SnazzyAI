// =====================================================
// SnazzyAI - Delete Account Edge Function
// Deletes the authenticated user and associated data
// =====================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders } from "../_shared/cors.ts"

const STORAGE_BUCKETS = ['outfit-photos', 'try-on-results']
const STORAGE_PAGE_SIZE = 1000
const REMOVE_BATCH_SIZE = 100

const jsonResponse = (body: Record<string, unknown>, status = 200) => {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  )
}

const collectStoragePaths = async (
  supabase: ReturnType<typeof createClient>,
  bucket: string,
  prefix: string
): Promise<string[]> => {
  const paths: string[] = []
  let offset = 0

  while (true) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(prefix, {
        limit: STORAGE_PAGE_SIZE,
        offset,
        sortBy: { column: 'name', order: 'asc' }
      })

    if (error) {
      throw new Error(`Failed to list ${bucket} storage: ${error.message}`)
    }

    if (!data || data.length === 0) {
      break
    }

    for (const item of data) {
      const path = `${prefix}/${item.name}`

      if (!item.id && item.metadata === null) {
        const nestedPaths = await collectStoragePaths(supabase, bucket, path)
        paths.push(...nestedPaths)
      } else {
        paths.push(path)
      }
    }

    if (data.length < STORAGE_PAGE_SIZE) {
      break
    }

    offset += STORAGE_PAGE_SIZE
  }

  return paths
}

const removeStoragePaths = async (
  supabase: ReturnType<typeof createClient>,
  bucket: string,
  paths: string[]
) => {
  for (let i = 0; i < paths.length; i += REMOVE_BATCH_SIZE) {
    const batch = paths.slice(i, i + REMOVE_BATCH_SIZE)
    const { error } = await supabase.storage
      .from(bucket)
      .remove(batch)

    if (error) {
      throw new Error(`Failed to remove ${bucket} storage: ${error.message}`)
    }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      throw new Error('Supabase environment variables are not configured')
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonResponse({ error: 'Missing authorization header' }, 401)
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader }
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    })

    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) {
      return jsonResponse({ error: 'User not authenticated' }, 401)
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    })

    for (const bucket of STORAGE_BUCKETS) {
      const paths = await collectStoragePaths(adminClient, bucket, user.id)
      if (paths.length > 0) {
        await removeStoragePaths(adminClient, bucket, paths)
      }
    }

    const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(user.id)
    if (deleteUserError) {
      throw new Error(`Failed to delete auth user: ${deleteUserError.message}`)
    }

    return jsonResponse({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete account'
    const details = error instanceof Error ? error.toString() : String(error)

    console.error('Error in delete-account function:', error)
    return jsonResponse(
      {
        error: message,
        details
      },
      500
    )
  }
})
