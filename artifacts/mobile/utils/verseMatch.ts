function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, "")
    .split(/\s+/)
    .filter(Boolean);
}

export function checkVerseAccuracy(spoken: string, target: string): number {
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
