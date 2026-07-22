"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  getRewriteStats,
  getUserSession,
  listRewriteModes,
  RewriteModeOption,
  RewriteStatsResponse,
  UserSession,
} from "@/lib/api";
import { readUserToken, USER_AUTH_CHANGED_EVENT } from "@/lib/auth";
import { formatDate } from "@/components/RewriteWorkspace";
import { getGuestRewriteStats } from "@/lib/guestRewrites";
import { Skeleton, SkeletonText } from "@/components/Skeleton";

export function DashboardPageClient() {
  const [stats, setStats] = useState<RewriteStatsResponse | null>(null);
  const [modes, setModes] = useState<RewriteModeOption[]>([]);
  const [session, setSession] = useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadDashboard() {
      try {
        const token = readUserToken();
        const modeOptions = await listRewriteModes();
        const userSession = token ? await getUserSession(token).catch(() => null) : null;
        const rewriteStats = token && userSession
          ? await getRewriteStats(token)
          : getGuestRewriteStats();
        if (!isActive) return;
        setStats(rewriteStats);
        setModes(modeOptions);
        setSession(userSession);
      } catch (loadError) {
        if (!isActive) return;
        setError(loadError instanceof Error ? loadError.message : "Dashboard failed to load.");
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadDashboard();

    function handleAuthChanged() {
      void loadDashboard();
    }

    window.addEventListener(USER_AUTH_CHANGED_EVENT, handleAuthChanged);
    window.addEventListener("storage", handleAuthChanged);
    window.addEventListener("focus", handleAuthChanged);

    return () => {
      isActive = false;
      window.removeEventListener(USER_AUTH_CHANGED_EVENT, handleAuthChanged);
      window.removeEventListener("storage", handleAuthChanged);
      window.removeEventListener("focus", handleAuthChanged);
    };
  }, []);

  return (
    <main className="page-shell">
      <section className="rounded-md border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-950">Dashboard</h1>
            <p className="mt-1 text-sm text-slate-600">
              {session
                ? `Signed in as ${session.displayName}`
                : "Guest history is saved in this browser"}
            </p>
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:flex sm:flex-wrap">
            <Link
              href="/"
              className="inline-flex h-10 w-full items-center justify-center rounded-md bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 sm:w-auto"
            >
              Rewrite
            </Link>
            <Link
              href={session ? "/profile" : "/login"}
              className="inline-flex h-10 w-full items-center justify-center rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 sm:w-auto"
            >
              {session ? "Profile" : "Login"}
            </Link>
          </div>
        </div>

        {isLoading ? (
          <DashboardSkeleton />
        ) : error ? (
          <div className="px-5 py-5 text-sm text-red-700">{error}</div>
        ) : (
          <div className="grid gap-5 px-4 py-4 lg:grid-cols-[1fr_1fr]">
            <div className="grid gap-3 sm:grid-cols-3 lg:col-span-2">
              <Metric label="Saved rewrites" value={(stats?.totalRewrites ?? 0).toString()} />
              <Metric label="Active modes" value={modes.length.toString()} />
              <Metric label="Recent items" value={(stats?.recentRewrites.length ?? 0).toString()} />
            </div>

            <section className="rounded-md border border-slate-200">
              <div className="border-b border-slate-200 px-4 py-3">
                <h2 className="font-medium text-slate-950">Recent rewrites</h2>
              </div>
              <div className="divide-y divide-slate-200">
                {stats?.recentRewrites.length ? (
                  stats.recentRewrites.map((item) => (
                    <article key={item.id} className="px-4 py-4">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-medium text-slate-700">
                          {item.modeLabel}
                        </span>
                        <span className="text-slate-500">{formatDate(item.createdAt)}</span>
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-700">
                        {item.rewrittenText}
                      </p>
                    </article>
                  ))
                ) : (
                  <div className="flex h-40 items-center justify-center text-sm text-slate-500">
                    No rewrite history yet.
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-md border border-slate-200">
              <div className="border-b border-slate-200 px-4 py-3">
                <h2 className="font-medium text-slate-950">Rewrite modes</h2>
              </div>
              <div className="divide-y divide-slate-200">
                {modes.map((mode) => (
                  <div key={mode.value} className="px-4 py-3">
                    <p className="text-sm font-semibold text-slate-900">{mode.label}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{mode.description}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </section>
    </main>
  );
}

function DashboardSkeleton() {
  return (
    <div className="grid gap-5 px-4 py-4 lg:grid-cols-[1fr_1fr]">
      <div className="grid gap-3 sm:grid-cols-3 lg:col-span-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="rounded-md border border-slate-200 px-4 py-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-4 h-8 w-16" />
          </div>
        ))}
      </div>

      {Array.from({ length: 2 }).map((_, sectionIndex) => (
        <section key={sectionIndex} className="rounded-md border border-slate-200">
          <div className="border-b border-slate-200 px-4 py-3">
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="divide-y divide-slate-200">
            {Array.from({ length: 3 }).map((_, itemIndex) => (
              <div key={itemIndex} className="px-4 py-4">
                <Skeleton className="h-3 w-28" />
                <SkeletonText lines={2} className="mt-3" />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 px-4 py-4">
      <p className="text-sm text-slate-600">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}
