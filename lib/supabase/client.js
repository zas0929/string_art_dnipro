import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseConfig } from "./config.js";

let browserClient;

export function createClient() {
  if (browserClient) return browserClient;
  const { url, publishableKey } = getSupabaseConfig();
  browserClient = createBrowserClient(url, publishableKey);
  return browserClient;
}
