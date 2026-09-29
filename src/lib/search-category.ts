import type { RadarItem, RadarType } from "@/lib/radar";

const categoryTerms: Array<{ type: RadarType; pattern: RegExp }> = [
  { type: "GAME", pattern: /\b(legend of zelda|zelda|pokemon|pokémon|nintendo|mario|metroid|animal crossing|super smash|xbox|playstation|steam|minecraft|fortnite|call of duty|grand theft auto|\bgta\b|elden ring|video game|game release)\b/i },
  { type: "MUSIC", pattern: /\b(album|single|song|artist|concert|tour|music|record)\b/i },
  { type: "SHOW", pattern: /\b(series|season|episode|streaming|tv show|television)\b/i },
  { type: "MOVIE", pattern: /\b(movie|film|cinema)\b/i },
];

export function inferSearchType(query: string, items: RadarItem[]): RadarType | undefined {
  const normalized = query.trim();
  if (normalized.length < 2) return undefined;

  const explicit = categoryTerms.find(({ pattern }) => pattern.test(normalized));
  if (explicit) return explicit.type;

  const needle = normalized.toLocaleLowerCase();
  const matches = items.filter((item) => item.title.toLocaleLowerCase().includes(needle) || needle.includes(item.title.toLocaleLowerCase()));
  if (!matches.length) return undefined;
  return matches.sort((a, b) => b.title.length - a.title.length)[0]?.type;
}
