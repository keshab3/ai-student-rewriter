import {
  RewriteModeOption,
  RewriteResponse,
  RewriteStatsResponse,
  UpdateRewriteInput,
} from "@/lib/api";

const GUEST_REWRITES_STORAGE_KEY = "ai-student-rewriter-guest-rewrites";

export function readGuestRewrites(): RewriteResponse[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(GUEST_REWRITES_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as RewriteResponse[];
    return Array.isArray(parsed) ? parsed.map(normalizeGuestRewrite) : [];
  } catch {
    return [];
  }
}

export function addGuestRewrite(rewrite: RewriteResponse): RewriteResponse {
  const saved = {
    ...rewrite,
    id: nextGuestRewriteId(),
    createdAt: new Date().toISOString(),
  };
  writeGuestRewrites([saved, ...readGuestRewrites()]);
  return saved;
}

export function updateGuestRewrite(
  id: number,
  input: UpdateRewriteInput,
  modes: RewriteModeOption[],
): RewriteResponse {
  const modeLabel = modes.find((mode) => mode.value === input.mode)?.label ?? input.mode;
  let updated: RewriteResponse | null = null;
  const next = readGuestRewrites().map((item) => {
    if (item.id !== id) {
      return item;
    }

    updated = {
      ...item,
      originalText: input.originalText,
      rewrittenText: input.rewrittenText,
      mode: input.mode,
      modeLabel,
      avoidWords: input.avoidWords ?? item.avoidWords ?? [],
      vocabularySuggestions: input.vocabularySuggestions ?? item.vocabularySuggestions ?? {},
    };
    return updated;
  });

  if (!updated) {
    throw new Error("Local rewrite was not found.");
  }

  writeGuestRewrites(next);
  return updated;
}

export function deleteGuestRewrite(id: number) {
  writeGuestRewrites(readGuestRewrites().filter((item) => item.id !== id));
}

export function getGuestRewriteStats(): RewriteStatsResponse {
  const rewrites = readGuestRewrites();
  return {
    totalRewrites: rewrites.length,
    recentRewrites: rewrites.slice(0, 5),
  };
}

function writeGuestRewrites(rewrites: RewriteResponse[]) {
  window.localStorage.setItem(
    GUEST_REWRITES_STORAGE_KEY,
    JSON.stringify(rewrites),
  );
}

function nextGuestRewriteId(): number {
  return Date.now();
}

function normalizeGuestRewrite(item: RewriteResponse): RewriteResponse {
  return {
    ...item,
    vocabularySuggestions: item.vocabularySuggestions ?? {},
    avoidWords: item.avoidWords ?? [],
    matchedAvoidWords: item.matchedAvoidWords ?? [],
    evaluation: item.evaluation ?? null,
  };
}
