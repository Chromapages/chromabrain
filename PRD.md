# ChromaBrain PRD - Unified Knowledge Search API

## Project Overview

**Project Name:** ChromaBrain
**Type:** Internal Knowledge Base API
**Purpose:** Unified search across all Chromapages knowledge (MEMORY.md, agent files, daily logs, project docs)
**Users:** Eric (frontend) + Chroma (backend AI assistant)

---

## Problem Statement

Our knowledge is fragmented:
- `MEMORY.md` - long-term memory
- `memory/*.md` - agent files, daily logs
- `memory/preferences.md` - client info, user prefs
- Project docs scattered across MiDRIVE

Currently I have to search files manually. A unified API would let me find anything instantly.

---

## Goals

1. **Fast semantic search** across all markdown/text files
2. **Instant answers** for Chroma (me) to retrieve context
3. **Easy indexing** - auto-discover new files
4. **Zero friction** - just ask and get results

---

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Files     │────▶│  ChromaBrain │────▶│   Pinecone  │
│ (Markdown,  │     │   Backend    │     │  (Vector   │
│   JSON,     │     │   (Express)  │     │   Store)   │
│   TXT)      │     │              │     │             │
└─────────────┘     └──────────────┘     └─────────────┘
       ▲                   │
       │                   ▼
       │           ┌──────────────┐
       │           │  Chroma AI  │
       └───────────┤   (User)    │
                   └──────────────┘
```

---

## Tech Stack

### Backend (Chroma)
- **Runtime:** Node.js / Express
- **Vector Store:** Pinecone (already configured in TOOLS.md)
- **Embeddings:** OpenAI text-embedding-3-small
- **Indexing:** File watcher + on-demand reindex

### Frontend (Eric)
- **Windsurf IDE + Claude Code**
- **Framework:** Next.js 14+ (App Router)
- **UI:** Simple search interface

---

## Data Sources to Index

| Source | Path | Type |
|--------|------|------|
| Memory | `memory/` | .md |
| Preferences | `memory/preferences.md` | .md |
| Agent Files | `memory/agent-*.md` | .md |
| Daily Logs | `memory/YYYY-*.md` | .md |
| Project Docs | `projects/` | .md, .txt |
| Main Memory | `MEMORY.md` | .md |

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Status check |
| POST | `/index` | Index a file or folder |
| POST | `/api/index/all` | Full reindex |
| GET | `/api/search?q=` | Semantic search |
| GET | `/api/sources` | List indexed sources |
| DELETE | `/api/index/:id` | Remove from index |

---

## Search Response Format

```json
{
  "results": [
    {
      "title": "Client Info - UNT",
      "source": "memory/preferences.md",
      "snippet": "Jason Astrowood, Union National Tax...",
      "score": 0.92
    }
  ],
  "took": "45ms"
}
```

---

## Pinecone Configuration

Already configured in TOOLS.md:
- **API Key:** `pcsk_7KsUqn_16qS8kx1cVJomzxkwkiWTXTAW5tToGXneccjp9QCN67erfjPpEALG7uNEd6RTxv`
- **Index Name:** `chromabrain` (create if not exists)
- **Dimension:** 1536 (text-embedding-3-small)

---

## File Structure

```
chromabrain/
├── server.js           # Express API
├── indexer.js          # File indexing logic
├── pinecone.js         # Pinecone client
├── embeddings.js       # OpenAI embeddings
├── config.js           # Configuration
├── package.json
└── .env                # API keys
```

---

## For Eric (Frontend Prompt)

**IMPORTANT:** Read `NEXT_PUBLIC_API_URL` from env — do NOT hardcode localhost.

### File Structure
```
app/search/page.tsx       ← Page wrapper
app/search/SearchUI.tsx   ← "use client" UI component
lib/chromabrain.ts        ← API fetch helpers + TypeScript types
```

### TypeScript Interface
```ts
interface SearchResult {
  title: string;
  source: string;
  snippet: string;
  score: number; // 0.0–1.0 float
}
```

### UI Requirements
- **Search Bar:** Debounce 400ms, loading spinner in input, clear button (×)
- **Results:** Title, source (truncated link), snippet (2 lines, expand on click), score as %
- **Empty State:** "No results found for '[query]'"
- **Reindex Button:** Top-right, shows amber pulsing "Indexing..." badge, green toast on success, red on fail
- **Error State:** Inline banner with Retry button

### Technical Constraints
- Use `fetch` + `AbortController` to cancel in-flight requests
- Client-side only ("use client")
- No external state libs — use `useState` / `useReducer`
- Extract API logic to `lib/chromabrain.ts`
- Accessibility: visible label + `aria-live="polite"` on results
- No hardcoded localhost URLs
- TypeScript strict — zero `any` types

### API Contract
| Action | Method | Endpoint |
|--------|--------|----------|
| Search | GET | `/api/search?q={query}` |
| Reindex All | POST | `/api/index/all` |

---

## Tasks

### Eric's Tasks (Frontend)
- [ ] Build Next.js search UI at /search
- [ ] Implement SearchUI.tsx with debounce, loading, results
- [ ] Add reindex button with indexing state
- [ ] Add toast notifications
- [ ] Add error handling with retry
- [ ] Create lib/chromabrain.ts API helpers
- [ ] Test and verify

### Chroma's Tasks (Backend)
- [ ] Create Express server (server.js)
- [ ] Implement Pinecone client (pinecone.js)
- [ ] Implement file indexer (indexer.js)
- [ ] Implement embeddings (embeddings.js)
- [ ] Create /health endpoint
- [ ] Create /api/search endpoint
- [ ] Create /api/index/all endpoint
- [ ] Create /api/sources endpoint
- [ ] Connect to Pinecone and test
- [ ] Integrate with frontend

---

## Timeline

| Phase | Description | Time |
|-------|-------------|------|
| 1 | Backend API + indexing | 1-2 days |
| 2 | Frontend search UI | 1 day |
| 3 | Integration + testing | 1 day |

---

## Success Criteria

1. **Search latency:** < 200ms
2. **Index time:** < 30s for all memory files
3. **Accuracy:** Relevant results in top 3
4. **Uptime:** 99% (background service)
