export type RankingCategory = 'RSG' | 'SSG';

export interface RankingEntry {
  name: string;
  timeSeconds: number;
}

export interface Rankings {
  RSG: RankingEntry[];
  SSG: RankingEntry[];
}

export const RANKING_STORAGE_KEY = 'escape-room-rankings';
export const RANKING_LIMIT = 100;

function isRankingEntry(value: unknown): value is RankingEntry {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const entry = value as Record<string, unknown>;
  return typeof entry.name === 'string'
    && /^[a-zA-Z0-9]{0,5}$/.test(entry.name)
    && typeof entry.timeSeconds === 'number'
    && Number.isFinite(entry.timeSeconds)
    && entry.timeSeconds >= 0;
}

function readCategory(value: unknown, category: RankingCategory): RankingEntry[] {
  if (!Array.isArray(value) || !value.every(isRankingEntry)) {
    throw new Error(`Invalid ${category} ranking data in local storage`);
  }
  return value.slice(0, RANKING_LIMIT).sort(
    (first, second) => first.timeSeconds - second.timeSeconds,
  );
}

export function getRankings(): Rankings {
  const stored = localStorage.getItem(RANKING_STORAGE_KEY);
  if (stored === null) {
    return { RSG: [], SSG: [] };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch (error) {
    throw new Error('Unable to parse ranking data in local storage', { cause: error });
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Invalid ranking data in local storage');
  }

  const rankings = parsed as Record<string, unknown>;
  return {
    RSG: readCategory(rankings.RSG, 'RSG'),
    SSG: readCategory(rankings.SSG, 'SSG'),
  };
}

export function getRankingPosition(
  category: RankingCategory,
  timeSeconds: number,
): number | null {
  const entries = getRankings()[category];
  const position = entries.findIndex((entry) => timeSeconds < entry.timeSeconds);
  const insertionIndex = position === -1 ? entries.length : position;
  return insertionIndex < RANKING_LIMIT ? insertionIndex + 1 : null;
}

export function addRankingEntry(
  category: RankingCategory,
  entry: RankingEntry,
): number | null {
  if (!/^[a-zA-Z0-9]{0,5}$/.test(entry.name) || !Number.isFinite(entry.timeSeconds)
    || entry.timeSeconds < 0) {
    throw new Error('Invalid ranking entry');
  }

  const rankings = getRankings();
  const entries = rankings[category];
  const position = entries.findIndex((current) => entry.timeSeconds < current.timeSeconds);
  const insertionIndex = position === -1 ? entries.length : position;
  if (insertionIndex >= RANKING_LIMIT) {
    return null;
  }
  entries.splice(insertionIndex, 0, entry);
  rankings[category] = entries.slice(0, RANKING_LIMIT);
  localStorage.setItem(RANKING_STORAGE_KEY, JSON.stringify(rankings));
  return insertionIndex + 1;
}
