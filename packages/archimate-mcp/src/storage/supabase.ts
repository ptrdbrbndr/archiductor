import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Supabase Database schema — typed for archimate_models table
// ---------------------------------------------------------------------------

interface ArchimateModelRow {
  id: string;
  user_id: string;
  name: string;
  format: string;
  content: string;
  version: number;
  created_at: string;
  updated_at: string;
}

type Database = {
  public: {
    Tables: {
      archimate_models: {
        Row: ArchimateModelRow;
        Insert: Omit<ArchimateModelRow, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<ArchimateModelRow>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

// ---------------------------------------------------------------------------
// Supabase client — service role (bypasses RLS for server-side model access)
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = ReturnType<typeof createClient<any>>;

let _client: AnySupabaseClient | null = null;

function getClient(): AnySupabaseClient {
  if (_client) return _client;
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_KEY"];
  if (!url) throw new Error("Missing required environment variable: SUPABASE_URL");
  if (!key) throw new Error("Missing required environment variable: SUPABASE_SERVICE_KEY");
  _client = createClient<Database>(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  return _client;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface FetchModelResult {
  ok: true;
  content: string;
  version: number;
  name: string;
}

export interface StorageError {
  ok: false;
  code: "NOT_FOUND" | "FORBIDDEN" | "DB_ERROR";
  message: string;
}

export type FetchResult = FetchModelResult | StorageError;
export type SaveResult = { ok: true; version: number } | StorageError;

/**
 * Fetch the OEF XML content for a model, verifying user ownership.
 */
export async function fetchModel(
  modelId: string,
  userId: string,
): Promise<FetchResult> {
  const { data, error } = await getClient()
    .from("archimate_models")
    .select("id, user_id, name, format, content, version")
    .eq("id", modelId)
    .eq("user_id", userId)
    .single() as { data: ArchimateModelRow | null; error: { code?: string; message: string } | null };

  if (error) {
    if (error.code === "PGRST116") {
      return {
        ok: false,
        code: "NOT_FOUND",
        message: `Model ${modelId} not found or access denied`,
      };
    }
    return {
      ok: false,
      code: "DB_ERROR",
      message: `Database error: ${error.message}`,
    };
  }

  if (!data) {
    return {
      ok: false,
      code: "NOT_FOUND",
      message: `Model ${modelId} not found`,
    };
  }

  return {
    ok: true,
    content: data.content,
    version: data.version,
    name: data.name,
  };
}

/**
 * Save updated OEF XML content for a model.
 * Increments the version counter and sets updated_at.
 */
export async function saveModel(
  modelId: string,
  userId: string,
  content: string,
  currentVersion: number,
): Promise<SaveResult> {
  const nextVersion = currentVersion + 1;

  const { error } = await getClient()
    .from("archimate_models")
    .update({
      content,
      version: nextVersion,
      updated_at: new Date().toISOString(),
    } satisfies Partial<ArchimateModelRow>)
    .eq("id", modelId)
    .eq("user_id", userId) as { error: { message: string } | null };

  if (error) {
    return {
      ok: false,
      code: "DB_ERROR",
      message: `Failed to save model: ${error.message}`,
    };
  }

  return { ok: true, version: nextVersion };
}

/**
 * Create a new model record.
 */
export async function createModel(
  userId: string,
  name: string,
  content: string,
  format: string = "oef",
): Promise<{ ok: true; id: string } | StorageError> {
  const { data, error } = await getClient()
    .from("archimate_models")
    .insert({
      user_id: userId,
      name,
      format,
      content,
      version: 1,
    })
    .select("id")
    .single() as { data: { id: string } | null; error: { message: string } | null };

  if (error) {
    return {
      ok: false,
      code: "DB_ERROR",
      message: `Failed to create model: ${error.message}`,
    };
  }

  if (!data) {
    return {
      ok: false,
      code: "DB_ERROR",
      message: "Failed to create model: no data returned",
    };
  }

  return { ok: true, id: data.id };
}
