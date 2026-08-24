// Keep these pinned URL imports until the deployed function's dependencies are migrated.
// deno-lint-ignore no-import-prefix
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// deno-lint-ignore no-import-prefix
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const STORAGE_BUCKETS = ["outfit-photos", "try-on-results"];
const STORAGE_PAGE_SIZE = 1000;
const REMOVE_BATCH_SIZE = 100;

const jsonResponse = (body: Record<string, unknown>, status = 200) => {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
};

const collectStoragePaths = async (
  supabaseClient: ReturnType<typeof createClient>,
  bucketName: string,
  prefix: string,
): Promise<string[]> => {
  const storagePaths: string[] = [];
  let offset = 0;

  while (true) {
    const { data: storageItems, error: listError } = await supabaseClient
      .storage
      .from(bucketName)
      .list(prefix, {
        limit: STORAGE_PAGE_SIZE,
        offset,
        sortBy: { column: "name", order: "asc" },
      });

    if (listError) {
      throw new Error(
        `Failed to list ${bucketName} storage: ${listError.message}`,
      );
    }

    if (!storageItems || storageItems.length === 0) {
      break;
    }

    for (const storageItem of storageItems) {
      const storagePath = `${prefix}/${storageItem.name}`;

      if (!storageItem.id && storageItem.metadata === null) {
        const nestedStoragePaths = await collectStoragePaths(
          supabaseClient,
          bucketName,
          storagePath,
        );
        storagePaths.push(...nestedStoragePaths);
      } else {
        storagePaths.push(storagePath);
      }
    }

    if (storageItems.length < STORAGE_PAGE_SIZE) {
      break;
    }

    offset += STORAGE_PAGE_SIZE;
  }

  return storagePaths;
};

const removeStoragePaths = async (
  supabaseClient: ReturnType<typeof createClient>,
  bucketName: string,
  storagePaths: string[],
) => {
  for (
    let startIndex = 0;
    startIndex < storagePaths.length;
    startIndex += REMOVE_BATCH_SIZE
  ) {
    const pathBatch = storagePaths.slice(
      startIndex,
      startIndex + REMOVE_BATCH_SIZE,
    );
    const { error: removeError } = await supabaseClient.storage
      .from(bucketName)
      .remove(pathBatch);

    if (removeError) {
      throw new Error(
        `Failed to remove ${bucketName} storage: ${removeError.message}`,
      );
    }
  }
};

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      throw new Error("Supabase environment variables are not configured");
    }

    const authorizationHeader = request.headers.get("Authorization");
    if (!authorizationHeader) {
      return jsonResponse({ error: "Missing authorization header" }, 401);
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authorizationHeader },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: { user }, error: userError } = await userClient.auth
      .getUser();
    if (userError || !user) {
      return jsonResponse({ error: "User not authenticated" }, 401);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    for (const bucketName of STORAGE_BUCKETS) {
      const storagePaths = await collectStoragePaths(
        adminClient,
        bucketName,
        user.id,
      );
      if (storagePaths.length > 0) {
        await removeStoragePaths(adminClient, bucketName, storagePaths);
      }
    }

    const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(
      user.id,
    );
    if (deleteUserError) {
      throw new Error(`Failed to delete auth user: ${deleteUserError.message}`);
    }

    return jsonResponse({ success: true });
  } catch (error) {
    const errorMessage = error instanceof Error
      ? error.message
      : "Failed to delete account";
    const errorDetails = error instanceof Error
      ? error.toString()
      : String(error);

    return jsonResponse(
      {
        error: errorMessage,
        details: errorDetails,
      },
      500,
    );
  }
});
