"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCircleCheck,
  faRotateRight,
  faSpinner,
  faTriangleExclamation,
} from "@fortawesome/free-solid-svg-icons";
import { FormEvent, useEffect, useState } from "react";
import {
  AdminAuditLog,
  AdminSession,
  ContactMessageResponse,
  getAdminSession,
  listAdminAuditLogs,
  listContactMessages,
  listPromptSettings,
  PromptSetting,
  RewriteMode,
  updatePromptSetting,
  UpdatePromptSettingInput,
} from "@/lib/api";
import { formatDate } from "@/components/RewriteWorkspace";
import { Skeleton, SkeletonText } from "@/components/Skeleton";

const ADMIN_TOKEN_STORAGE_KEY = "ai-student-rewriter-admin-token";

type PromptDrafts = Partial<Record<RewriteMode, UpdatePromptSettingInput>>;

export function AdminPageClient() {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [session, setSession] = useState<AdminSession | null>(null);
  const [settings, setSettings] = useState<PromptSetting[]>([]);
  const [drafts, setDrafts] = useState<PromptDrafts>({});
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [contactMessages, setContactMessages] = useState<ContactMessageResponse[]>([]);
  const [isBooting, setIsBooting] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [savingMode, setSavingMode] = useState<RewriteMode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;
    const savedToken = window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);

    async function restoreSession() {
      if (!savedToken) {
        setIsBooting(false);
        return;
      }

      try {
        const adminSession = await getAdminSession(savedToken);
        if (!isActive) return;
        setToken(savedToken);
        setSession(adminSession);
        const [promptSettings, logs, messages] = await Promise.all([
          listPromptSettings(savedToken),
          listAdminAuditLogs(savedToken),
          listContactMessages(savedToken),
        ]);
        if (!isActive) return;
        setSettings(promptSettings);
        setDrafts(createDrafts(promptSettings));
        setAuditLogs(logs);
        setContactMessages(messages);
      } catch {
        window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
      } finally {
        if (isActive) {
          setIsBooting(false);
        }
      }
    }

    void restoreSession();

    return () => {
      isActive = false;
    };
  }, []);

  async function loadAdminData(authToken = token) {
    if (!authToken) return;
    setIsLoading(true);
    setError(null);
    try {
      const [promptSettings, logs, messages] = await Promise.all([
        listPromptSettings(authToken),
        listAdminAuditLogs(authToken),
        listContactMessages(authToken),
      ]);
      setSettings(promptSettings);
      setDrafts(createDrafts(promptSettings));
      setAuditLogs(logs);
      setContactMessages(messages);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load admin settings.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const trimmedUsername = username.trim();
    if (!trimmedUsername || !password) {
      setError("Enter admin username and password.");
      return;
    }

    setIsLoggingIn(true);
    try {
      const authToken = window.btoa(`${trimmedUsername}:${password}`);
      const adminSession = await getAdminSession(authToken);
      setToken(authToken);
      setSession(adminSession);
      window.localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, authToken);
      await loadAdminData(authToken);
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : "Admin login failed.",
      );
    } finally {
      setIsLoggingIn(false);
    }
  }

  function handleLogout() {
    window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    setToken(null);
    setSession(null);
    setSettings([]);
    setDrafts({});
    setAuditLogs([]);
    setContactMessages([]);
    setPassword("");
    setSuccess(null);
    setError(null);
  }

  function updateDraft<K extends keyof UpdatePromptSettingInput>(
    mode: RewriteMode,
    key: K,
    value: UpdatePromptSettingInput[K],
  ) {
    setDrafts((current) => ({
      ...current,
      [mode]: {
        ...(current[mode] ?? {
          label: "",
          description: "",
          promptInstruction: "",
          outputInstruction: "",
          enabled: true,
        }),
        [key]: value,
      },
    }));
  }

  async function handleSave(mode: RewriteMode) {
    if (!token) return;
    const draft = drafts[mode];
    if (!draft) return;

    if (
      !draft.label.trim() ||
      !draft.description.trim() ||
      !draft.promptInstruction.trim() ||
      !draft.outputInstruction.trim()
    ) {
      setError("Label, description, prompt instruction, and output instruction are required.");
      return;
    }

    setSavingMode(mode);
    setError(null);
    setSuccess(null);
    try {
      const updated = await updatePromptSetting(token, mode, {
        label: draft.label.trim(),
        description: draft.description.trim(),
        promptInstruction: draft.promptInstruction.trim(),
        outputInstruction: draft.outputInstruction.trim(),
        enabled: draft.enabled,
      });
      setSettings((current) =>
        current.map((item) => (item.mode === mode ? updated : item)),
      );
      setDrafts((current) => ({
        ...current,
        [mode]: {
          label: updated.label,
          description: updated.description,
          promptInstruction: updated.promptInstruction,
          outputInstruction: updated.outputInstruction,
          enabled: updated.enabled,
        },
      }));
      setAuditLogs(await listAdminAuditLogs(token));
      setSuccess(`${updated.label} saved.`);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save prompt setting.",
      );
    } finally {
      setSavingMode(null);
    }
  }

  if (isBooting) {
    return (
      <AdminPageSkeleton />
    );
  }

  if (!session) {
    return (
      <main className="mx-auto flex min-h-[calc(100vh-89px)] w-full max-w-md items-center px-4 py-8">
        <section className="w-full rounded-md border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-5 py-5">
            <h1 className="text-xl font-semibold text-slate-950">Admin login</h1>
            <p className="mt-1 text-sm text-slate-600">Prompt settings</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4 px-5 py-5">
            <div>
              <label htmlFor="admin-username" className="text-sm font-medium text-slate-800">
                Username
              </label>
              <input
                id="admin-username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                autoComplete="username"
              />
            </div>
            <div>
              <label htmlFor="admin-password" className="text-sm font-medium text-slate-800">
                Password
              </label>
              <input
                id="admin-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                autoComplete="current-password"
                placeholder="admin123"
              />
            </div>

            {error && <StatusMessage tone="error" message={error} />}

            <button
              type="submit"
              disabled={isLoggingIn}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isLoggingIn ? (
                <FontAwesomeIcon icon={faSpinner} className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : null}
              {isLoggingIn ? "Signing in" : "Sign in"}
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="page-shell grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="min-w-0 rounded-md border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-950">Prompt settings</h1>
            <p className="mt-1 text-sm text-slate-600">
              Signed in as {session.username}
            </p>
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:flex sm:flex-wrap sm:items-center">
            <button
              type="button"
              onClick={() => void loadAdminData()}
              disabled={isLoading}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              <FontAwesomeIcon icon={faRotateRight} className="h-4 w-4" aria-hidden="true" />
              Refresh
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex h-10 w-full items-center justify-center rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 sm:w-auto"
            >
              Logout
            </button>
          </div>
        </div>

        <div className="space-y-4 px-5 py-5">
          {error && <StatusMessage tone="error" message={error} />}
          {success && <StatusMessage tone="success" message={success} />}

          {isLoading && !settings.length ? (
            <PromptSettingsSkeleton />
          ) : (
            settings.map((setting) => {
              const draft = drafts[setting.mode] ?? {
                label: setting.label,
                description: setting.description,
                promptInstruction: setting.promptInstruction,
                outputInstruction: setting.outputInstruction,
                enabled: setting.enabled,
              };

              return (
                <article key={setting.mode} className="rounded-md border border-slate-200 bg-white">
                  <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <p className="break-all text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                        {setting.mode}
                      </p>
                      <h2 className="mt-1 text-lg font-semibold text-slate-950">
                        {draft.label || setting.label}
                      </h2>
                    </div>
                    <label className="inline-flex shrink-0 items-center gap-2 text-sm font-medium text-slate-700">
                      <input
                        type="checkbox"
                        checked={draft.enabled}
                        onChange={(event) =>
                          updateDraft(setting.mode, "enabled", event.target.checked)
                        }
                        className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                      />
                      Enabled
                    </label>
                  </div>

                  <div className="grid gap-4 px-4 py-4 md:grid-cols-2">
                    <div>
                      <label
                        htmlFor={`label-${setting.mode}`}
                        className="text-sm font-medium text-slate-800"
                      >
                        Label
                      </label>
                      <input
                        id={`label-${setting.mode}`}
                        value={draft.label}
                        onChange={(event) =>
                          updateDraft(setting.mode, "label", event.target.value)
                        }
                        className="mt-2 h-10 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor={`description-${setting.mode}`}
                        className="text-sm font-medium text-slate-800"
                      >
                        Description
                      </label>
                      <textarea
                        id={`description-${setting.mode}`}
                        value={draft.description}
                        onChange={(event) =>
                          updateDraft(setting.mode, "description", event.target.value)
                        }
                        rows={3}
                        className="mt-2 w-full resize-y rounded-md border border-slate-300 px-3 py-2 text-sm leading-6 text-slate-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label
                        htmlFor={`instruction-${setting.mode}`}
                        className="text-sm font-medium text-slate-800"
                      >
                        Prompt instruction
                      </label>
                      <textarea
                        id={`instruction-${setting.mode}`}
                        value={draft.promptInstruction}
                        onChange={(event) =>
                          updateDraft(
                            setting.mode,
                            "promptInstruction",
                            event.target.value,
                          )
                        }
                        rows={5}
                        className="mt-2 w-full resize-y rounded-md border border-slate-300 px-3 py-2 font-mono text-sm leading-6 text-slate-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label
                        htmlFor={`output-${setting.mode}`}
                        className="text-sm font-medium text-slate-800"
                      >
                        Output instruction
                      </label>
                      <textarea
                        id={`output-${setting.mode}`}
                        value={draft.outputInstruction}
                        onChange={(event) =>
                          updateDraft(
                            setting.mode,
                            "outputInstruction",
                            event.target.value,
                          )
                        }
                        rows={3}
                        className="mt-2 w-full resize-y rounded-md border border-slate-300 px-3 py-2 font-mono text-sm leading-6 text-slate-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                      />
                      <p className="mt-1 text-xs text-slate-500">
                        This controls how the final answer is returned to every user.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-xs text-slate-500">
                      Updated {formatDate(setting.updatedAt)}
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleSave(setting.mode)}
                      disabled={savingMode === setting.mode}
                      className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
                    >
                      {savingMode === setting.mode ? (
                        <FontAwesomeIcon icon={faSpinner} className="h-4 w-4 animate-spin" aria-hidden="true" />
                      ) : null}
                      {savingMode === setting.mode ? "Saving" : "Save"}
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>

      <aside className="min-w-0 rounded-md border border-slate-200 bg-white">
        <section>
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="font-semibold text-slate-950">Admin activity</h2>
            <p className="mt-1 text-sm text-slate-600">{auditLogs.length} recent changes</p>
          </div>
          <div className="divide-y divide-slate-200">
            {auditLogs.length ? (
              auditLogs.map((log) => (
                <article key={log.id} className="px-5 py-4">
                  <p className="text-sm font-semibold text-slate-900">{log.action}</p>
                  <p className="mt-1 break-words text-sm leading-6 text-slate-600">{log.details}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    {log.actorUsername ?? "unknown"} - {formatDate(log.createdAt)}
                  </p>
                </article>
              ))
            ) : (
              <div className="flex h-48 items-center justify-center px-5 text-center text-sm text-slate-500">
                No admin changes yet.
              </div>
            )}
          </div>
        </section>

        <section className="border-t border-slate-200">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="font-semibold text-slate-950">Contact messages</h2>
            <p className="mt-1 text-sm text-slate-600">{contactMessages.length} recent messages</p>
          </div>
          <div className="max-h-[420px] overflow-y-auto divide-y divide-slate-200">
            {contactMessages.length ? (
              contactMessages.map((message) => (
                <article key={message.id} className="px-5 py-4">
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-semibold text-slate-900">{message.subject}</p>
                  <p className="break-words text-xs text-slate-500">
                    {message.name} - {message.email}
                  </p>
                  </div>
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">
                    {message.message}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">{formatDate(message.createdAt)}</p>
                </article>
              ))
            ) : (
              <div className="flex h-40 items-center justify-center px-5 text-center text-sm text-slate-500">
                No contact messages yet.
              </div>
            )}
          </div>
        </section>
      </aside>
    </main>
  );
}

function AdminPageSkeleton() {
  return (
    <main className="page-shell grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="min-w-0 rounded-md border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-5">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="mt-3 h-4 w-36" />
        </div>
        <div className="space-y-4 px-5 py-5">
          <PromptSettingsSkeleton />
        </div>
      </section>
      <aside className="min-w-0 rounded-md border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="mt-3 h-4 w-28" />
        </div>
        <div className="divide-y divide-slate-200">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="px-5 py-4">
              <Skeleton className="h-4 w-28" />
              <SkeletonText lines={2} className="mt-3" />
            </div>
          ))}
        </div>
      </aside>
    </main>
  );
}

function PromptSettingsSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, index) => (
        <article key={index} className="rounded-md border border-slate-200 bg-white">
          <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <Skeleton className="h-3 w-36" />
              <Skeleton className="mt-3 h-6 w-44" />
            </div>
            <Skeleton className="h-5 w-24" />
          </div>
          <div className="grid gap-4 px-4 py-4 md:grid-cols-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-28 w-full md:col-span-2" />
            <Skeleton className="h-20 w-full md:col-span-2" />
          </div>
          <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <Skeleton className="h-3 w-36" />
            <Skeleton className="h-10 w-full sm:w-24" />
          </div>
        </article>
      ))}
    </div>
  );
}

function createDrafts(settings: PromptSetting[]): PromptDrafts {
  return settings.reduce<PromptDrafts>((current, setting) => {
    current[setting.mode] = {
      label: setting.label,
      description: setting.description,
      promptInstruction: setting.promptInstruction,
      outputInstruction: setting.outputInstruction,
      enabled: setting.enabled,
    };
    return current;
  }, {});
}

function StatusMessage({ tone, message }: { tone: "error" | "success"; message: string }) {
  const isError = tone === "error";
  return (
    <div
      className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${
        isError
          ? "border-red-200 bg-red-50 text-red-800"
          : "border-emerald-200 bg-emerald-50 text-emerald-800"
      }`}
    >
      {isError ? (
        <FontAwesomeIcon icon={faTriangleExclamation} className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      ) : (
        <FontAwesomeIcon icon={faCircleCheck} className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      )}
      <span>{message}</span>
    </div>
  );
}
