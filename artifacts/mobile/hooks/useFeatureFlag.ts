import { useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

const cache: Record<string, boolean> = {};

/**
 * Fetches a boolean feature flag from the `feature_flags` table once per
 * app session (cached in module-level memory). Returns `false` while loading
 * and on any error so the safe default is always "off".
 */
export function useFeatureFlag(key: string): boolean {
  const [value, setValue] = useState<boolean>(() => cache[key] ?? false);

  useEffect(() => {
    if (key in cache) {
      setValue(cache[key]);
      return;
    }
    if (!isSupabaseConfigured) return;

    (async () => {
      try {
        const { data, error } = await supabase
          .from("feature_flags")
          .select("value")
          .eq("key", key)
          .single();
        if (error) {
          // PGRST116 = no rows found (flag doesn't exist). Any other error
          // may indicate an RLS misconfiguration — the anon role needs a
          // SELECT policy on feature_flags for unauthenticated reads to work.
          if (error.code !== "PGRST116") {
            console.warn(
              `[useFeatureFlag] Could not read flag "${key}" — possible RLS issue (anon SELECT policy required):`,
              error.message
            );
          }
          return;
        }
        if (data && typeof data.value === "boolean") {
          cache[key] = data.value;
          setValue(data.value);
        } else {
          console.warn(
            `[useFeatureFlag] Flag "${key}" returned no data — possible RLS issue (anon SELECT policy required)`
          );
        }
      } catch {
        // network failure — keep the safe default of false
      }
    })();
  }, [key]);

  return value;
}
