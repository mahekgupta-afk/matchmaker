import { createClient, SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

/** Client-side Supabase client (anon key) — used for Realtime subscriptions and reads. */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (browserClient) return browserClient;
  browserClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  return browserClient;
}

let serverClient: SupabaseClient | null = null;

/** Server-only Supabase client (service role) — used from API routes, never exposed to the browser. */
export function getSupabaseServerClient(): SupabaseClient {
  if (serverClient) return serverClient;
  serverClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
  return serverClient;
}
