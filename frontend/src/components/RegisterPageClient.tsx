"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSpinner,
  faTriangleExclamation,
} from "@fortawesome/free-solid-svg-icons";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { registerUser } from "@/lib/api";
import { createBasicToken, saveUserToken } from "@/lib/auth";

export function RegisterPageClient() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedUsername = username.trim();

    if (!trimmedUsername || !password || !displayName.trim() || !fullName.trim() || !email.trim()) {
      setError("Complete all fields.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await registerUser({
        username: trimmedUsername,
        password,
        displayName: displayName.trim(),
        fullName: fullName.trim(),
        email: email.trim(),
      });
      saveUserToken(createBasicToken(trimmedUsername, password));
      router.push("/profile");
    } catch (registerError) {
      setError(
        registerError instanceof Error
          ? registerError.message
          : "Registration failed.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-89px)] w-full max-w-2xl items-center px-4 py-8">
      <section className="w-full rounded-md border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-5">
          <h1 className="text-xl font-semibold text-slate-950">Register</h1>
          <p className="mt-1 text-sm text-slate-600">Create a student account.</p>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-4 px-5 py-5 sm:grid-cols-2">
          <TextField id="register-username" label="Username" value={username} onChange={setUsername} autoComplete="username" />
          <TextField id="register-password" label="Password" value={password} onChange={setPassword} type="password" autoComplete="new-password" />
          <TextField id="register-display-name" label="Display name" value={displayName} onChange={setDisplayName} />
          <TextField id="register-full-name" label="Full name" value={fullName} onChange={setFullName} />
          <div className="sm:col-span-2">
            <TextField id="register-email" label="Email" value={email} onChange={setEmail} type="email" autoComplete="email" />
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 sm:col-span-2">
              <FontAwesomeIcon icon={faTriangleExclamation} className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
            <Link href="/login" className="text-sm font-semibold text-slate-900 hover:underline">
              Already registered
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? (
                <FontAwesomeIcon icon={faSpinner} className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : null}
              {isSubmitting ? "Creating" : "Create account"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
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
        autoComplete={autoComplete}
      />
    </div>
  );
}
