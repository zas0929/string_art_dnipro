"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "../../lib/supabase/client.js";
import { isSupabaseConfigured } from "../../lib/supabase/config.js";
import { resetProjectStore } from "../../storage/project-store.js";

const AuthSessionContext = createContext({ user: null, loading: false });

export function AuthSessionProvider({ user: initialUser, children }) {
  const [user, setUser] = useState(initialUser);
  const [loading, setLoading] = useState(!initialUser && isSupabaseConfigured());
  const userIdRef = useRef(initialUser?.id || null);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return undefined;
    }

    const supabase = createClient();
    let active = true;

    const applyAuthUser = async (authUser) => {
      const nextUserId = authUser?.id || null;
      if (userIdRef.current !== nextUserId) {
        userIdRef.current = nextUserId;
        resetProjectStore();
      }

      if (!authUser) {
        if (active) {
          setUser(null);
          setLoading(false);
        }
        return;
      }

      let role = "user";
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", authUser.id)
          .maybeSingle();
        if (profile?.role === "admin") role = "admin";
      } catch {
        role = "user";
      }

      if (active) {
        setUser({
          id: authUser.id,
          email: authUser.email || "",
          role,
        });
        setLoading(false);
      }
    };

    void supabase.auth.getSession().then(({ data }) => {
      if (active) void applyAuthUser(data?.session?.user || null);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      queueMicrotask(() => {
        if (active) void applyAuthUser(session?.user || null);
      });
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({ user, loading }),
    [user?.id, user?.email, user?.role, loading],
  );
  return (
    <AuthSessionContext.Provider value={value}>
      {children}
    </AuthSessionContext.Provider>
  );
}

export function useAuthSession() {
  return useContext(AuthSessionContext);
}
