"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCircleCheck,
  faRightFromBracket,
  faSpinner,
  faTriangleExclamation,
} from "@fortawesome/free-solid-svg-icons";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { getProfile, ProfileResponse, updateProfile } from "@/lib/api";
import { clearUserToken, readUserToken } from "@/lib/auth";
import { formatDate } from "@/components/RewriteWorkspace";
import { Skeleton } from "@/components/Skeleton";

export function ProfilePageClient() {
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;
    const savedToken = readUserToken();

    async function loadProfile() {
      if (!savedToken) {
        setIsLoading(false);
        return;
      }

      try {
        const loadedProfile = await getProfile(savedToken);
        if (!isActive) return;
        setToken(savedToken);
        setProfile(loadedProfile);
        setDisplayName(loadedProfile.displayName);
        setFullName(loadedProfile.fullName);
        setEmail(loadedProfile.email);
      } catch (loadError) {
        if (!isActive) return;
        setError(
          loadError instanceof Error ? loadError.message : "Could not load profile.",
        );
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      isActive = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;

    if (!displayName.trim() || !fullName.trim() || !email.trim()) {
      setError("Complete all profile fields.");
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const updated = await updateProfile(token, {
        displayName: displayName.trim(),
        fullName: fullName.trim(),
        email: email.trim(),
      });
      setProfile(updated);
      setSuccess("Profile saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save profile.");
    } finally {
      setIsSaving(false);
    }
  }

  function handleLogout() {
    clearUserToken();
    setToken(null);
    setProfile(null);
    setSuccess(null);
    setError(null);
  }

  if (isLoading) {
    return <ProfileSkeleton />;
  }

  if (!token || !profile) {
    return (
      <main className="mx-auto flex min-h-[calc(100vh-89px)] w-full max-w-md items-center px-4 py-8">
        <section className="w-full rounded-md border border-slate-200 bg-white px-5 py-5 text-center">
          <h1 className="text-xl font-semibold text-slate-950">Profile</h1>
          <p className="mt-2 text-sm text-slate-600">Sign in to view your student profile.</p>
          <div className="mt-5 grid grid-cols-2 gap-2 sm:flex sm:justify-center">
            <Link
              href="/login"
              className="inline-flex h-10 w-full items-center justify-center rounded-md bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 sm:w-auto"
            >
              Login
            </Link>
            <Link
              href="/register"
              className="inline-flex h-10 w-full items-center justify-center rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 sm:w-auto"
            >
              Register
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="page-shell grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <section className="rounded-md border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-slate-950">Profile</h1>
            <p className="mt-1 break-words text-sm text-slate-600">{profile.username}</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 sm:w-auto"
          >
            <FontAwesomeIcon icon={faRightFromBracket} className="h-4 w-4" aria-hidden="true" />
            Logout
          </button>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-4 px-4 py-5 sm:grid-cols-2 sm:px-5">
          <EditableField id="profile-display" label="Display name" value={displayName} onChange={setDisplayName} />
          <EditableField id="profile-full-name" label="Full name" value={fullName} onChange={setFullName} />
          <div className="sm:col-span-2">
            <EditableField id="profile-email" label="Email" value={email} onChange={setEmail} type="email" />
          </div>

          {error && <Message tone="error" message={error} />}
          {success && <Message tone="success" message={success} />}

          <div className="flex justify-end sm:col-span-2">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex h-11 w-full items-center justify-center rounded-md bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
            >
              {isSaving ? (
                <FontAwesomeIcon icon={faSpinner} className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : null}
              {isSaving ? "Saving" : "Save profile"}
            </button>
          </div>
        </form>
      </section>

      <aside className="rounded-md border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold text-slate-950">Account</h2>
        </div>
        <div className="space-y-4 px-5 py-5 text-sm">
          <div>
            <p className="text-slate-500">Roles</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {profile.roles.map((role) => (
                <span key={role} className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                  {role}
                </span>
              ))}
            </div>
          </div>
          <div>
            <p className="text-slate-500">Created</p>
            <p className="mt-1 break-words font-medium text-slate-900">{formatDate(profile.createdAt)}</p>
          </div>
        </div>
      </aside>
    </main>
  );
}

function ProfileSkeleton() {
  return (
    <main className="page-shell grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <section className="rounded-md border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="min-w-0">
            <Skeleton className="h-7 w-32" />
            <Skeleton className="mt-3 h-4 w-40" />
          </div>
          <Skeleton className="h-10 w-full sm:w-24" />
        </div>
        <div className="grid gap-4 px-4 py-5 sm:grid-cols-2 sm:px-5">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full sm:col-span-2" />
          <div className="flex justify-end sm:col-span-2">
            <Skeleton className="h-11 w-full sm:w-32" />
          </div>
        </div>
      </section>
      <aside className="rounded-md border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <Skeleton className="h-5 w-24" />
        </div>
        <div className="space-y-5 px-5 py-5">
          <div>
            <Skeleton className="h-3 w-16" />
            <div className="mt-3 flex gap-2">
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-6 w-20" />
            </div>
          </div>
          <div>
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-3 h-4 w-40" />
          </div>
        </div>
      </aside>
    </main>
  );
}

function EditableField({
  id,
  label,
  value,
  onChange,
  type = "text",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
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
        className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
      />
    </div>
  );
}

function Message({ tone, message }: { tone: "error" | "success"; message: string }) {
  const isError = tone === "error";
  return (
    <div
      className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm sm:col-span-2 ${
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
