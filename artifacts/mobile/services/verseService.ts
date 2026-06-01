export interface VersePassage {
  reference: string;
  text: string;
  version: string;
}

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

export async function fetchVerseByReference(
  reference: string,
  version = "NIV"
): Promise<VersePassage> {
  const res = await fetch(`${API_BASE}/verses/by-reference`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reference, version }),
  });
  if (!res.ok) throw new Error("Failed to fetch verse");
  return res.json();
}

export async function suggestVerse(theme?: string, version = "NIV"): Promise<VersePassage> {
  const res = await fetch(`${API_BASE}/verses/suggest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ theme, version }),
  });
  if (!res.ok) throw new Error("Failed to suggest verse");
  return res.json();
}
