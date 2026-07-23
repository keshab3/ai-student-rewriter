"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCheck,
  faChevronDown,
  faChevronLeft,
  faChevronRight,
  faChevronUp,
  faClock,
  faFileLines,
  faFilePdf,
  faMagnifyingGlass,
  faPenToSquare,
  faRotateRight,
  faSpinner,
  faTrashCan,
  faTriangleExclamation,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { useEffect, useMemo, useState } from "react";
import {
  deleteRewrite,
  listRewriteModes,
  listRewrites,
  RewriteMode,
  RewriteModeOption,
  RewriteResponse,
  updateRewrite,
} from "@/lib/api";
import { downloadRewritePdf, downloadRewriteText, formatDate } from "@/components/RewriteWorkspace";
import { readUserToken, USER_AUTH_CHANGED_EVENT } from "@/lib/auth";
import {
  deleteGuestRewrite,
  readGuestRewrites,
  updateGuestRewrite,
} from "@/lib/guestRewrites";
import { Skeleton, SkeletonText } from "@/components/Skeleton";

const ITEMS_PER_PAGE = 5;

export function HistoryPageClient() {
  const [history, setHistory] = useState<RewriteResponse[]>([]);
  const [modes, setModes] = useState<RewriteModeOption[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editOriginalText, setEditOriginalText] = useState("");
  const [editRewrittenText, setEditRewrittenText] = useState("");
  const [editMode, setEditMode] = useState<RewriteMode>("GRAMMAR_FIX");
  const [authToken, setAuthToken] = useState<string | null>(() =>
    typeof window === "undefined" ? null : readUserToken(),
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [modeFilter, setModeFilter] = useState<RewriteMode | "ALL">("ALL");
  const [sortOrder, setSortOrder] = useState<"NEWEST" | "OLDEST">("NEWEST");
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedItemIds, setExpandedItemIds] = useState<Set<number>>(() => new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visibleHistory = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return [...history]
      .filter((item) => {
        const matchesMode = modeFilter === "ALL" || item.mode === modeFilter;
        const matchesSearch =
          !normalizedSearch ||
          item.originalText.toLowerCase().includes(normalizedSearch) ||
          item.rewrittenText.toLowerCase().includes(normalizedSearch) ||
          item.modeLabel.toLowerCase().includes(normalizedSearch) ||
          item.avoidWords.some((word) => word.toLowerCase().includes(normalizedSearch)) ||
          Object.entries(item.vocabularySuggestions).some(
            ([word, suggestions]) =>
              word.toLowerCase().includes(normalizedSearch) ||
              suggestions.some((suggestion) => suggestion.toLowerCase().includes(normalizedSearch)),
          ) ||
          Boolean(item.evaluation?.finalDecision.toLowerCase().includes(normalizedSearch));

        return matchesMode && matchesSearch;
      })
      .sort((first, second) => {
        const firstTime = new Date(first.createdAt).getTime();
        const secondTime = new Date(second.createdAt).getTime();
        return sortOrder === "NEWEST" ? secondTime - firstTime : firstTime - secondTime;
      });
  }, [history, modeFilter, searchQuery, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(visibleHistory.length / ITEMS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStart = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
  const pageItems = visibleHistory.slice(pageStart, pageStart + ITEMS_PER_PAGE);

  async function fetchHistory(token: string | null) {
    const modeOptions = await listRewriteModes();
    if (token) {
      const historyItems = await listRewrites(token);
      return [historyItems, modeOptions] as const;
    }
    return [readGuestRewrites(), modeOptions] as const;
  }

  async function loadHistory() {
    setIsLoading(true);
    setError(null);
    try {
      const [historyItems, modeOptions] = await fetchHistory(authToken);
      setHistory(historyItems);
      setModes(modeOptions);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load rewrite history.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    function handleAuthChanged() {
      setAuthToken(readUserToken());
    }

    window.addEventListener(USER_AUTH_CHANGED_EVENT, handleAuthChanged);
    window.addEventListener("storage", handleAuthChanged);
    window.addEventListener("focus", handleAuthChanged);

    return () => {
      window.removeEventListener(USER_AUTH_CHANGED_EVENT, handleAuthChanged);
      window.removeEventListener("storage", handleAuthChanged);
      window.removeEventListener("focus", handleAuthChanged);
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    async function loadInitialHistory() {
      try {
        const [historyItems, modeOptions] = await fetchHistory(authToken);
        if (!isActive) return;
        setHistory(historyItems);
        setModes(modeOptions);
      } catch (loadError) {
        if (!isActive) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load rewrite history.",
        );
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadInitialHistory();

    return () => {
      isActive = false;
    };
  }, [authToken]);

  async function handleDelete(id: number) {
    setError(null);
    try {
      if (authToken) {
        await deleteRewrite(id, authToken);
      } else {
        deleteGuestRewrite(id);
      }
      setHistory((current) => current.filter((item) => item.id !== id));
      setExpandedItemIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Could not delete this rewrite.",
      );
    }
  }

  function startEdit(item: RewriteResponse) {
    setEditingId(item.id);
    setEditOriginalText(item.originalText);
    setEditRewrittenText(item.rewrittenText);
    setEditMode(item.mode);
    setExpandedItemIds(new Set([item.id]));
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditOriginalText("");
    setEditRewrittenText("");
    setEditMode("GRAMMAR_FIX");
  }

  async function handleUpdate(id: number) {
    const originalText = editOriginalText.trim();
    const rewrittenText = editRewrittenText.trim();

    if (!originalText || !rewrittenText) {
      setError("Original and rewritten text are required.");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const existing = history.find((item) => item.id === id);
      if (!existing) {
        throw new Error("Rewrite was not found.");
      }
      const input = {
        originalText,
        rewrittenText,
        mode: editMode,
        avoidWords: existing.avoidWords,
        vocabularySuggestions: existing.vocabularySuggestions,
      };
      const updated = authToken
        ? await updateRewrite(id, input, authToken)
        : updateGuestRewrite(id, input, modes);
      setHistory((current) =>
        current.map((item) => (item.id === id ? updated : item)),
      );
      cancelEdit();
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Could not update this rewrite.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  function toggleItemDetails(id: number) {
    setExpandedItemIds((current) => {
      return current.has(id) ? new Set() : new Set([id]);
    });
    if (editingId !== id) {
      cancelEdit();
    }
  }

  return (
    <main className="page-shell">
      <section className="overflow-hidden rounded-md border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-950">History</h1>
            <p className="mt-1 text-sm text-slate-600">
              {formatRewriteCount(history.length)} saved in{" "}
              {authToken ? "database" : "this browser"}
            </p>
          </div>
          <div className="grid w-full grid-cols-1 gap-2 sm:w-auto sm:flex">
            <button
              type="button"
              onClick={() => void loadHistory()}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 sm:w-auto"
            >
              <FontAwesomeIcon icon={faRotateRight} className="h-4 w-4" aria-hidden="true" />
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="mx-5 mt-5 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            <FontAwesomeIcon icon={faTriangleExclamation} className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {isLoading ? (
          <HistoryPageSkeleton />
        ) : history.length ? (
          <div>
            <div className="grid gap-3 border-b border-slate-200 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_190px_150px]">
              <label className="relative block">
                <span className="sr-only">Search rewrite history</span>
                <FontAwesomeIcon
                  icon={faMagnifyingGlass}
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  value={searchQuery}
                  onChange={(event) => {
                    setSearchQuery(event.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search original, result, or mode"
                  className="h-10 w-full rounded-md border border-slate-300 pl-9 pr-3 text-sm text-slate-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                />
              </label>

              <label>
                <span className="sr-only">Filter by mode</span>
                <select
                  value={modeFilter}
                  onChange={(event) => {
                    setModeFilter(event.target.value as RewriteMode | "ALL");
                    setCurrentPage(1);
                  }}
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                >
                  <option value="ALL">All modes</option>
                  {modes.map((mode) => (
                    <option key={mode.value} value={mode.value}>
                      {mode.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span className="sr-only">Sort history</span>
                <select
                  value={sortOrder}
                  onChange={(event) => {
                    setSortOrder(event.target.value as "NEWEST" | "OLDEST");
                    setCurrentPage(1);
                  }}
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                >
                  <option value="NEWEST">Newest first</option>
                  <option value="OLDEST">Oldest first</option>
                </select>
              </label>
            </div>

            <div className="flex flex-col gap-1 border-b border-slate-200 px-4 py-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
              <span>
                Showing {visibleHistory.length} of {history.length} rewrites
              </span>
              {visibleHistory.length > ITEMS_PER_PAGE && (
                <span>
                  Page {safeCurrentPage} of {totalPages}
                </span>
              )}
            </div>

            {visibleHistory.length ? (
              <>
                <div className="divide-y divide-slate-200">
                  {pageItems.map((item) => {
                    const isExpanded = expandedItemIds.has(item.id) || editingId === item.id;

                    return (
                    <article key={item.id} className="px-3 py-4 sm:px-4">
                      <button
                        type="button"
                        onClick={() => toggleItemDetails(item.id)}
                        aria-expanded={isExpanded}
                        className="block w-full overflow-hidden rounded-md text-left transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-200"
                      >
                        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 px-1 py-1 sm:flex sm:items-start sm:justify-between sm:gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-medium text-slate-900">
                                {item.modeLabel}
                              </span>
                              <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                                <FontAwesomeIcon icon={faClock} className="h-3.5 w-3.5" aria-hidden="true" />
                                {formatDate(item.createdAt)}
                              </span>
                            </div>
                            <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">
                              {item.originalText}
                            </p>
                            <HistoryMeta item={item} />
                          </div>
                          <span className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 self-start rounded-md px-2 text-xs font-semibold text-slate-500">
                            {isExpanded ? "Hide" : "Open"}
                            <FontAwesomeIcon icon={isExpanded ? faChevronUp : faChevronDown} className="h-3.5 w-3.5" aria-hidden="true" />
                          </span>
                        </div>
                      </button>
                      {isExpanded && (editingId === item.id ? (
                        <div className="mt-4 space-y-4 overflow-hidden rounded-md border border-slate-200 bg-slate-50 px-3 py-4 sm:px-4">
                          <div className="grid gap-4 md:grid-cols-2">
                            <div>
                              <label
                                htmlFor={`edit-original-${item.id}`}
                                className="text-sm font-medium text-slate-800"
                              >
                                Original text
                              </label>
                              <textarea
                                id={`edit-original-${item.id}`}
                                value={editOriginalText}
                                onChange={(event) => setEditOriginalText(event.target.value)}
                                rows={5}
                                className="mt-2 w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-sm leading-6 text-slate-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                              />
                            </div>
                            <div>
                              <label
                                htmlFor={`edit-rewritten-${item.id}`}
                                className="text-sm font-medium text-slate-800"
                              >
                                Rewritten text
                              </label>
                              <textarea
                                id={`edit-rewritten-${item.id}`}
                                value={editRewrittenText}
                                onChange={(event) => setEditRewrittenText(event.target.value)}
                                rows={5}
                                className="mt-2 w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-sm leading-6 text-slate-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                              />
                            </div>
                          </div>
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <select
                              value={editMode}
                              onChange={(event) => setEditMode(event.target.value as RewriteMode)}
                              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100 sm:w-auto"
                            >
                              {modes.map((mode) => (
                                <option key={mode.value} value={mode.value}>
                                  {mode.label}
                                </option>
                              ))}
                            </select>
                            <div className="grid grid-cols-2 gap-2 sm:flex">
                              <button
                                type="button"
                                onClick={cancelEdit}
                                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 sm:w-auto"
                              >
                                <FontAwesomeIcon icon={faXmark} className="h-4 w-4" aria-hidden="true" />
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleUpdate(item.id)}
                                disabled={isSaving}
                                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
                              >
                                {isSaving ? (
                                  <FontAwesomeIcon icon={faSpinner} className="h-4 w-4 animate-spin" aria-hidden="true" />
                                ) : (
                                  <FontAwesomeIcon icon={faCheck} className="h-4 w-4" aria-hidden="true" />
                                )}
                                {isSaving ? "Saving" : "Save"}
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-4 overflow-hidden">
                          <p className="whitespace-pre-wrap break-words text-base leading-7 text-slate-950">
                            {item.rewrittenText}
                          </p>
                          <HistoryDetails item={item} />
                          <HistoryActions
                            item={item}
                            onEdit={() => startEdit(item)}
                            onDelete={() => void handleDelete(item.id)}
                          />
                        </div>
                      ))}
                    </article>
                    );
                  })}
                </div>

                {totalPages > 1 && (
                  <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-slate-600">
                      {pageStart + 1}-{Math.min(pageStart + ITEMS_PER_PAGE, visibleHistory.length)} of{" "}
                      {visibleHistory.length}
                    </p>
                    <div className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:flex">
                      <button
                        type="button"
                        onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                        disabled={safeCurrentPage === 1}
                        className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:opacity-50 sm:w-auto"
                      >
                        <FontAwesomeIcon icon={faChevronLeft} className="h-4 w-4" aria-hidden="true" />
                        Previous
                      </button>
                      <button
                        type="button"
                        onClick={() => setCurrentPage(safeCurrentPage + 1)}
                        disabled={safeCurrentPage === totalPages}
                        className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:opacity-50 sm:w-auto"
                      >
                        Next
                        <FontAwesomeIcon icon={faChevronRight} className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex h-72 items-center justify-center px-5 text-center text-sm text-slate-500">
                No rewrites match the current search or filter.
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-72 items-center justify-center px-5 text-center text-sm text-slate-500">
            No rewrite history has been saved yet.
          </div>
        )}
      </section>
    </main>
  );
}

function HistoryPageSkeleton() {
  return (
    <div>
      <div className="grid gap-3 border-b border-slate-200 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_190px_150px]">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="border-b border-slate-200 px-4 py-3">
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="divide-y divide-slate-200">
        {Array.from({ length: 4 }).map((_, index) => (
          <article key={index} className="px-4 py-4">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-28" />
                </div>
                <SkeletonText lines={2} className="mt-4 max-w-3xl" />
                <div className="mt-3 flex gap-2">
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-6 w-24" />
                </div>
              </div>
              <div className="grid w-full grid-cols-3 gap-2 sm:w-auto sm:flex">
                <Skeleton className="h-9 w-full sm:w-20" />
                <Skeleton className="h-9 w-full sm:w-20" />
                <Skeleton className="h-9 w-full sm:w-24" />
              </div>
            </div>
            <SkeletonText lines={3} />
          </article>
        ))}
      </div>
    </div>
  );
}

function HistoryActions({
  item,
  onEdit,
  onDelete,
}: {
  item: RewriteResponse;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="mt-4 grid w-full grid-cols-2 gap-2 sm:flex sm:flex-wrap">
      <button
        type="button"
        onClick={() => downloadRewriteText(item)}
        className="inline-flex h-9 min-w-0 items-center justify-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-2 text-sm font-medium text-emerald-800 transition hover:bg-emerald-100 sm:px-3"
      >
        <FontAwesomeIcon icon={faFileLines} className="h-4 w-4" aria-hidden="true" />
        TXT
      </button>
      <button
        type="button"
        onClick={() => downloadRewritePdf(item)}
        className="inline-flex h-9 min-w-0 items-center justify-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-2 text-sm font-medium text-rose-700 transition hover:bg-rose-100 sm:px-3"
      >
        <FontAwesomeIcon icon={faFilePdf} className="h-4 w-4" aria-hidden="true" />
        PDF
      </button>
      <button
        type="button"
        onClick={onEdit}
        className="inline-flex h-9 min-w-0 items-center justify-center gap-2 rounded-md border border-slate-300 px-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 sm:px-3"
      >
        <FontAwesomeIcon icon={faPenToSquare} className="h-4 w-4" aria-hidden="true" />
        Edit
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="inline-flex h-9 min-w-0 items-center justify-center gap-2 rounded-md border border-slate-300 px-2 text-sm font-medium text-slate-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 sm:px-3"
      >
        <FontAwesomeIcon icon={faTrashCan} className="h-4 w-4" aria-hidden="true" />
        Delete
      </button>
    </div>
  );
}

function HistoryMeta({ item }: { item: RewriteResponse }) {
  const suggestionCount = getSuggestionCount(item);
  const score = item.evaluation?.scores["Submission readiness"];

  if (!item.avoidWords.length && !suggestionCount && score === undefined) {
    return null;
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium">
      {!!item.avoidWords.length && (
        <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-600">
          Avoided {item.avoidWords.length}
        </span>
      )}
      {!!suggestionCount && (
        <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-600">
          Datamuse {suggestionCount}
        </span>
      )}
      {score !== undefined && (
        <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-600">
          Score {score}
        </span>
      )}
    </div>
  );
}

function HistoryDetails({ item }: { item: RewriteResponse }) {
  const suggestions = Object.entries(item.vocabularySuggestions);
  const checklist = item.evaluation?.checklist ?? [];

  if (!item.avoidWords.length && !suggestions.length && !item.evaluation) {
    return null;
  }

  return (
    <div className="mt-4 grid gap-3 lg:grid-cols-3">
      {!!item.avoidWords.length && (
        <section className="overflow-hidden rounded-md border border-slate-200 bg-slate-50 px-3 py-3">
          <h3 className="text-sm font-semibold text-slate-900">Avoid words</h3>
          <p className="mt-2 break-words text-sm leading-6 text-slate-600">{item.avoidWords.join(", ")}</p>
        </section>
      )}

      {!!suggestions.length && (
        <section className="overflow-hidden rounded-md border border-slate-200 bg-slate-50 px-3 py-3">
          <h3 className="text-sm font-semibold text-slate-900">Datamuse suggestions</h3>
          <div className="mt-2 space-y-2">
            {suggestions.slice(0, 3).map(([word, values]) => (
              <p key={word} className="break-words text-sm leading-6 text-slate-600">
                <span className="font-medium text-slate-800">{word}:</span> {values.join(", ")}
              </p>
            ))}
          </div>
        </section>
      )}

      {item.evaluation && (
        <section className="overflow-hidden rounded-md border border-slate-200 bg-slate-50 px-3 py-3">
          <h3 className="text-sm font-semibold text-slate-900">Checklist</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">{item.evaluation.finalDecision}</p>
          {!!checklist.length && (
            <p className="mt-2 text-xs font-medium text-slate-500">
              {checklist.filter((check) => check.result.toLowerCase().includes("pass")).length} of{" "}
              {checklist.length} checks passed
            </p>
          )}
        </section>
      )}
    </div>
  );
}

function getSuggestionCount(item: RewriteResponse): number {
  return Object.keys(item.vocabularySuggestions).length;
}

function formatRewriteCount(count: number): string {
  return `${count.toLocaleString()} ${count === 1 ? "rewrite" : "rewrites"}`;
}
