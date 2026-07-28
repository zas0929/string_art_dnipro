import AccountView from "../../components/auth/AccountView.jsx";
import LanguageSwitch from "../../components/i18n/LanguageSwitch.jsx";
import { isSupabaseConfigured } from "../../lib/supabase/config.js";
import { createClient } from "../../lib/supabase/server.js";

export const metadata = {
  title: "Account · String Art Generator",
};

export default async function AccountPage() {
  let email = "";
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    email = data?.claims?.email || "";
  }

  return (
    <main className="auth-page">
      <LanguageSwitch />
      <AccountView email={email} />
    </main>
  );
}
