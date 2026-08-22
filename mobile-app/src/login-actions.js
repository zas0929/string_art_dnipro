import { createClient } from "../../lib/supabase/client.js";
import { isSupabaseConfigured } from "../../lib/supabase/config.js";

export async function signOut() {
  if (isSupabaseConfigured()) {
    await createClient().auth.signOut();
  }
  window.location.assign("/create");
}
