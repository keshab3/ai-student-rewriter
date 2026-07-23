"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCheck,
  faChevronDown,
  faClipboard,
  faClockRotateLeft,
  faFileLines,
  faFilePdf,
  faListCheck,
  faPaste,
  faRotateRight,
  faSliders,
  faSpinner,
  faTrashCan,
  faTriangleExclamation,
  faUpload,
  faWandMagicSparkles,
  faWandSparkles,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  createRewrite,
  deleteRewrite,
  extractUploadedText,
  getRewriteStats,
  listUserPromptSettings,
  listRewriteModes,
  listRewrites,
  previewRewrite,
  REWRITE_MODES,
  RewriteEvaluationResponse,
  RewriteMode,
  RewriteModeOption,
  RewriteResponse,
  RewriteStatsResponse,
  SIMPLE_WRITING_MODES,
  STUDENT_LEVEL_MODES,
  updateUserPromptSetting,
  UpdateUserPromptSettingInput,
  UserPromptSetting,
} from "@/lib/api";
import { readUserToken, USER_AUTH_CHANGED_EVENT } from "@/lib/auth";
import {
  addGuestRewrite,
  deleteGuestRewrite,
  getGuestRewriteStats,
  readGuestRewrites,
} from "@/lib/guestRewrites";
import { Skeleton, SkeletonText } from "@/components/Skeleton";

const AVOID_WORDS_STORAGE_KEY = "ai-student-rewriter-avoid-words";
const USER_PROMPT_SETTINGS_STORAGE_KEY = "ai-student-rewriter-user-prompt-settings";
const DEFAULT_OUTPUT_INSTRUCTION =
  "Return only the rewritten student text. Do not add explanations, labels, markdown, quotes, score text, or checklist text.";

type RewriteTab = "SIMPLE" | "LEVELS";
type UserPromptSettingMap = Partial<Record<RewriteMode, UserPromptSetting>>;

export function RewriteWorkspace() {
  const [text, setText] = useState("");
  const [mode, setMode] = useState<RewriteMode>("GRAMMAR_FIX");
  const [activeTab, setActiveTab] = useState<RewriteTab>("SIMPLE");
  const [modes, setModes] = useState<RewriteModeOption[]>(REWRITE_MODES);
  const [avoidWordsText, setAvoidWordsText] = useState("");
  const [isAvoidWordsStorageReady, setIsAvoidWordsStorageReady] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(() =>
    typeof window === "undefined" ? null : readUserToken(),
  );
  const [result, setResult] = useState<RewriteResponse | null>(null);
  const [history, setHistory] = useState<RewriteResponse[]>([]);
  const [stats, setStats] = useState<RewriteStatsResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isImportingText, setIsImportingText] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isAvoidPopupOpen, setIsAvoidPopupOpen] = useState(false);
  const [isPromptPopupOpen, setIsPromptPopupOpen] = useState(false);
  const [isChecklistPopupOpen, setIsChecklistPopupOpen] = useState(false);
  const [isModeMenuOpen, setIsModeMenuOpen] = useState(false);
  const [isHistorySidebarOpen, setIsHistorySidebarOpen] = useState(false);
  const [hasUsedHistoryControl, setHasUsedHistoryControl] = useState(false);
  const [isSavingPromptSetting, setIsSavingPromptSetting] = useState(false);
  const [userPromptSettings, setUserPromptSettings] = useState<UserPromptSettingMap>({});
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<RewriteResponse | null>(null);
  const modeMenuRef = useRef<HTMLDivElement | null>(null);
  const textFileInputRef = useRef<HTMLInputElement | null>(null);
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const isLargeScreenRef = useRef(false);

  const avoidWords = useMemo(() => parseAvoidWords(avoidWordsText), [avoidWordsText]);
  const simpleModes = useMemo(() => modes.filter((item) => SIMPLE_WRITING_MODES.has(item.value)), [modes]);
  const levelModes = useMemo(() => modes.filter((item) => STUDENT_LEVEL_MODES.has(item.value)), [modes]);
  const visibleModes = activeTab === "SIMPLE" ? simpleModes : levelModes;
  const selectedMode = useMemo(
    () => modes.find((item) => item.value === mode) ?? visibleModes[0] ?? modes[0] ?? REWRITE_MODES[0],
    [mode, modes, visibleModes],
  );
  const currentPromptSetting = useMemo(
    () => userPromptSettings[mode] ?? createDefaultUserPromptSetting(selectedMode),
    [mode, selectedMode, userPromptSettings],
  );

  const wordCount = useMemo(() => countWords(text), [text]);
  const resultWordCount = useMemo(() => (result ? countWords(result.rewrittenText) : 0), [result]);
  const hasHistory = history.length > 0;
  const historyResultText = formatResultCount(stats?.totalRewrites ?? history.length);

  async function fetchHistoryData(token: string | null) {
    const modeOptions = await listRewriteModes();
    if (token) {
      const [historyItems, rewriteStats, promptSettings] = await Promise.all([
        listRewrites(token),
        getRewriteStats(token),
        listUserPromptSettings(token),
      ]);
      return [historyItems, rewriteStats, modeOptions, promptSettings] as const;
    }

    return [
      readGuestRewrites(),
      getGuestRewriteStats(),
      modeOptions,
      readGuestPromptSettings(modeOptions),
    ] as const;
  }

  async function refreshHistory() {
    setIsLoadingHistory(true);
    setError(null);
    try {
      const [historyItems, rewriteStats, modeOptions, promptSettings] = await fetchHistoryData(authToken);
      setHistory(historyItems);
      setStats(rewriteStats);
      setModes(modeOptions);
      setUserPromptSettings(toPromptSettingMap(promptSettings));
      if (!historyItems.length) {
        setIsHistorySidebarOpen(false);
      }
      syncModeWithTab(modeOptions, activeTab);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load rewrite history.");
    } finally {
      setIsLoadingHistory(false);
    }
  }

  function syncModeWithTab(modeOptions: RewriteModeOption[], tab: RewriteTab) {
    const group = tab === "SIMPLE"
      ? modeOptions.filter((item) => SIMPLE_WRITING_MODES.has(item.value))
      : modeOptions.filter((item) => STUDENT_LEVEL_MODES.has(item.value));
    setMode((currentMode) =>
      group.length && !group.some((item) => item.value === currentMode)
        ? group[0].value
        : currentMode,
    );
  }

  function switchTab(tab: RewriteTab) {
    setActiveTab(tab);
    setIsModeMenuOpen(false);
    const group = tab === "SIMPLE" ? simpleModes : levelModes;
    if (group.length && !group.some((item) => item.value === mode)) {
      setMode(group[0].value);
    }
  }

  useEffect(() => {
    const largeScreenQuery = window.matchMedia("(min-width: 1024px)");
    isLargeScreenRef.current = largeScreenQuery.matches;

    function handleScreenChange(event: MediaQueryListEvent) {
      isLargeScreenRef.current = event.matches;
      if (!event.matches) {
        setIsHistorySidebarOpen(false);
      }
    }

    largeScreenQuery.addEventListener("change", handleScreenChange);

    return () => {
      largeScreenQuery.removeEventListener("change", handleScreenChange);
    };
  }, []);

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
    function handlePointerDown(event: MouseEvent) {
      if (!modeMenuRef.current?.contains(event.target as Node)) {
        setIsModeMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setAvoidWordsText(window.localStorage.getItem(AVOID_WORDS_STORAGE_KEY) ?? "");
      setIsAvoidWordsStorageReady(true);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (!isAvoidWordsStorageReady) return;
    window.localStorage.setItem(AVOID_WORDS_STORAGE_KEY, avoidWordsText);
  }, [avoidWordsText, isAvoidWordsStorageReady]);

  useEffect(() => {
    let isActive = true;

    async function loadInitialHistory() {
      try {
        const [historyItems, rewriteStats, modeOptions, promptSettings] = await fetchHistoryData(authToken);
        if (!isActive) return;
        setHistory(historyItems);
        setStats(rewriteStats);
        setModes(modeOptions);
        setUserPromptSettings(toPromptSettingMap(promptSettings));
        if (!historyItems.length) {
          setIsHistorySidebarOpen(false);
        }
        syncModeWithTab(modeOptions, activeTab);
      } catch (loadError) {
        if (!isActive) return;
        setError(loadError instanceof Error ? loadError.message : "Could not load rewrite history.");
      } finally {
        if (isActive) {
          setIsLoadingHistory(false);
        }
      }
    }

    void loadInitialHistory();

    return () => {
      isActive = false;
    };
  }, [authToken, activeTab]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = text.trim();
    if (!trimmed) {
      setError("Enter text before rewriting.");
      return;
    }

    if (!visibleModes.length) {
      setError("No rewrite modes are enabled for this tab.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setCopied(false);

    try {
      const input = {
        text: trimmed,
        mode,
        avoidWords,
        promptInstruction: currentPromptSetting.promptInstruction,
        outputInstruction: currentPromptSetting.outputInstruction,
      };
      const rewrite = authToken
        ? await createRewrite(input, authToken)
        : addGuestRewrite(await previewRewrite(input));
      setResult(rewrite);
      setHistory((current) => [rewrite, ...current]);
      setStats((current) => ({
        totalRewrites: (current?.totalRewrites ?? history.length) + 1,
        recentRewrites: [rewrite, ...(current?.recentRewrites ?? [])].slice(0, 5),
      }));
      if (!hasUsedHistoryControl && isLargeScreenRef.current) {
        setIsHistorySidebarOpen(true);
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Rewrite request failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCopy() {
    if (!result) return;
    await navigator.clipboard.writeText(result.rewrittenText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function handleDownloadTxt() {
    if (!result) return;
    downloadRewriteText(result);
  }

  function handleDownloadPdf() {
    if (!result) return;
    downloadRewritePdf(result);
  }

  function handleClearWorkspace() {
    setText("");
    setResult(null);
    setIsChecklistPopupOpen(false);
    setError(null);
  }

  async function handlePasteFromClipboard() {
    if (!navigator.clipboard?.readText) {
      setError("Paste is blocked in this browser. Use Ctrl+V inside the text box.");
      return;
    }

    setError(null);
    try {
      const clipboardText = await navigator.clipboard.readText();
      const cleanText = clipboardText.trim();
      if (!cleanText) {
        setError("Clipboard has no text to paste.");
        return;
      }

      setText((current) => current.trim() ? `${current.trimEnd()}\n${cleanText}` : cleanText);
      setResult(null);
      setIsChecklistPopupOpen(false);
    } catch {
      setError("Paste permission was blocked. Use Ctrl+V inside the text box.");
    }
  }

  async function handleTextFileUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImportingText(true);
    setError(null);
    try {
      const uploaded = await extractUploadedText(file);
      setText(uploaded.text);
      setResult(null);
      setIsChecklistPopupOpen(false);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Could not upload this file.");
    } finally {
      setIsImportingText(false);
      event.target.value = "";
    }
  }

  async function handleSavePromptSetting(input: UpdateUserPromptSettingInput) {
    if (!input.promptInstruction.trim() || !input.outputInstruction.trim()) {
      setError("Prompt instruction and output instruction are required.");
      return;
    }

    setIsSavingPromptSetting(true);
    setError(null);
    try {
      const saved = authToken
        ? await updateUserPromptSetting(authToken, mode, input)
        : saveGuestPromptSetting(selectedMode, input);
      setUserPromptSettings((current) => ({
        ...current,
        [saved.mode]: saved,
      }));
      setIsPromptPopupOpen(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save prompt setting.");
    } finally {
      setIsSavingPromptSetting(false);
    }
  }

  async function handleDelete(id: number) {
    setError(null);
    try {
      if (authToken) {
        await deleteRewrite(id, authToken);
      } else {
        deleteGuestRewrite(id);
      }
      const remainingHistory = history.filter((item) => item.id !== id);
      setHistory(remainingHistory);
      if (!remainingHistory.length) {
        setIsHistorySidebarOpen(false);
      }
      setStats((current) =>
        current
          ? {
              totalRewrites: Math.max(0, current.totalRewrites - 1),
              recentRewrites: current.recentRewrites.filter((item) => item.id !== id),
            }
          : current,
      );
      if (result?.id === id) {
        setResult(null);
        setIsChecklistPopupOpen(false);
      }
      if (selectedHistoryItem?.id === id) {
        setSelectedHistoryItem(null);
      }
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete this rewrite.");
    }
  }

  return (
    <main className="page-shell">
      {/* header section */}
      <div className="mb-4 rounded-md border border-slate-200 bg-white px-3 py-3 shadow-sm sm:mb-5 sm:px-5 sm:py-4">
        <div>
          <p className="text-xs font-semibold uppercase text-emerald-700">Student writing tool</p>
          <h1 className="mt-1 text-xl font-semibold text-slate-950 sm:text-2xl">Rewrite your text</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">{selectedMode.description}</p>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid w-full grid-cols-2 gap-1 rounded-md border border-slate-200 bg-slate-100 p-1 sm:w-auto">
          <TabButton active={activeTab === "SIMPLE"} onClick={() => switchTab("SIMPLE")}>
            Simple writing
          </TabButton>
          <TabButton active={activeTab === "LEVELS"} onClick={() => switchTab("LEVELS")}>
            Student levels
          </TabButton>
        </div>
        {hasHistory && (
          <button
            type="button"
            onClick={() => {
              setHasUsedHistoryControl(true);
              setIsHistorySidebarOpen((current) => !current);
            }}
            aria-pressed={isHistorySidebarOpen}
            className="history-toggle inline-flex h-8 w-fit items-center justify-center gap-1.5 self-end rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:-translate-y-px hover:border-emerald-200 hover:text-emerald-800 hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-100 sm:self-auto"
          >
            <FontAwesomeIcon icon={faClockRotateLeft} className="h-3.5 w-3.5" aria-hidden="true" />
            {isHistorySidebarOpen ? "Hide history" : "View history"}
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
              {historyResultText}
            </span>
          </button>
        )}
      </div>

      <div className={`workspace-grid grid gap-5 ${hasHistory && isHistorySidebarOpen ? "lg:grid-cols-[minmax(0,1fr)_310px]" : "lg:grid-cols-1"}`}>
        <section className="min-w-0 overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
          <form onSubmit={handleSubmit}>
            <div className="border-b border-slate-200 bg-slate-50/80 px-3 py-2">
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-[minmax(230px,1.1fr)_minmax(128px,0.7fr)_minmax(128px,0.7fr)_96px] lg:items-end">
                <div ref={modeMenuRef} className="relative col-span-2 min-w-0 lg:col-span-1">
                  <label htmlFor="rewrite-mode-button" className="mb-1 block text-[11px] font-semibold leading-4 text-slate-600">
                    Rewrite type
                  </label>
                  <button
                    id="rewrite-mode-button"
                    type="button"
                    onClick={() => setIsModeMenuOpen((current) => !current)}
                    aria-haspopup="listbox"
                    aria-expanded={isModeMenuOpen}
                    className="flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-2.5 text-left text-xs font-semibold text-slate-950 shadow-sm transition hover:border-emerald-200 hover:bg-white hover:shadow-md focus-visible:border-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-100"
                  >
                    <span className="truncate">{selectedMode.label}</span>
                    <FontAwesomeIcon
                      icon={faChevronDown}
                      className={`h-3 w-3 shrink-0 text-slate-500 transition ${isModeMenuOpen ? "rotate-180 text-emerald-700" : ""}`}
                      aria-hidden="true"
                    />
                  </button>
                  {isModeMenuOpen && (
                    <div
                      role="listbox"
                      aria-labelledby="rewrite-mode-button"
                      className="absolute left-0 top-[calc(100%+0.3rem)] z-30 max-h-64 w-full overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-[0_18px_45px_rgba(15,23,42,0.18)]"
                    >
                      {visibleModes.map((item) => {
                        const isSelected = item.value === mode;
                        return (
                          <button
                            key={item.value}
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            onClick={() => {
                              setMode(item.value);
                              setIsModeMenuOpen(false);
                            }}
                            className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-semibold transition ${
                              isSelected
                                ? "bg-emerald-50 text-emerald-800"
                                : "text-slate-700 hover:bg-slate-50 hover:text-slate-950"
                            }`}
                          >
                            <span className="truncate">{item.label}</span>
                            {isSelected && <FontAwesomeIcon icon={faCheck} className="h-3 w-3 shrink-0" aria-hidden="true" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setIsPromptPopupOpen(true)}
                  className="group flex h-9 min-w-0 items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-2.5 text-left shadow-sm transition hover:border-emerald-200 hover:bg-white hover:shadow-md focus-visible:border-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-100"
                >
                  <span className="min-w-0 truncate text-xs font-semibold text-slate-950">
                    My prompt
                    <span className="font-medium text-slate-500">
                      {" "}· {currentPromptSetting.customized ? "Saved" : "Default"}
                    </span>
                  </span>
                  <FontAwesomeIcon icon={faWandMagicSparkles} className="h-3.5 w-3.5 shrink-0 text-slate-500 transition group-hover:text-emerald-700" aria-hidden="true" />
                </button>

                <button
                  type="button"
                  onClick={() => setIsAvoidPopupOpen(true)}
                  className="group flex h-9 min-w-0 items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-2.5 text-left shadow-sm transition hover:border-emerald-200 hover:bg-white hover:shadow-md focus-visible:border-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-100"
                >
                  <span className="min-w-0 truncate text-xs font-semibold text-slate-950">
                    Avoid
                    <span className="font-medium text-slate-500">
                      {" "}· {avoidWords.length}
                    </span>
                  </span>
                  <FontAwesomeIcon icon={faSliders} className="h-3.5 w-3.5 shrink-0 text-slate-500 transition group-hover:text-emerald-700" aria-hidden="true" />
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="col-span-2 inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-emerald-700 px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-70 lg:col-span-1"
                >
                  {isSubmitting ? (
                    <>
                      Rewriting
                      <FontAwesomeIcon icon={faSpinner} className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    </>
                  ) : (
                    <>
                      Rewrite
                      <FontAwesomeIcon icon={faWandMagicSparkles} className="h-3.5 w-3.5" aria-hidden="true" />
                    </>
                  )}
                </button>
              </div>
              <div className="mt-1 flex justify-end">
                <button
                  type="button"
                  onClick={handleClearWorkspace}
                  className="text-[11px] font-semibold leading-4 text-slate-500 transition hover:-translate-y-px hover:text-slate-950"
                >
                  Clear text
                </button>
              </div>
            </div>

            <div className="grid items-stretch gap-0 lg:grid-cols-2">
              <div className="flex flex-col border-b border-slate-200 lg:border-r lg:border-b-0">
                <div className="flex h-12 items-center justify-between border-b border-slate-200 bg-slate-50/80 px-3 sm:h-14 sm:px-4">
                  <label htmlFor="student-text" className="text-sm font-semibold text-slate-900">
                    Original
                  </label>
                  <span className="text-xs text-slate-500">{wordCount.toLocaleString()} words</span>
                </div>
                <div
                  className="relative h-[260px] bg-white sm:h-[340px] lg:h-[430px]"
                  onClick={() => textAreaRef.current?.focus()}
                >
                  <textarea
                    ref={textAreaRef}
                    id="student-text"
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    className="h-full w-full resize-none overflow-y-auto bg-white px-3 py-3 text-sm leading-7 text-slate-900 outline-none placeholder:text-slate-400 sm:px-4 sm:py-4"
                    placeholder="Click here and start writing."
                  />
                  {!text.trim() && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4 py-6">
                      <div className="pointer-events-auto flex flex-wrap justify-center gap-2 text-center">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void handlePasteFromClipboard();
                          }}
                          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-500 hover:bg-slate-50 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                        >
                          Paste
                          <FontAwesomeIcon icon={faPaste} className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            textFileInputRef.current?.click();
                          }}
                          disabled={isImportingText}
                          className="group relative inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-950 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                        >
                          <span className="pointer-events-none absolute bottom-[calc(100%+0.45rem)] left-1/2 z-10 w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-md border border-slate-200 bg-white px-2 py-1 text-center text-[10px] font-medium leading-4 text-slate-600 opacity-0 shadow-sm transition group-hover:opacity-100 group-focus-visible:opacity-100 sm:max-w-[13rem]">
                            Supported: .txt, .docx, .pdf, .md
                          </span>
                          {isImportingText ? "Reading" : "Upload"}
                          {isImportingText ? (
                            <FontAwesomeIcon icon={faSpinner} className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                          ) : (
                            <FontAwesomeIcon icon={faUpload} className="h-3.5 w-3.5" aria-hidden="true" />
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                  <input
                    ref={textFileInputRef}
                    type="file"
                    accept=".txt,.docx,.pdf,.md,.markdown,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={handleTextFileUpload}
                    className="sr-only"
                    aria-label="Upload text file"
                  />
                </div>
              </div>

              <div className="flex flex-col">
                <div className="flex h-12 items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/80 px-3 sm:h-14 sm:gap-3 sm:px-4">
                  <h2 className="shrink-0 text-sm font-semibold text-slate-900">Result</h2>
                  {result && (
                    <span className="ml-auto whitespace-nowrap text-xs text-slate-500">
                      {resultWordCount.toLocaleString()} words
                    </span>
                  )}
                  <div className="flex shrink-0 gap-1 sm:gap-1.5">
                    <button
                      type="button"
                      onClick={() => setIsChecklistPopupOpen(true)}
                      disabled={!result?.evaluation}
                      className="inline-flex h-7 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-slate-300 bg-white px-2 text-[11px] font-semibold text-slate-700 shadow-sm transition hover:border-emerald-200 hover:bg-white hover:shadow disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <FontAwesomeIcon icon={faListCheck} className="h-3 w-3" aria-hidden="true" />
                      Check
                    </button>
                    <button
                      type="button"
                      onClick={handleCopy}
                      disabled={!result}
                      className="inline-flex h-7 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-slate-300 bg-white px-2 text-[11px] font-semibold text-slate-700 shadow-sm transition hover:border-emerald-200 hover:bg-white hover:shadow disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {copied ? (
                        <FontAwesomeIcon icon={faCheck} className="h-3 w-3" aria-hidden="true" />
                      ) : (
                        <FontAwesomeIcon icon={faClipboard} className="h-3 w-3" aria-hidden="true" />
                      )}
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>
                <div className="workspace-result-box flex h-[260px] flex-col px-3 py-3 sm:h-[340px] sm:px-4 sm:py-4 lg:h-[430px]">
                  <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                    {isSubmitting ? (
                      <ProgressPanel />
                    ) : result ? (
                      <div className="space-y-3">
                        <p className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-950">
                          {highlightRewrittenText(result.originalText, result.rewrittenText)}
                        </p>
                        {result.matchedAvoidWords.length > 0 && (
                          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                            Avoided terms still found: {result.matchedAvoidWords.join(", ")}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex h-full min-h-[220px] items-center justify-center text-center text-sm text-slate-500 sm:min-h-[300px]">
                        Your result will appear here.
                      </div>
                    )}
                  </div>
                  <div className="mt-3 flex shrink-0 items-center justify-between gap-2 border-t border-slate-100 pt-3">
                    <p className="min-w-0 flex-1 truncate text-[10px] font-medium text-slate-500 sm:text-[11px]">
                      {result ? `${result.modeLabel} - ${formatDate(result.createdAt)}` : "Output details"}
                    </p>
                    <div className="flex shrink-0 justify-end gap-1 sm:gap-1.5">
                      <button
                        type="button"
                        onClick={handleDownloadTxt}
                        disabled={!result}
                        title="Download rewritten text as TXT"
                        className="inline-flex h-7 items-center justify-center gap-1 whitespace-nowrap rounded-md border border-emerald-200 bg-emerald-50 px-1.5 text-[11px] font-semibold text-emerald-800 shadow-sm transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-45 sm:gap-1.5 sm:px-2"
                      >
                        <FontAwesomeIcon icon={faFileLines} className="h-3 w-3" aria-hidden="true" />
                        Text
                      </button>
                      <button
                        type="button"
                        onClick={handleDownloadPdf}
                        disabled={!result}
                        title="Download rewritten text as PDF"
                        className="inline-flex h-7 items-center justify-center gap-1 whitespace-nowrap rounded-md border border-rose-200 bg-rose-50 px-1.5 text-[11px] font-semibold text-rose-700 shadow-sm transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-45 sm:gap-1.5 sm:px-2"
                      >
                        <FontAwesomeIcon icon={faFilePdf} className="h-3 w-3" aria-hidden="true" />
                        PDF
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {(error || result) && (
              <div className="border-t border-slate-200 bg-slate-50/70 px-4 py-4">
                {error && (
                  <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                    <FontAwesomeIcon icon={faTriangleExclamation} className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{error}</span>
                  </div>
                )}

                {result && (
                  <div className={error ? "mt-4" : ""}>
                    <VocabularyPanel result={result} />
                  </div>
                )}
              </div>
            )}
          </form>
        </section>

        {hasHistory && isHistorySidebarOpen && (
          <aside className="workspace-history-aside min-w-0 space-y-5">
            <HistoryPanel
              history={history}
              isLoading={isLoadingHistory}
              resultCountText={historyResultText}
              onRefresh={refreshHistory}
              onDelete={handleDelete}
              onOpen={setSelectedHistoryItem}
            />
          </aside>
        )}
      </div>
      {/* popup for avoid words */}
      {isAvoidPopupOpen && (
        <AvoidWordsModal
          value={avoidWordsText}
          onClose={() => setIsAvoidPopupOpen(false)}
          onSave={(nextValue) => {
            setAvoidWordsText(nextValue);
            setIsAvoidPopupOpen(false);
          }}
        />
      )}
      {isPromptPopupOpen && (
        <UserPromptSettingModal
          setting={currentPromptSetting}
          isSaving={isSavingPromptSetting}
          onClose={() => setIsPromptPopupOpen(false)}
          onSave={(input) => void handleSavePromptSetting(input)}
        />
      )}
      {/* history popup */}
      {selectedHistoryItem && (
        <HistoryDetailModal
          item={selectedHistoryItem}
          onClose={() => setSelectedHistoryItem(null)}
          onDelete={(id) => void handleDelete(id)}
        />
      )}
      {isChecklistPopupOpen && result?.evaluation && (
        <ChecklistModal
          evaluation={result.evaluation}
          onClose={() => setIsChecklistPopupOpen(false)}
        />
      )}
    </main>
  );
}

function TabButton({ active, children, onClick }: { active: boolean; children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-9 whitespace-nowrap rounded-md px-3 text-xs font-semibold transition sm:h-10 sm:px-4 sm:text-sm ${
        active ? "bg-white text-slate-950 shadow-sm" : "text-slate-600 hover:bg-white/70 hover:text-slate-950"
      }`}
    >
      {children}
    </button>
  );
}

function ProgressPanel() {
  return (
    <div className="flex min-h-[240px] flex-col justify-center sm:min-h-[320px]">
      <div className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
        <FontAwesomeIcon icon={faSpinner} className="h-4 w-4 animate-spin" aria-hidden="true" />
        Rewriting your text
      </div>
      <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full w-2/3 animate-pulse rounded-full bg-emerald-700" />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs text-slate-500">
        <span className="rounded-md bg-emerald-50 px-2 py-2 font-semibold text-emerald-800">Rewrite</span>
        <span className="rounded-md bg-slate-100 px-2 py-2">Verify</span>
        <span className="rounded-md bg-slate-100 px-2 py-2">Evaluate</span>
      </div>
    </div>
  );
}

function HistoryPanel({
  history,
  isLoading,
  resultCountText,
  onRefresh,
  onDelete,
  onOpen,
}: {
  history: RewriteResponse[];
  isLoading: boolean;
  resultCountText: string;
  onRefresh: () => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onOpen: (item: RewriteResponse) => void;
}) {
  return (
    <section className="workspace-history-panel overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-4 py-3">
        <div className="flex items-center gap-2">
          <FontAwesomeIcon icon={faClockRotateLeft} className="h-4 w-4 text-emerald-700" aria-hidden="true" />
          <h2 className="font-medium text-slate-950">Recent history</h2>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="whitespace-nowrap text-[11px] font-semibold text-slate-500">{resultCountText}</span>
          <button
            type="button"
            onClick={() => void onRefresh()}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50"
            title="Refresh history"
            aria-label="Refresh history"
          >
            <FontAwesomeIcon icon={faRotateRight} className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="max-h-[280px] divide-y divide-slate-200 overflow-y-auto sm:max-h-[360px] lg:max-h-[430px]">
        {isLoading ? (
          <HistoryPanelSkeleton />
        ) : history.length ? (
          history.map((item) => (
            <article key={item.id} className="px-3 py-3">
              <div className="mb-2 flex items-start justify-between gap-3">
                <button
                  type="button"
                  onClick={() => onOpen(item)}
                  className="min-w-0 flex-1 rounded-md px-1 text-left transition hover:text-emerald-800"
                >
                  <p className="truncate text-sm font-medium text-slate-900">{item.modeLabel}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{formatDate(item.createdAt)}</p>
                </button>
                <button
                  type="button"
                  onClick={() => void onDelete(item.id)}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-red-50 hover:text-red-700"
                  title="Delete rewrite"
                  aria-label="Delete rewrite"
                >
                  <FontAwesomeIcon icon={faTrashCan} className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => onOpen(item)}
                className="block w-full rounded-md px-1 py-1 text-left transition hover:bg-slate-50"
              >
                <p className="line-clamp-3 text-sm leading-6 text-slate-600">{item.rewrittenText}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {!!item.avoidWords.length && (
                    <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-500">
                      Avoid {item.avoidWords.length}
                    </span>
                  )}
                  {getVocabularyCount(item) > 0 && (
                    <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-500">
                      Vocab {getVocabularyCount(item)}
                    </span>
                  )}
                </div>
              </button>
            </article>
          ))
        ) : (
          <div className="flex h-40 items-center justify-center px-4 text-center text-sm text-slate-500">
            No history yet.
          </div>
        )}
      </div>
    </section>
  );
}

function HistoryPanelSkeleton() {
  return (
    <div className="divide-y divide-slate-200">
      {Array.from({ length: 3 }).map((_, index) => (
        <article key={index} className="px-3 py-3">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="mt-2 h-3 w-24" />
            </div>
            <Skeleton className="h-8 w-8 shrink-0" />
          </div>
          <SkeletonText lines={3} />
          <div className="mt-3 flex gap-2">
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-6 w-16" />
          </div>
        </article>
      ))}
    </div>
  );
}

function VocabularyPanel({ result }: { result: RewriteResponse }) {
  const suggestions = Object.entries(result.vocabularySuggestions ?? {});
  const totalSuggestions = suggestions.reduce((total, [, values]) => total + values.length, 0);

  return (
    <section className="overflow-hidden rounded-md border border-emerald-100 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b border-emerald-100 bg-emerald-50/60 px-3 py-3 sm:px-4">
        <div className="flex items-center gap-2">
          <FontAwesomeIcon icon={faWandSparkles} className="h-4 w-4 text-emerald-600" aria-hidden="true" />
          <h2 className="font-medium text-slate-950">Datamuse vocabulary</h2>
        </div>
        {totalSuggestions > 0 && (
          <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
            {totalSuggestions}
          </span>
        )}
      </div>
      <div className="px-3 py-3 sm:px-4 sm:py-4">
        {suggestions.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {suggestions.map(([word, values]) => (
              <div key={word} className="rounded-md border border-slate-200 bg-white px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="min-w-0 truncate text-sm font-semibold text-slate-900">{word}</p>
                  <span className="shrink-0 text-xs text-slate-500">{values.length} words</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {values.map((value) => (
                    <span
                      key={`${word}-${value}`}
                      className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700"
                    >
                      {value}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-md border border-dashed border-slate-300 bg-white px-3 py-3 text-sm leading-6 text-slate-500">
            No vocabulary suggestions found for this rewrite.
          </p>
        )}
      </div>
    </section>
  );
}

function EvaluationPanel({ evaluation }: { evaluation: RewriteEvaluationResponse | null }) {
  if (!evaluation) {
    return (
    <section className="overflow-hidden rounded-md border border-slate-200 bg-white">
      <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50/80 px-4 py-3">
          <FontAwesomeIcon icon={faListCheck} className="h-4 w-4 text-slate-500" aria-hidden="true" />
          <h2 className="font-medium text-slate-950">Checklist</h2>
        </div>
        <p className="px-4 py-4 text-sm leading-6 text-slate-500">
          Checklist and score will appear after rewriting.
        </p>
      </section>
    );
  }

  const finalScore = evaluation.scores["Submission readiness"] ?? 0;
  const passedCount = evaluation.checklist.filter((item) => isChecklistPass(item.result)).length;

  return (
    <section className="overflow-hidden rounded-md border border-slate-200 bg-white">
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-slate-50/80 px-4 py-3">
        <div className="flex items-center gap-2">
          <FontAwesomeIcon icon={faListCheck} className="h-4 w-4 text-slate-500" aria-hidden="true" />
          <h2 className="font-medium text-slate-950">Checklist</h2>
        </div>
        <span className="rounded-md bg-slate-900 px-2 py-1 text-xs font-semibold text-white">
          {passedCount}/{evaluation.checklist.length}
        </span>
      </div>
      <div className="max-h-[520px] overflow-y-auto px-4 py-4">
        <div className="mb-4 grid gap-3 sm:grid-cols-[72px_minmax(0,1fr)]">
          <div className="flex h-[72px] w-[72px] items-center justify-center rounded-md border border-emerald-100 bg-emerald-50">
            <span className="text-2xl font-semibold text-slate-950">{finalScore}</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">{evaluation.finalDecision}</p>
            <p className="mt-1 text-sm leading-6 text-slate-600">{evaluation.notes}</p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-emerald-700"
                style={{ width: `${Math.min(100, Math.max(0, finalScore))}%` }}
              />
            </div>
          </div>
        </div>
        <div className="grid gap-2">
          {evaluation.checklist.map((item) => {
            const percent = getChecklistPercent(item.result);
            const resultText = getChecklistResultText(item.result);

            return (
              <div key={item.no} className="rounded-md border border-slate-200 bg-white px-3 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2">
                    {isChecklistPass(item.result) ? (
                      <FontAwesomeIcon icon={faCheck} className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
                    ) : (
                      <FontAwesomeIcon icon={faTriangleExclamation} className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{item.check}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{resultText}</p>
                    </div>
                  </div>
                  {percent && (
                    <span className="mt-0.5 shrink-0 rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                      {percent}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ChecklistModal({
  evaluation,
  onClose,
}: {
  evaluation: RewriteEvaluationResponse;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 px-3 py-3 backdrop-blur-sm sm:items-center sm:px-4 sm:py-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="checklist-popup-title"
        className="max-h-[calc(100dvh-24px)] w-full max-w-2xl overflow-hidden rounded-md bg-white shadow-[0_24px_80px_rgba(15,23,42,0.28)] sm:max-h-[calc(100dvh-48px)]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50/80 px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <h2 id="checklist-popup-title" className="text-lg font-semibold text-slate-950">
              Checklist
            </h2>
            <p className="mt-1 text-sm text-slate-600">Review score before saving or copying.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            aria-label="Close checklist"
          >
            <FontAwesomeIcon icon={faXmark} className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="max-h-[calc(100dvh-140px)] overflow-y-auto px-4 py-4 sm:max-h-[72vh] sm:px-5">
          <EvaluationPanel evaluation={evaluation} />
        </div>
      </section>
    </div>
  );
}

function UserPromptSettingModal({
  setting,
  isSaving,
  onClose,
  onSave,
}: {
  setting: UserPromptSetting;
  isSaving: boolean;
  onClose: () => void;
  onSave: (input: UpdateUserPromptSettingInput) => void;
}) {
  const [promptInstruction, setPromptInstruction] = useState(setting.promptInstruction);
  const [outputInstruction, setOutputInstruction] = useState(setting.outputInstruction);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 px-3 py-3 backdrop-blur-sm sm:items-center sm:px-4 sm:py-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-prompt-title"
        className="max-h-[calc(100dvh-24px)] w-full max-w-2xl overflow-hidden rounded-md bg-white shadow-[0_24px_80px_rgba(15,23,42,0.28)] sm:max-h-[calc(100dvh-48px)]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50/80 px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-emerald-700">{setting.mode}</p>
            <h2 id="user-prompt-title" className="mt-1 text-lg font-semibold text-slate-950">
              My prompt setting
            </h2>
            <p className="mt-1 text-sm text-slate-600">{setting.label}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            aria-label="Close prompt setting"
          >
            <FontAwesomeIcon icon={faXmark} className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="max-h-[calc(100dvh-210px)] space-y-4 overflow-y-auto px-4 py-4 sm:max-h-[70vh] sm:px-5">
          <div>
            <label htmlFor="user-prompt-instruction" className="text-sm font-semibold text-slate-900">
              Prompt instruction
            </label>
            <textarea
              id="user-prompt-instruction"
              value={promptInstruction}
              onChange={(event) => setPromptInstruction(event.target.value)}
              rows={7}
              className="mt-2 w-full resize-y rounded-md border border-slate-300 px-3 py-3 font-mono text-sm leading-6 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          <div>
            <label htmlFor="user-output-instruction" className="text-sm font-semibold text-slate-900">
              Output instruction
            </label>
            <textarea
              id="user-output-instruction"
              value={outputInstruction}
              onChange={(event) => setOutputInstruction(event.target.value)}
              rows={4}
              className="mt-2 w-full resize-y rounded-md border border-slate-300 px-3 py-3 font-mono text-sm leading-6 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            />
            <p className="mt-1 text-xs text-slate-500">
              Default: {setting.defaultOutputInstruction}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <button
            type="button"
            onClick={() => {
              setPromptInstruction(setting.defaultPromptInstruction);
              setOutputInstruction(setting.defaultOutputInstruction);
            }}
            className="inline-flex h-10 w-full items-center justify-center rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 sm:w-auto"
          >
            Use default
          </button>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="inline-flex h-10 w-full items-center justify-center rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 sm:w-auto"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() =>
                onSave({
                  promptInstruction,
                  outputInstruction,
                })
              }
              disabled={isSaving}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-70 sm:w-auto"
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
      </section>
    </div>
  );
}

function AvoidWordsModal({
  value,
  onClose,
  onSave,
}: {
  value: string;
  onClose: () => void;
  onSave: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const words = useMemo(() => parseAvoidWords(draft), [draft]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 px-3 py-3 backdrop-blur-sm sm:items-center sm:px-4 sm:py-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="avoid-words-title"
        className="max-h-[calc(100dvh-24px)] w-full max-w-xl overflow-hidden rounded-md bg-white shadow-[0_24px_80px_rgba(15,23,42,0.28)] sm:max-h-[calc(100dvh-48px)]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50/80 px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <h2 id="avoid-words-title" className="text-lg font-semibold text-slate-950">
              Avoid words
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Add words or phrases with commas or new lines.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            aria-label="Close avoid words"
          >
            <FontAwesomeIcon icon={faXmark} className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="max-h-[calc(100dvh-220px)] overflow-y-auto px-4 py-4 sm:max-h-none sm:px-5">
          <label htmlFor="avoid-words-popup" className="text-sm font-medium text-slate-900">
            Words or phrases
          </label>
          <textarea
            id="avoid-words-popup"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={8}
            className="mt-2 w-full resize-y rounded-md border border-slate-300 px-3 py-3 text-sm leading-6 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            placeholder="very important, AI-generated&#10;in conclusion"
            autoFocus
          />
          <div className="mt-3 flex flex-col gap-1 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <span>{words.length}/30 blocked</span>
            <span>Each item uses the first 120 characters.</span>
          </div>

          {words.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {words.map((word) => (
                <span key={word} className="rounded-md bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-700">
                  {word}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-md bg-slate-50 px-3 py-3 text-sm text-slate-500">
              No avoid words added.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2 border-t border-slate-200 px-4 py-4 sm:flex-row sm:justify-between sm:px-5">
          <button
            type="button"
            onClick={() => setDraft("")}
            className="inline-flex h-10 w-full items-center justify-center rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 sm:w-auto"
          >
            Clear all
          </button>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-full items-center justify-center rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 sm:w-auto"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onSave(words.join("\n"))}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 sm:w-auto"
            >
              <FontAwesomeIcon icon={faCheck} className="h-4 w-4" aria-hidden="true" />
              Save
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function HistoryDetailModal({
  item,
  onClose,
  onDelete,
}: {
  item: RewriteResponse;
  onClose: () => void;
  onDelete: (id: number) => void;
}) {
  const suggestions = Object.entries(item.vocabularySuggestions);
  const finalScore = item.evaluation?.scores["Submission readiness"];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 px-3 py-3 backdrop-blur-sm sm:items-center sm:px-4 sm:py-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="history-detail-title"
        className="flex max-h-[calc(100dvh-24px)] w-full max-w-4xl flex-col overflow-hidden rounded-md bg-white shadow-[0_24px_80px_rgba(15,23,42,0.28)] sm:max-h-[calc(100dvh-48px)]"
      >
        <div className="shrink-0 flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50/80 px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">History detail</p>
            <h2 id="history-detail-title" className="mt-1 truncate text-lg font-semibold text-slate-950">
              {item.modeLabel}
            </h2>
            <p className="mt-1 text-sm text-slate-500">{formatDate(item.createdAt)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            aria-label="Close history detail"
          >
            <FontAwesomeIcon icon={faXmark} className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-md border border-slate-200 bg-slate-50 px-4 py-4">
              <h3 className="text-sm font-semibold text-slate-900">Original</h3>
              <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{item.originalText}</p>
            </section>
            <section className="rounded-md border border-slate-200 bg-white px-4 py-4">
              <h3 className="text-sm font-semibold text-slate-900">Rewrite</h3>
              <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-950">{item.rewrittenText}</p>
            </section>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <section className="rounded-md border border-slate-200 px-4 py-4">
              <h3 className="text-sm font-semibold text-slate-900">Avoid words</h3>
              {item.avoidWords.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.avoidWords.map((word) => (
                    <span key={word} className="rounded-md bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-700">
                      {word}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm leading-6 text-slate-500">No avoid words were used.</p>
              )}
            </section>

            <section className="rounded-md border border-slate-200 px-4 py-4">
              <h3 className="text-sm font-semibold text-slate-900">Datamuse</h3>
              {suggestions.length ? (
                <div className="mt-3 space-y-3">
                  {suggestions.slice(0, 4).map(([word, values]) => (
                    <div key={word}>
                      <p className="text-xs font-semibold uppercase text-slate-500">{word}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-700">{values.join(", ")}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm leading-6 text-slate-500">No vocabulary suggestions saved.</p>
              )}
            </section>

            <section className="rounded-md border border-slate-200 px-4 py-4">
              <h3 className="text-sm font-semibold text-slate-900">Checklist</h3>
              {item.evaluation ? (
                <>
                  <p className="mt-3 text-2xl font-semibold text-slate-950">{finalScore ?? 0}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{item.evaluation.finalDecision}</p>
                </>
              ) : (
                <p className="mt-3 text-sm leading-6 text-slate-500">No checklist saved.</p>
              )}
            </section>
          </div>
        </div>

        <div className="shrink-0 flex flex-col gap-2 border-t border-slate-200 bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <button
            type="button"
            onClick={() => onDelete(item.id)}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-red-200 px-4 text-sm font-medium text-red-700 transition hover:bg-red-50 sm:w-auto"
          >
            <FontAwesomeIcon icon={faTrashCan} className="h-4 w-4" aria-hidden="true" />
            Delete
          </button>
          <div className="grid w-full grid-cols-2 gap-2 sm:w-auto">
            <button
              type="button"
              onClick={() => downloadRewriteText(item)}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-3 text-sm font-medium text-emerald-800 transition hover:bg-emerald-100 sm:gap-2 sm:px-4"
            >
              <FontAwesomeIcon icon={faFileLines} className="h-4 w-4" aria-hidden="true" />
              <span><span className="hidden sm:inline">Download </span>TXT</span>
            </button>
            <button
              type="button"
              onClick={() => downloadRewritePdf(item)}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md border border-rose-200 bg-rose-50 px-3 text-sm font-medium text-rose-700 transition hover:bg-rose-100 sm:gap-2 sm:px-4"
            >
              <FontAwesomeIcon icon={faFilePdf} className="h-4 w-4" aria-hidden="true" />
              <span><span className="hidden sm:inline">Download </span>PDF</span>
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-full items-center justify-center rounded-md bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 sm:w-auto"
          >
            Close
          </button>
        </div>
      </section>
    </div>
  );
}

function parseAvoidWords(value: string): string[] {
  const seen = new Set<string>();
  return value
    .split(/[\n,]+/)
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter((item) => {
      const key = item.toLowerCase();
      if (!item || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((item) => item.slice(0, 120))
    .slice(0, 30);
}

function highlightRewrittenText(originalText: string, rewrittenText: string) {
  const originalTerms = new Set(
    splitTextParts(originalText)
      .filter((part) => !/^\s+$/.test(part))
      .map(normalizeDiffToken)
      .filter(Boolean),
  );

  return splitTextParts(rewrittenText).map((part, index) => {
    if (/^\s+$/.test(part)) {
      return part;
    }
    const isNew = !originalTerms.has(normalizeDiffToken(part));
    return isNew ? (
      <mark key={`${part}-${index}`} className="rounded bg-emerald-100 px-0.5 text-slate-950">
        {part}
      </mark>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    );
  });
}

function splitTextParts(text: string): string[] {
  return text.match(/\s+|[^\s]+/g) ?? [];
}

function normalizeDiffToken(value: string): string {
  return value.toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "");
}

function getVocabularyCount(item: RewriteResponse): number {
  return Object.values(item.vocabularySuggestions).reduce((total, values) => total + values.length, 0);
}

function formatResultCount(count: number): string {
  return `${count.toLocaleString()} ${count === 1 ? "result" : "results"}`;
}

function getChecklistPercent(result: string): string | null {
  const match = result.match(/(\d{1,3}(?:\.\d+)?)\s*%/);
  return match ? `${match[1]}%` : null;
}

function getChecklistResultText(result: string): string {
  const cleanResult = result
    .replace(/\s*\(?\d{1,3}(?:\.\d+)?\s*%\)?/, "")
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();

  return cleanResult || result;
}

function isChecklistPass(result: string): boolean {
  return result.toLowerCase().includes("pass");
}

function countWords(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

export function downloadRewriteText(item: RewriteResponse) {
  const content = [
    "Rewritten Output",
    `Mode: ${item.modeLabel}`,
    `Created: ${formatDate(item.createdAt)}`,
    "",
    item.rewrittenText,
  ].join("\n");

  downloadBlob(
    new Blob([content], { type: "text/plain;charset=utf-8" }),
    getRewriteExportFilename(item, "txt"),
  );
}

export function downloadRewritePdf(item: RewriteResponse) {
  const lines = [
    "Rewritten Output",
    `Mode: ${item.modeLabel}`,
    `Created: ${formatDate(item.createdAt)}`,
    "",
    ...wrapPdfText(item.rewrittenText, 88),
  ];

  downloadBlob(createPdfBlob(lines), getRewriteExportFilename(item, "pdf"));
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function getRewriteExportFilename(item: RewriteResponse, extension: "txt" | "pdf"): string {
  const created = new Date(item.createdAt);
  const datePart = Number.isNaN(created.getTime()) ? "rewrite" : created.toISOString().slice(0, 10);
  const modePart = item.modeLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "output";
  return `rewrite-${datePart}-${modePart}.${extension}`;
}

function wrapPdfText(value: string, maxChars: number): string[] {
  return value.split(/\r?\n/).flatMap((paragraph) => {
    const normalized = paragraph.replace(/\s+/g, " ").trim();
    if (!normalized) {
      return [""];
    }

    const lines: string[] = [];
    let current = "";
    for (const word of normalized.split(" ")) {
      const pieces = splitLongPdfWord(word, maxChars);
      for (const piece of pieces) {
        const next = current ? `${current} ${piece}` : piece;
        if (next.length > maxChars && current) {
          lines.push(current);
          current = piece;
        } else {
          current = next;
        }
      }
    }

    if (current) {
      lines.push(current);
    }
    return lines;
  });
}

function splitLongPdfWord(word: string, maxChars: number): string[] {
  const pieces: string[] = [];
  for (let index = 0; index < word.length; index += maxChars) {
    pieces.push(word.slice(index, index + maxChars));
  }
  return pieces.length ? pieces : [word];
}

function createPdfBlob(lines: string[]): Blob {
  const pageLines = chunkPdfLines(lines);
  const fontObjectId = pageLines.length * 2 + 3;
  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pageLines.map((_, index) => `${index * 2 + 3} 0 R`).join(" ")}] /Count ${pageLines.length} >>`,
  ];

  pageLines.forEach((page, index) => {
    const pageObjectId = index * 2 + 3;
    const contentObjectId = pageObjectId + 1;
    const content = renderPdfPage(page, index + 1, pageLines.length);
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontObjectId} 0 R >> >> /Contents ${contentObjectId} 0 R >>`,
      `<< /Length ${pdfByteLength(content)} >>\nstream\n${content}\nendstream`,
    );
  });

  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  return new Blob([assemblePdf(objects)], { type: "application/pdf" });
}

function chunkPdfLines(lines: string[]): string[][] {
  const maxLines = 44;
  const pages: string[][] = [];
  for (let index = 0; index < lines.length; index += maxLines) {
    pages.push(lines.slice(index, index + maxLines));
  }
  return pages.length ? pages : [[""]];
}

function renderPdfPage(lines: string[], pageNumber: number, pageTotal: number): string {
  const body = lines.map((line, index) => {
    const isTitle = pageNumber === 1 && index === 0;
    const fontSize = isTitle ? 16 : 11;
    const y = 794 - index * 16;
    return `BT /F1 ${fontSize} Tf 1 0 0 1 48 ${y} Tm (${escapePdfText(line)}) Tj ET`;
  }).join("\n");
  const footer = `BT /F1 9 Tf 1 0 0 1 48 32 Tm (${escapePdfText(`Page ${pageNumber} of ${pageTotal}`)}) Tj ET`;
  return `${body}\n${footer}`;
}

function assemblePdf(objects: string[]): string {
  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets[index + 1] = pdfByteLength(pdf);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefStart = pdfByteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let index = 1; index <= objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return pdf;
}

function escapePdfText(value: string): string {
  return value
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "?")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function pdfByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

function createDefaultUserPromptSetting(modeOption: RewriteModeOption): UserPromptSetting {
  return {
    mode: modeOption.value,
    label: modeOption.label,
    description: modeOption.description,
    promptInstruction: modeOption.description,
    outputInstruction: DEFAULT_OUTPUT_INSTRUCTION,
    defaultPromptInstruction: modeOption.description,
    defaultOutputInstruction: DEFAULT_OUTPUT_INSTRUCTION,
    customized: false,
    updatedAt: new Date(0).toISOString(),
  };
}

function toPromptSettingMap(settings: UserPromptSetting[]): UserPromptSettingMap {
  return settings.reduce<UserPromptSettingMap>((current, setting) => {
    current[setting.mode] = setting;
    return current;
  }, {});
}

function readGuestPromptSettings(modeOptions: RewriteModeOption[]): UserPromptSetting[] {
  if (typeof window === "undefined") {
    return modeOptions.map(createDefaultUserPromptSetting);
  }

  try {
    const raw = window.localStorage.getItem(USER_PROMPT_SETTINGS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) as Partial<Record<RewriteMode, UpdateUserPromptSettingInput & { updatedAt?: string }>> : {};
    return modeOptions.map((modeOption) => {
      const saved = parsed[modeOption.value];
      const base = createDefaultUserPromptSetting(modeOption);
      if (!saved) {
        return base;
      }

      return {
        ...base,
        promptInstruction: saved.promptInstruction?.trim() || base.defaultPromptInstruction,
        outputInstruction: saved.outputInstruction?.trim() || base.defaultOutputInstruction,
        customized: true,
        updatedAt: saved.updatedAt ?? new Date().toISOString(),
      };
    });
  } catch {
    return modeOptions.map(createDefaultUserPromptSetting);
  }
}

function saveGuestPromptSetting(
  modeOption: RewriteModeOption,
  input: UpdateUserPromptSettingInput,
): UserPromptSetting {
  const updatedAt = new Date().toISOString();
  const raw = window.localStorage.getItem(USER_PROMPT_SETTINGS_STORAGE_KEY);
  const parsed = raw ? JSON.parse(raw) as Partial<Record<RewriteMode, UpdateUserPromptSettingInput & { updatedAt?: string }>> : {};
  parsed[modeOption.value] = {
    promptInstruction: input.promptInstruction.trim(),
    outputInstruction: input.outputInstruction.trim(),
    updatedAt,
  };
  window.localStorage.setItem(USER_PROMPT_SETTINGS_STORAGE_KEY, JSON.stringify(parsed));

  return {
    ...createDefaultUserPromptSetting(modeOption),
    promptInstruction: input.promptInstruction.trim(),
    outputInstruction: input.outputInstruction.trim(),
    customized: true,
    updatedAt,
  };
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
