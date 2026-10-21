"use client";

import { useState, useEffect, useCallback } from "react";
import { STORAGE_KEYS, THEMES } from "../lib/constants";

/**
 * useTheme Hook
 * Manages light / dark theme persistence, system preference synchronization,
 * and sets the data-theme attribute on the root html element.
 */
export function useTheme() {
  const [theme, setThemeState] = useState(THEMES.LIGHT);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME);
      if (savedTheme === THEMES.DARK || savedTheme === THEMES.LIGHT) {
        setThemeState(savedTheme);
        document.documentElement.setAttribute("data-theme", savedTheme);
      } else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
        setThemeState(THEMES.DARK);
        document.documentElement.setAttribute("data-theme", THEMES.DARK);
      }
    } catch {
      // Fallback silently if localStorage is restricted
    }
    setMounted(true);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prevTheme) => {
      const nextTheme = prevTheme === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK;
      try {
        localStorage.setItem(STORAGE_KEYS.THEME, nextTheme);
        document.documentElement.setAttribute("data-theme", nextTheme);
      } catch {
        // Fallback silently
      }
      return nextTheme;
    });
  }, []);

  const setTheme = useCallback((newTheme) => {
    if (newTheme !== THEMES.LIGHT && newTheme !== THEMES.DARK) return;
    setThemeState(newTheme);
    try {
      localStorage.setItem(STORAGE_KEYS.THEME, newTheme);
      document.documentElement.setAttribute("data-theme", newTheme);
    } catch {
      // Fallback silently
    }
  }, []);

  return {
    theme,
    toggleTheme,
    setTheme,
    mounted,
  };
}

