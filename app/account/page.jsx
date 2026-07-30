import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "../../lib/supabase/config.js";
import { createClient } from "../../lib/supabase/server.js";

export const metadata = {
  title: "Account · String Art Generator",
};

export default async function AccountPage() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    if (data?.claims?.sub) redirect("/projects");
  }
  redirect("/login");
}
