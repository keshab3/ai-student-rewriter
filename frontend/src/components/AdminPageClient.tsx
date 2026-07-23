"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCircleCheck,
  faRotateRight,
  faSpinner,
  faTrashCan,
  faTriangleExclamation,
} from "@fortawesome/free-solid-svg-icons";
import { FormEvent, useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  AdminCreateUserInput,
  AdminAuditLog,
  AdminSession,
  AdminUpdateUserInput,
  AdminUser,
  createAdminUser,
  ContactMessageResponse,
  deleteAdminUser,
  getAdminSession,
  listAdminAuditLogs,
  listAdminUsers,
  listContactMessages,
  listPromptSettings,
  PromptSetting,
  RewriteMode,
  updateAdminUser,
  updatePromptSetting,
  UpdatePromptSettingInput,
} from "@/lib/api";
import { clearUserToken, readUserToken, saveUserToken } from "@/lib/auth";
import { formatDate } from "@/components/RewriteWorkspace";
import { Skeleton, SkeletonText } from "@/components/Skeleton";

const ADMIN_TOKEN_STORAGE_KEY = "ai-student-rewriter-admin-token";

type PromptDrafts = Partial<Record<RewriteMode, UpdatePromptSettingInput>>;
type AdminTab = "USERS" | "PROMPTS";

const emptyNewUser: AdminCreateUserInput = {
  username: "",
  password: "",
  displayName: "",
  fullName: "",
  email: "",
  enabled: true,
};

export function AdminPageClient() {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [session, setSession] = useState<AdminSession | null>(null);
  const [settings, setSettings] = useState<PromptSetting[]>([]);
  const [drafts, setDrafts] = useState<PromptDrafts>({});
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [contactMessages, setContactMessages] = useState<ContactMessageResponse[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [activeTab, setActiveTab] = useState<AdminTab>("USERS");
  const [newUser, setNewUser] = useState<AdminCreateUserInput>(emptyNewUser);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editUser, setEditUser] = useState<AdminUpdateUserInput | null>(null);
  const [isBooting, setIsBooting] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [savingMode, setSavingMode] = useState<RewriteMode | null>(null);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [savingUserId, setSavingUserId] = useState<number | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<number | null>(null);
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
        saveUserToken(savedToken);
        const [promptSettings, logs, messages, adminUsers] = await Promise.all([
          listPromptSettings(savedToken),
          listAdminAuditLogs(savedToken),
          listContactMessages(savedToken),
          listAdminUsers(savedToken),
        ]);
        if (!isActive) return;
        setSettings(promptSettings);
        setDrafts(createDrafts(promptSettings));
        setAuditLogs(logs);
        setContactMessages(messages);
        setUsers(adminUsers);
      } catch {
        window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
        if (readUserToken() === savedToken) {
          clearUserToken();
        }
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
      const [promptSettings, logs, messages, adminUsers] = await Promise.all([
        listPromptSettings(authToken),
        listAdminAuditLogs(authToken),
        listContactMessages(authToken),
        listAdminUsers(authToken),
      ]);
      setSettings(promptSettings);
      setDrafts(createDrafts(promptSettings));
      setAuditLogs(logs);
      setContactMessages(messages);
      setUsers(adminUsers);
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
      saveUserToken(authToken);
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
    if (readUserToken() === token) {
      clearUserToken();
    }
    setToken(null);
    setSession(null);
    setSettings([]);
    setDrafts({});
    setAuditLogs([]);
    setContactMessages([]);
    setUsers([]);
    setNewUser(emptyNewUser);
    setEditingUserId(null);
    setEditUser(null);
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

  function updateNewUser<K extends keyof AdminCreateUserInput>(
    key: K,
    value: AdminCreateUserInput[K],
  ) {
    setNewUser((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function startEditUser(user: AdminUser) {
    setEditingUserId(user.id);
    setEditUser({
      username: user.username,
      password: undefined,
      displayName: user.displayName,
      fullName: user.fullName,
      email: user.email,
      enabled: user.enabled,
    });
    setError(null);
    setSuccess(null);
  }

  function cancelEditUser() {
    setEditingUserId(null);
    setEditUser(null);
  }

  function updateEditUser<K extends keyof AdminUpdateUserInput>(
    key: K,
    value: AdminUpdateUserInput[K],
  ) {
    setEditUser((current) => current ? { ...current, [key]: value } : current);
  }

  async function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;

    setIsCreatingUser(true);
    setError(null);
    setSuccess(null);
    try {
      const created = await createAdminUser(token, {
        username: newUser.username.trim(),
        password: newUser.password,
        displayName: newUser.displayName.trim(),
        fullName: newUser.fullName.trim(),
        email: newUser.email.trim(),
        enabled: newUser.enabled,
      });
      const [logs, adminUsers] = await Promise.all([
        listAdminAuditLogs(token),
        listAdminUsers(token),
      ]);
      setAuditLogs(logs);
      setUsers(adminUsers);
      setNewUser(emptyNewUser);
      setSuccess(`${created.username} added.`);
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Could not add this user.",
      );
    } finally {
      setIsCreatingUser(false);
    }
  }

  async function handleSaveUser(id: number) {
    if (!token || !editUser) return;

    setSavingUserId(id);
    setError(null);
    setSuccess(null);
    try {
      const updated = await updateAdminUser(token, id, {
        username: editUser.username.trim(),
        password: editUser.password?.trim() || undefined,
        displayName: editUser.displayName.trim(),
        fullName: editUser.fullName.trim(),
        email: editUser.email.trim(),
        enabled: editUser.enabled,
      });
      const [logs, adminUsers] = await Promise.all([
        listAdminAuditLogs(token),
        listAdminUsers(token),
      ]);
      setAuditLogs(logs);
      setUsers(adminUsers);
      cancelEditUser();
      setSuccess(`${updated.username} updated.`);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not update this user.",
      );
    } finally {
      setSavingUserId(null);
    }
  }

  async function handleDeleteUser(user: AdminUser) {
    if (!token) return;
    const confirmed = window.confirm(`Delete user "${user.username}" and all saved data for this user?`);
    if (!confirmed) return;

    setDeletingUserId(user.id);
    setError(null);
    setSuccess(null);
    try {
      await deleteAdminUser(token, user.id);
      const [logs, messages, adminUsers] = await Promise.all([
        listAdminAuditLogs(token),
        listContactMessages(token),
        listAdminUsers(token),
      ]);
      setAuditLogs(logs);
      setContactMessages(messages);
      setUsers(adminUsers);
      setSuccess(`${user.username} deleted.`);
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Could not delete this user.",
      );
    } finally {
      setDeletingUserId(null);
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
            <p className="mt-1 text-sm text-slate-600">Users and prompt settings</p>
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
            <h1 className="text-2xl font-semibold text-slate-950">
              {activeTab === "USERS" ? "User management" : "Prompt settings"}
            </h1>
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

          <div className="grid grid-cols-2 gap-1 rounded-md border border-slate-200 bg-slate-100 p-1 sm:w-fit">
            <AdminTabButton active={activeTab === "USERS"} onClick={() => setActiveTab("USERS")}>
              Users
            </AdminTabButton>
            <AdminTabButton active={activeTab === "PROMPTS"} onClick={() => setActiveTab("PROMPTS")}>
              Prompt settings
            </AdminTabButton>
          </div>

          {activeTab === "USERS" ? (
            <UserManagementPanel
              users={users}
              session={session}
              newUser={newUser}
              editUser={editUser}
              editingUserId={editingUserId}
              isLoading={isLoading}
              isCreatingUser={isCreatingUser}
              savingUserId={savingUserId}
              deletingUserId={deletingUserId}
              onCreateUser={handleCreateUser}
              onNewUserChange={updateNewUser}
              onStartEdit={startEditUser}
              onEditUserChange={updateEditUser}
              onCancelEdit={cancelEditUser}
              onSaveUser={handleSaveUser}
              onDeleteUser={handleDeleteUser}
            />
          ) : isLoading && !settings.length ? (
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

function AdminTabButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-10 rounded-md px-3 text-sm font-semibold transition ${
        active ? "bg-white text-slate-950 shadow-sm" : "text-slate-600 hover:bg-white/70 hover:text-slate-950"
      }`}
    >
      {children}
    </button>
  );
}

function UserManagementPanel({
  users,
  session,
  newUser,
  editUser,
  editingUserId,
  isLoading,
  isCreatingUser,
  savingUserId,
  deletingUserId,
  onCreateUser,
  onNewUserChange,
  onStartEdit,
  onEditUserChange,
  onCancelEdit,
  onSaveUser,
  onDeleteUser,
}: {
  users: AdminUser[];
  session: AdminSession;
  newUser: AdminCreateUserInput;
  editUser: AdminUpdateUserInput | null;
  editingUserId: number | null;
  isLoading: boolean;
  isCreatingUser: boolean;
  savingUserId: number | null;
  deletingUserId: number | null;
  onCreateUser: (event: FormEvent<HTMLFormElement>) => void;
  onNewUserChange: <K extends keyof AdminCreateUserInput>(key: K, value: AdminCreateUserInput[K]) => void;
  onStartEdit: (user: AdminUser) => void;
  onEditUserChange: <K extends keyof AdminUpdateUserInput>(key: K, value: AdminUpdateUserInput[K]) => void;
  onCancelEdit: () => void;
  onSaveUser: (id: number) => Promise<void>;
  onDeleteUser: (user: AdminUser) => Promise<void>;
}) {
  return (
    <div className="space-y-4">
      <form onSubmit={onCreateUser} className="rounded-md border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-4">
          <h2 className="font-semibold text-slate-950">Add user</h2>
          <p className="mt-1 text-sm text-slate-600">Create a student account from the admin page.</p>
        </div>
        <div className="grid gap-4 px-4 py-4 md:grid-cols-2">
          <UserTextField
            id="new-user-username"
            label="Username"
            value={newUser.username}
            onChange={(value) => onNewUserChange("username", value)}
          />
          <UserTextField
            id="new-user-password"
            label="Password"
            type="password"
            value={newUser.password}
            onChange={(value) => onNewUserChange("password", value)}
          />
          <UserTextField
            id="new-user-display-name"
            label="Display name"
            value={newUser.displayName}
            onChange={(value) => onNewUserChange("displayName", value)}
          />
          <UserTextField
            id="new-user-full-name"
            label="Full name"
            value={newUser.fullName}
            onChange={(value) => onNewUserChange("fullName", value)}
          />
          <UserTextField
            id="new-user-email"
            label="Email"
            type="email"
            value={newUser.email}
            onChange={(value) => onNewUserChange("email", value)}
          />
          <label className="flex h-10 items-center gap-2 self-end text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={newUser.enabled}
              onChange={(event) => onNewUserChange("enabled", event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
            />
            Enabled
          </label>
        </div>
        <div className="flex justify-end border-t border-slate-200 px-4 py-4">
          <button
            type="submit"
            disabled={isCreatingUser}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
          >
            {isCreatingUser ? (
              <FontAwesomeIcon icon={faSpinner} className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : null}
            {isCreatingUser ? "Adding" : "Add user"}
          </button>
        </div>
      </form>

      <section className="rounded-md border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-4">
          <h2 className="font-semibold text-slate-950">All users</h2>
          <p className="mt-1 text-sm text-slate-600">{users.length} accounts</p>
        </div>
        <div className="divide-y divide-slate-200">
          {isLoading && !users.length ? (
            <UserManagementSkeleton />
          ) : users.length ? (
            users.map((user) => {
              const isCurrentUser = user.username === session.username;
              const isEditing = editingUserId === user.id && editUser !== null;

              return (
                <article key={user.id} className="px-4 py-4">
                  {isEditing && editUser ? (
                    <div className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <UserTextField
                          id={`edit-user-username-${user.id}`}
                          label="Username"
                          value={editUser.username}
                          onChange={(value) => onEditUserChange("username", value)}
                        />
                        <UserTextField
                          id={`edit-user-password-${user.id}`}
                          label="New password"
                          type="password"
                          value={editUser.password ?? ""}
                          placeholder="Leave blank to keep current password"
                          onChange={(value) => onEditUserChange("password", value || undefined)}
                        />
                        <UserTextField
                          id={`edit-user-display-name-${user.id}`}
                          label="Display name"
                          value={editUser.displayName}
                          onChange={(value) => onEditUserChange("displayName", value)}
                        />
                        <UserTextField
                          id={`edit-user-full-name-${user.id}`}
                          label="Full name"
                          value={editUser.fullName}
                          onChange={(value) => onEditUserChange("fullName", value)}
                        />
                        <UserTextField
                          id={`edit-user-email-${user.id}`}
                          label="Email"
                          type="email"
                          value={editUser.email}
                          onChange={(value) => onEditUserChange("email", value)}
                        />
                        <label className="flex h-10 items-center gap-2 self-end text-sm font-medium text-slate-700">
                          <input
                            type="checkbox"
                            checked={editUser.enabled}
                            onChange={(event) => onEditUserChange("enabled", event.target.checked)}
                            className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                          />
                          Enabled
                        </label>
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                        <button
                          type="button"
                          onClick={onCancelEdit}
                          disabled={savingUserId === user.id}
                          className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => void onSaveUser(user.id)}
                          disabled={savingUserId === user.id}
                          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-70"
                        >
                          {savingUserId === user.id ? (
                            <FontAwesomeIcon icon={faSpinner} className="h-4 w-4 animate-spin" aria-hidden="true" />
                          ) : null}
                          {savingUserId === user.id ? "Saving" : "Save user"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">{user.displayName}</p>
                        <p className="mt-1 break-words text-sm text-slate-600">
                          {user.username} - {user.email || "no email"}
                        </p>
                        <p className="mt-1 break-words text-xs text-slate-500">
                          {user.fullName || "No full name"} - created {formatDate(user.createdAt)}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {user.roles.map((role) => (
                            <span key={`${user.id}-${role}`} className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                              {role}
                            </span>
                          ))}
                          <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                            {user.enabled ? "Enabled" : "Disabled"}
                          </span>
                          {isCurrentUser && (
                            <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                              Current admin
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
                        <button
                          type="button"
                          onClick={() => onStartEdit(user)}
                          disabled={isCurrentUser}
                          className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                          title={isCurrentUser ? "Current admin account cannot be edited here" : "Edit user"}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void onDeleteUser(user)}
                          disabled={isCurrentUser || deletingUserId === user.id}
                          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-red-200 px-4 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                          title={isCurrentUser ? "Current admin account cannot be deleted" : "Delete user"}
                        >
                          {deletingUserId === user.id ? (
                            <FontAwesomeIcon icon={faSpinner} className="h-4 w-4 animate-spin" aria-hidden="true" />
                          ) : (
                            <FontAwesomeIcon icon={faTrashCan} className="h-4 w-4" aria-hidden="true" />
                          )}
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              );
            })
          ) : (
            <div className="flex h-32 items-center justify-center px-5 text-center text-sm text-slate-500">
              No users found.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function UserTextField({
  id,
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-slate-800">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 h-10 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
      />
    </div>
  );
}

function UserManagementSkeleton() {
  return (
    <div className="divide-y divide-slate-200">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="px-4 py-4">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="mt-3 h-4 w-56" />
          <div className="mt-4 flex gap-2">
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-8 w-20" />
          </div>
        </div>
      ))}
    </div>
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
