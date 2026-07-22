"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSpinner,
  faTriangleExclamation,
} from "@fortawesome/free-solid-svg-icons";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { getUserSession } from "@/lib/api";
import { createBasicToken, saveUserToken } from "@/lib/auth";

export function LoginPageClient() {
  const router = useRouter();
  const [username, setUsername] = useState("student");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedUsername = username.trim();

    if (!trimmedUsername || !password) {
      setError("Enter username and password.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const token = createBasicToken(trimmedUsername, password);
      await getUserSession(token);
      saveUserToken(token);
      router.push("/profile");
    } catch (loginError) {
      setError(
        loginError instanceof Error ? loginError.message : "Login failed.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-89px)] w-full max-w-md items-center px-4 py-8">
      <section className="w-full rounded-md border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-5">
          <h1 className="text-xl font-semibold text-slate-950">Login</h1>
          <p className="mt-1 text-sm text-slate-600">Use your student account.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-5">
          <div>
            <label htmlFor="login-username" className="text-sm font-medium text-slate-800">
              Username
            </label>
            <input
              id="login-username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
              autoComplete="username"
            />
          </div>

          <div>
            <label htmlFor="login-password" className="text-sm font-medium text-slate-800">
              Password
            </label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
              autoComplete="current-password"
              placeholder="student123"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              <FontAwesomeIcon icon={faTriangleExclamation} className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? (
              <FontAwesomeIcon icon={faSpinner} className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : null}
            {isSubmitting ? "Signing in" : "Sign in"}
          </button>

          <p className="text-center text-sm text-slate-600">
            New student?{" "}
            <Link href="/register" className="font-semibold text-slate-900 hover:underline">
              Create account
            </Link>
          </p>
        </form>
      </section>
    </main>
  );
}
