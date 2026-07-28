import { redirect } from "next/navigation";
import AuthForm from "../../components/auth/AuthForm.jsx";
import LanguageSwitch from "../../components/i18n/LanguageSwitch.jsx";
import { isSupabaseConfigured } from "../../lib/supabase/config.js";
import { createClient } from "../../lib/supabase/server.js";

export const metadata = {
  title: "Account · String Art Generator",
};

export default async function LoginPage() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    if (data?.claims?.sub) redirect("/projects");
  }

  return (
    <main className="auth-page">
      <LanguageSwitch />
      <AuthForm configured={isSupabaseConfigured()} />
    </main>
  );
}
