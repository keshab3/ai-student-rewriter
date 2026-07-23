"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faRightFromBracket,
  faRightToBracket,
  faUserPlus,
} from "@fortawesome/free-solid-svg-icons";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { getUserSession, UserSession } from "@/lib/api";
import {
  clearUserToken,
  readUserToken,
  USER_AUTH_CHANGED_EVENT,
} from "@/lib/auth";

const navLinkClass =
  "inline-flex h-8 min-w-0 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 lg:h-9 lg:justify-start lg:px-2.5 lg:text-sm";

export function AppChrome({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-950">
      <SiteHeader />
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </div>
  );
}

function SiteHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<UserSession | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  useEffect(() => {
    let isActive = true;

    async function refreshSession() {
      const token = readUserToken();
      if (!token) {
        if (isActive) {
          setSession(null);
          setIsCheckingSession(false);
        }
        return;
      }

      try {
        const currentSession = await getUserSession(token);
        if (isActive) {
          setSession(currentSession);
        }
      } catch {
        clearUserToken();
        if (isActive) {
          setSession(null);
        }
      } finally {
        if (isActive) {
          setIsCheckingSession(false);
        }
      }
    }

    void refreshSession();

    function handleAuthChange() {
      void refreshSession();
    }

    window.addEventListener(USER_AUTH_CHANGED_EVENT, handleAuthChange);
    window.addEventListener("storage", handleAuthChange);
    window.addEventListener("focus", handleAuthChange);

    return () => {
      isActive = false;
      window.removeEventListener(USER_AUTH_CHANGED_EVENT, handleAuthChange);
      window.removeEventListener("storage", handleAuthChange);
      window.removeEventListener("focus", handleAuthChange);
    };
  }, []);

  function handleLogout() {
    clearUserToken();
    setSession(null);
    if (pathname === "/profile") {
      router.push("/login");
    }
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="site-header-inner mx-auto flex w-full max-w-6xl flex-col gap-3 px-3 py-3 sm:px-6 sm:py-4 md:flex-row md:items-center md:justify-between">
        <Link href="/" className="flex min-w-0 items-center md:max-w-[280px]">
          <span className="min-w-0">
            <span className="block text-sm font-semibold leading-6 text-slate-950 sm:text-base">
              Student Writing Helper
            </span>
            <span className="block text-xs text-slate-500">
              Rewrite, save, and review your assignment text
            </span>
          </span>
        </Link>

        <nav className="site-header-nav grid w-full grid-cols-3 gap-1 sm:flex sm:flex-wrap sm:items-center md:w-auto md:justify-end" aria-label="Main navigation">
          <Link href="/" className={navLinkClass}>
            Rewrite
          </Link>
          <Link href="/dashboard" className={navLinkClass}>
            Dashboard
          </Link>
          <Link href="/history" className={navLinkClass}>
            History
          </Link>
          <Link href="/about" className={navLinkClass}>
            About
          </Link>

          {!isCheckingSession && session ? (
            <>
              <Link href="/profile" className={`${navLinkClass} max-w-[180px]`}>
                {session.displayName}
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className={navLinkClass}
              >
                <FontAwesomeIcon icon={faRightFromBracket} className="h-4 w-4" aria-hidden="true" />
                Logout
              </button>
            </>
          ) : (
            !isCheckingSession && (
              <>
                <Link href="/login" className={navLinkClass}>
                  <FontAwesomeIcon icon={faRightToBracket} className="h-4 w-4" aria-hidden="true" />
                  Login
                </Link>
                <Link href="/register" className={navLinkClass}>
                  <FontAwesomeIcon icon={faUserPlus} className="h-4 w-4" aria-hidden="true" />
                  Register
                </Link>
              </>
            )
          )}
        </nav>
      </div>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-3 py-4 text-sm text-slate-500 sm:px-6 md:flex-row md:items-center md:justify-between">
        <span>© 2026 Keshab Amgain. All rights reserved.</span>
        <Link
          href="/admin"
          className="inline-flex h-9 items-center rounded-md px-3 font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
        >
          Admin login
        </Link>
      </div>
    </footer>
  );
}
