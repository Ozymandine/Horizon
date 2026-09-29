const AI_GENERATED_SIGNALS = /\b(?:ai[\s-]*generated|generated\s+(?:by|with|using)\s+(?:an?\s+)?(?:ai|suno|udio)|created\s+(?:by|with|using)\s+(?:an?\s+)?(?:ai|suno|udio)|(?:suno|udio)\s+ai|ai\s+(?:music|song)\s+generator)\b/i;

export function isExplicitlyAiGenerated(...values: Array<string | null | undefined>) {
  return AI_GENERATED_SIGNALS.test(values.filter(Boolean).join(" "));
}
