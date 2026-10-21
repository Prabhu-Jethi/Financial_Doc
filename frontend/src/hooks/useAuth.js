"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "../lib/supabase/browser";

/**
 * useAuth Hook
 * Manages Supabase authentication state, active session listeners,
 * and unified sign-out dispatch across the application.
 */
export function useAuth() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let subscription = null;

    try {
      const supabase = createClient();

      // 1. Initial user check
      supabase.auth.getUser().then(({ data }) => {
        if (data?.user) {
          setCurrentUser(data.user);
        }
        setLoading(false);
      });

      // 2. Real-time auth state subscription
      const { data: authListener } = supabase.auth.onAuthStateChange(
        (event, session) => {
          setCurrentUser(session?.user || null);
          setLoading(false);

          if (event === "SIGNED_OUT") {
            window.location.href = "/login";
          }
        }
      );

      subscription = authListener?.subscription;
    } catch {
      setLoading(false);
    }

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      window.location.href = "/login";
    } catch {
      window.location.href = "/login";
    }
  }, []);

  return {
    currentUser,
    loading,
    signOut,
  };
}

