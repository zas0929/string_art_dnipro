"use client";

import { createContext, useContext, useMemo } from "react";

const AuthSessionContext = createContext({ user: null });

export function AuthSessionProvider({ user, children }) {
  const value = useMemo(() => ({ user }), [user?.id, user?.email]);
  return (
    <AuthSessionContext.Provider value={value}>
      {children}
    </AuthSessionContext.Provider>
  );
}

export function useAuthSession() {
  return useContext(AuthSessionContext);
}
