"use client";

import {
  useReducer,
  useEffect,
  useRef,
  useCallback,
  type ChangeEvent,
} from "react";
import {
  MagnifyingGlass,
  X,
  ArrowClockwise,
  CheckCircle,
  WarningCircle,
  CaretDown,
  FileText,
} from "@phosphor-icons/react";
import {
  searchKnowledge,
  reindexAll,
  type SearchResult,
} from "@/lib/chromabrain";

// ── State Machine ──────────────────────────────────────────────────

type Status = "idle" | "loading" | "success" | "empty" | "error";

interface Toast {
  message: string;
  type: "success" | "error";
  id: number;
}

interface State {
  query: string;
  results: SearchResult[];
  status: Status;
  error: string | null;
  indexing: boolean;
  expandedIndex: number | null;
  toast: Toast | null;
}

type Action =
  | { type: "SET_QUERY"; payload: string }
  | { type: "SEARCH_START" }
  | { type: "SEARCH_SUCCESS"; payload: SearchResult[] }
  | { type: "SEARCH_EMPTY" }
  | { type: "SEARCH_ERROR"; payload: string }
  | { type: "INDEX_START" }
  | { type: "INDEX_SUCCESS" }
  | { type: "INDEX_ERROR"; payload: string }
  | { type: "TOGGLE_EXPAND"; payload: number }
  | { type: "DISMISS_TOAST" }
  | { type: "CLEAR_QUERY" };

const initialState: State = {
  query: "",
  results: [],
  status: "idle",
  error: null,
  indexing: false,
  expandedIndex: null,
  toast: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_QUERY":
      return { ...state, query: action.payload };
    case "SEARCH_START":
      return { ...state, status: "loading", error: null, expandedIndex: null };
    case "SEARCH_SUCCESS":
      return { ...state, status: "success", results: action.payload };
    case "SEARCH_EMPTY":
      return { ...state, status: "empty", results: [] };
    case "SEARCH_ERROR":
      return { ...state, status: "error", error: action.payload, results: [] };
    case "INDEX_START":
      return { ...state, indexing: true };
    case "INDEX_SUCCESS":
      return {
        ...state,
        indexing: false,
        toast: {
          message: "Reindexing complete",
          type: "success",
          id: Date.now(),
        },
      };
    case "INDEX_ERROR":
      return {
        ...state,
        indexing: false,
        toast: {
          message: action.payload,
          type: "error",
          id: Date.now(),
        },
      };
    case "TOGGLE_EXPAND":
      return {
        ...state,
        expandedIndex:
          state.expandedIndex === action.payload ? null : action.payload,
      };
    case "DISMISS_TOAST":
      return { ...state, toast: null };
    case "CLEAR_QUERY":
      return {
        ...state,
        query: "",
        results: [],
        status: "idle",
        error: null,
        expandedIndex: null,
      };
    default:
      return state;
  }
}

// ── Component ──────────────────────────────────────────────────────

export default function SearchUI() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-focus search input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Auto-dismiss toast after 4 seconds
  useEffect(() => {
    if (state.toast) {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => {
        dispatch({ type: "DISMISS_TOAST" });
      }, 4000);
    }
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, [state.toast?.id]);

  // ── Search Logic ─────────────────────────────────────────────────

  const executeSearch = useCallback(async (query: string) => {
    if (abortRef.current) {
      abortRef.current.abort();
    }

    const controller = new AbortController();
    abortRef.current = controller;

    dispatch({ type: "SEARCH_START" });

    try {
      const data = await searchKnowledge(query, controller.signal);

      if (controller.signal.aborted) return;

      if (data.results.length === 0) {
        dispatch({ type: "SEARCH_EMPTY" });
      } else {
        dispatch({ type: "SEARCH_SUCCESS", payload: data.results });
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return;

      const message =
        err instanceof Error
          ? err.message
          : typeof err === "object" &&
              err !== null &&
              "message" in err &&
              typeof (err as Record<string, unknown>).message === "string"
            ? (err as { message: string }).message
            : "Could not reach ChromaBrain API";

      dispatch({ type: "SEARCH_ERROR", payload: message });
    }
  }, []);

  const handleQueryChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      dispatch({ type: "SET_QUERY", payload: value });

      if (debounceRef.current) clearTimeout(debounceRef.current);

      if (!value.trim()) {
        if (abortRef.current) abortRef.current.abort();
        dispatch({ type: "CLEAR_QUERY" });
        return;
      }

      debounceRef.current = setTimeout(() => {
        executeSearch(value.trim());
      }, 400);
    },
    [executeSearch]
  );

  const handleClear = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    dispatch({ type: "CLEAR_QUERY" });
    inputRef.current?.focus();
  }, []);

  const handleRetry = useCallback(() => {
    if (state.query.trim()) {
      executeSearch(state.query.trim());
    }
  }, [state.query, executeSearch]);

  // ── Reindex Logic ────────────────────────────────────────────────

  const handleReindex = useCallback(async () => {
    if (state.indexing) return;

    dispatch({ type: "INDEX_START" });

    try {
      await reindexAll();
      dispatch({ type: "INDEX_SUCCESS" });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Reindex failed. Try again.";
      dispatch({ type: "INDEX_ERROR", payload: message });
    }
  }, [state.indexing]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  // ── Render ───────────────────────────────────────────────────────

  return (
    <main className="min-h-[100dvh] bg-white">
      <div className="max-w-[900px] mx-auto px-6 py-12 md:py-20">
        {/* ── Header ──────────────────────────────────────────── */}
        <header className="flex items-start justify-between gap-6 mb-12 md:mb-16">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-neutral-900 swiss-heading">
              ChromaBrain
            </h1>
            <p className="text-sm text-neutral-500 mt-2 font-normal">
              Unified knowledge search
            </p>
          </div>
          <button
            onClick={handleReindex}
            disabled={state.indexing}
            className="relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium
                       rounded-none border border-neutral-300 bg-white text-neutral-700
                       transition-all duration-150 ease-out
                       hover:bg-neutral-900 hover:text-white hover:border-neutral-900
                       active:translate-y-[1px]
                       disabled:opacity-50 disabled:cursor-not-allowed
                       focus-visible:outline-2 focus-visible:outline-offset-2
                       min-h-[44px] cursor-pointer"
            aria-label="Reindex all knowledge files"
          >
            <ArrowClockwise
              size={16}
              weight="bold"
              className={state.indexing ? "animate-spin" : ""}
            />
            <span>Reindex</span>
            {state.indexing && (
              <span
                className="absolute -top-2 -right-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider
                           bg-swiss-orange text-white"
              >
                Indexing
              </span>
            )}
          </button>
        </header>

        {/* ── Search Input ────────────────────────────────────── */}
        <section className="mb-10">
          <label
            htmlFor="search-input"
            className="block text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-3"
          >
            Search
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
              {state.status === "loading" ? (
                <div
                  className="w-4 h-4 border-2 border-neutral-300 border-t-swiss-orange animate-spin"
                  role="status"
                  aria-label="Searching"
                />
              ) : (
                <MagnifyingGlass
                  size={20}
                  weight="regular"
                  className="text-neutral-400"
                />
              )}
            </div>
            <input
              ref={inputRef}
              id="search-input"
              type="search"
              value={state.query}
              onChange={handleQueryChange}
              placeholder="Type to search..."
              autoComplete="off"
              className="w-full pl-12 pr-12 py-4 text-lg
                         bg-white border-2 border-neutral-200 border-b-neutral-400
                         text-neutral-900 placeholder:text-neutral-300
                         transition-all duration-150
                         focus:outline-none focus:border-neutral-900 focus:border-b-neutral-900
                         rounded-none"
              aria-describedby="search-hint"
            />
            {state.query && (
              <button
                onClick={handleClear}
                className="absolute inset-y-0 right-0 flex items-center pr-4
                           text-neutral-400 hover:text-neutral-900
                           transition-colors duration-150
                           min-w-[44px] justify-center cursor-pointer"
                aria-label="Clear search"
              >
                <X size={16} weight="bold" />
              </button>
            )}
          </div>
        </section>

        {/* ── Results Region ──────────────────────────────────── */}
        <section aria-live="polite" aria-busy={state.status === "loading"}>
          {/* Idle State */}
          {state.status === "idle" && <IdleState />}

          {/* Loading State */}
          {state.status === "loading" && <LoadingSkeletons />}

          {/* Results */}
          {state.status === "success" && (
            <ResultsList
              results={state.results}
              expandedIndex={state.expandedIndex}
              onToggle={(idx: number) =>
                dispatch({ type: "TOGGLE_EXPAND", payload: idx })
              }
            />
          )}

          {/* Empty State */}
          {state.status === "empty" && <EmptyState query={state.query} />}

          {/* Error State */}
          {state.status === "error" && (
            <ErrorBanner message={state.error} onRetry={handleRetry} />
          )}
        </section>
      </div>

      {/* ── Toast ─────────────────────────────────────────────── */}
      {state.toast && (
        <Toast
          message={state.toast.message}
          type={state.toast.type}
          onDismiss={() => dispatch({ type: "DISMISS_TOAST" })}
        />
      )}
    </main>
  );
}

// ── Sub-Components ─────────────────────────────────────────────────

function IdleState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 md:py-28 text-center">
      <div className="w-20 h-20 border-2 border-neutral-200 flex items-center justify-center mb-8">
        <FileText size={36} weight="thin" className="text-neutral-300" />
      </div>
      <p className="text-lg font-medium text-neutral-400 tracking-tight">
        Start typing to search
      </p>
    </div>
  );
}

function LoadingSkeletons() {
  return (
    <div className="max-w-3xl space-y-0 divide-y divide-neutral-100" role="status">
      <span className="sr-only">Loading search results</span>
      {[0, 1, 2].map((i) => (
        <div key={i} className="py-6">
          <div className="flex items-center justify-between mb-3">
            <div className="skeleton-shimmer h-4 w-40" />
            <div className="skeleton-shimmer h-4 w-12" />
          </div>
          <div className="skeleton-shimmer h-3 w-32 mb-3" />
          <div className="space-y-2">
            <div className="skeleton-shimmer h-3 w-full" />
            <div className="skeleton-shimmer h-3 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

interface ResultsListProps {
  results: SearchResult[];
  expandedIndex: number | null;
  onToggle: (idx: number) => void;
}

function ResultsList({ results, expandedIndex, onToggle }: ResultsListProps) {
  return (
    <div className="max-w-3xl">
      <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-6">
        {results.length} result{results.length !== 1 ? "s" : ""}
      </p>
      <div className="divide-y divide-neutral-200">
        {results.map((result, idx) => (
          <ResultItem
            key={`${result.source}-${idx}`}
            result={result}
            index={idx}
            isExpanded={expandedIndex === idx}
            onToggle={() => onToggle(idx)}
          />
        ))}
      </div>
    </div>
  );
}

interface ResultItemProps {
  result: SearchResult;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
}

function ResultItem({ result, index, isExpanded, onToggle }: ResultItemProps) {
  const scorePercent = (result.score * 100).toFixed(1);
  const truncatedSource =
    result.source.length > 40
      ? `...${result.source.slice(-37)}`
      : result.source;

  return (
    <div
      className="py-6 fade-up"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* Title Row */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="text-base font-semibold text-neutral-900 leading-snug">
          {result.title}
        </h3>
        <span
          className="shrink-0 px-2 py-0.5 text-xs font-mono font-medium
                     tabular-nums bg-neutral-100 text-neutral-600 border border-neutral-200"
        >
          {scorePercent}%
        </span>
      </div>

      {/* Source */}
      <p className="text-xs text-neutral-400 font-mono mb-3" title={result.source}>
        {truncatedSource}
      </p>

      {/* Snippet */}
      <button
        onClick={onToggle}
        className="group w-full text-left cursor-pointer"
        aria-expanded={isExpanded}
        aria-label={`${isExpanded ? "Collapse" : "Expand"} snippet for ${result.title}`}
      >
        <p
          className={`text-sm text-neutral-600 leading-relaxed
                      transition-all duration-150
                      ${isExpanded ? "" : "line-clamp-2"}`}
        >
          {result.snippet}
        </p>
        <span
          className="inline-flex items-center gap-1 mt-2 text-xs text-neutral-400
                     group-hover:text-swiss-orange transition-colors duration-150"
        >
          <CaretDown
            size={12}
            weight="bold"
            className={`transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
          />
          {isExpanded ? "Less" : "More"}
        </span>
      </button>
    </div>
  );
}

interface EmptyStateProps {
  query: string;
}

function EmptyState({ query }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 md:py-24 text-center fade-up">
      <p className="text-base font-medium text-neutral-500">
        No results for &ldquo;<span className="text-neutral-900">{query}</span>&rdquo;
      </p>
    </div>
  );
}

interface ErrorBannerProps {
  message: string | null;
  onRetry: () => void;
}

function ErrorBanner({ message, onRetry }: ErrorBannerProps) {
  return (
    <div
      className="max-w-3xl border-l-4 border-swiss-orange bg-neutral-50 p-5 fade-up"
      role="alert"
    >
      <div className="flex items-start gap-3">
        <WarningCircle
          size={20}
          weight="fill"
          className="text-swiss-orange shrink-0 mt-0.5"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-neutral-900">
            {message || "Could not reach ChromaBrain API"}
          </p>
        </div>
        <button
          onClick={onRetry}
          className="shrink-0 px-4 py-2 text-sm font-medium
                     bg-neutral-900 text-white
                     hover:bg-neutral-700 active:translate-y-[1px]
                     transition-all duration-150
                     min-h-[44px] cursor-pointer"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

interface ToastProps {
  message: string;
  type: "success" | "error";
  onDismiss: () => void;
}

function Toast({ message, type, onDismiss }: ToastProps) {
  const isSuccess = type === "success";

  return (
    <div
      className="fixed bottom-6 right-6 left-6 sm:left-auto sm:min-w-[280px] sm:max-w-[360px] z-40"
      role="status"
      aria-live="polite"
    >
      <div
        className={`toast-enter flex items-center gap-3 px-4 py-3
                    border border-neutral-200 bg-white
                    ${isSuccess ? "border-l-4 border-l-success" : "border-l-4 border-l-swiss-orange"}`}
      >
        {isSuccess ? (
          <CheckCircle size={18} weight="fill" className="text-success shrink-0" />
        ) : (
          <WarningCircle size={18} weight="fill" className="text-swiss-orange shrink-0" />
        )}
        <p className="text-sm font-medium text-neutral-900 flex-1">
          {message}
        </p>
        <button
          onClick={onDismiss}
          className="text-neutral-400 hover:text-neutral-900 transition-colors
                     min-w-[32px] min-h-[32px] flex items-center justify-center cursor-pointer"
          aria-label="Dismiss notification"
        >
          <X size={14} weight="bold" />
        </button>
      </div>
    </div>
  );
}
