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
        if (!error && data && typeof data.value === "boolean") {
          cache[key] = data.value;
          setValue(data.value);
        }
      } catch {
        // network failure — keep the safe default of false
      }
    })();
  }, [key]);

  return value;
}
