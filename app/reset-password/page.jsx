import { redirect } from "next/navigation";
import ResetPasswordForm from "../../components/auth/ResetPasswordForm.jsx";
import { isSupabaseConfigured } from "../../lib/supabase/config.js";
import { createClient } from "../../lib/supabase/server.js";

export const metadata = {
  title: "Reset password · String Art Generator",
};

export default async function ResetPasswordPage() {
  const configured = isSupabaseConfigured();
  if (configured) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    if (!data?.claims?.sub) redirect("/login");
  }

  return (
    <main className="auth-page">
      <ResetPasswordForm configured={configured} />
    </main>
  );
}
