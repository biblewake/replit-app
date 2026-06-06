function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, "")
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Check how accurately `spoken` matches `target`.
 * Returns a 0–1 score based on word overlap.
 *
 * `translation` is reserved for future AI-backed validation where the
 * scoring service needs to know which Bible translation to validate against.
 */
export function checkVerseAccuracy(
  spoken: string,
  target: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  translation?: string
): number {
  const spokenTokens = tokenize(spoken);
  const targetTokens = tokenize(target);
  if (targetTokens.length === 0) return 0;
  const targetSet = new Set(targetTokens);
  let matches = 0;
  for (const word of spokenTokens) {
    if (targetSet.has(word)) {
      matches++;
      targetSet.delete(word);
    }
  }
  return matches / targetTokens.length;
}
