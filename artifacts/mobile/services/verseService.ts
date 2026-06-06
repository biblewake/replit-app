import { isSupabaseConfigured } from "../lib/supabase";

export interface VersePassage {
  reference: string;
  text: string;
  version: string;
}

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";
const FUNCTIONS_BASE = `${SUPABASE_URL}/functions/v1`;

function functionsHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  };
}

export async function fetchVerseByReference(
  reference: string,
  version = "NIV"
): Promise<VersePassage> {
  if (!isSupabaseConfigured) {
    throw new Error(
      "[BibleWake] Supabase is not configured — set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to enable verse lookup."
    );
  }
  const res = await fetch(`${FUNCTIONS_BASE}/verses/by-reference`, {
    method: "POST",
    headers: functionsHeaders(),
    body: JSON.stringify({ reference, version }),
  });
  if (!res.ok) throw new Error("Failed to fetch verse");
  return res.json();
}

export async function suggestVerse(theme?: string, version = "NIV"): Promise<VersePassage> {
  if (!isSupabaseConfigured) {
    throw new Error(
      "[BibleWake] Supabase is not configured — set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to enable verse suggestions."
    );
  }
  const res = await fetch(`${FUNCTIONS_BASE}/verses/suggest`, {
    method: "POST",
    headers: functionsHeaders(),
    body: JSON.stringify({ theme, version }),
  });
  if (!res.ok) throw new Error("Failed to suggest verse");
  return res.json();
}
