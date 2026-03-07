// ── Types ──────────────────────────────────────────────────────────

export interface SearchResult {
  title: string;
  source: string;
  snippet: string;
  score: number;
}

export interface SearchResponse {
  results: SearchResult[];
  took?: string;
}

export interface IndexResponse {
  message?: string;
  indexed?: number;
}

export interface ApiError {
  message: string;
  status: number;
}

// ── Config ─────────────────────────────────────────────────────────

function getBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) {
    throw new Error(
      "NEXT_PUBLIC_API_URL is not defined. Set it in .env.local"
    );
  }
  return url.replace(/\/+$/, "");
}

// ── Fetch Helpers ──────────────────────────────────────────────────

export async function searchKnowledge(
  query: string,
  signal?: AbortSignal
): Promise<SearchResponse> {
  const baseUrl = getBaseUrl();
  const encoded = encodeURIComponent(query.trim());
  const url = `${baseUrl}/api/search?q=${encoded}`;

  const res = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    signal,
  });

  if (!res.ok) {
    const error: ApiError = {
      message: `Search failed (${res.status})`,
      status: res.status,
    };
    throw error;
  }

  const data: SearchResponse = await res.json();
  return data;
}

export async function reindexAll(
  signal?: AbortSignal
): Promise<IndexResponse> {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/api/index/all`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
  });

  if (!res.ok) {
    const error: ApiError = {
      message: `Reindex failed (${res.status})`,
      status: res.status,
    };
    throw error;
  }

  const data: IndexResponse = await res.json();
  return data;
}
