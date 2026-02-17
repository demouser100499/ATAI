/**
 * SerpAPI helpers for keyword discovery: Google Autocomplete and Google Shopping.
 * Requires SERPAPI_KEY in environment. Used by category keyword discovery.
 */

const SERPAPI_ENDPOINT = "https://serpapi.com/search.json";

function getApiKey(): string | undefined {
  return process.env.SERPAPI_KEY?.trim() || undefined;
}

export function isSerpApiConfigured(): boolean {
  return !!getApiKey();
}

/** Fetch Google Autocomplete suggestions for a seed query. Returns unique suggestion strings. */
export async function serpapiAutocomplete(seed: string, geo: string): Promise<Set<string>> {
  const apiKey = getApiKey();
  if (!apiKey) return new Set();

  const params = new URLSearchParams({
    engine: "google_autocomplete",
    q: seed,
    hl: "en",
    gl: geo || "US",
    api_key: apiKey,
  });

  const res = await fetch(`${SERPAPI_ENDPOINT}?${params.toString()}`, { cache: "no-store" });
  if (!res.ok) return new Set();

  const data = (await res.json()) as { suggestions?: Array<{ value?: string }> };
  const keywords = new Set<string>();
  for (const item of data.suggestions ?? []) {
    const value = item?.value;
    if (typeof value === "string" && value.trim()) keywords.add(value.trim());
  }
  return keywords;
}

/** Fetch Google Shopping result titles for a seed query. Returns unique title strings (lowercased). */
export async function serpapiShopping(seed: string, geo: string): Promise<Set<string>> {
  const apiKey = getApiKey();
  if (!apiKey) return new Set();

  const params = new URLSearchParams({
    engine: "google_shopping",
    q: seed,
    hl: "en",
    gl: geo || "US",
    api_key: apiKey,
  });

  const res = await fetch(`${SERPAPI_ENDPOINT}?${params.toString()}`, { cache: "no-store" });
  if (!res.ok) return new Set();

  const data = (await res.json()) as { shopping_results?: Array<{ title?: string }> };
  const keywords = new Set<string>();
  for (const item of data.shopping_results ?? []) {
    const title = item?.title;
    if (typeof title === "string" && title.trim()) keywords.add(title.toLowerCase().trim());
  }
  return keywords;
}
