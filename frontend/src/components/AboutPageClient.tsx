"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCircleCheck,
  faSpinner,
  faTriangleExclamation,
} from "@fortawesome/free-solid-svg-icons";
import { FormEvent, useEffect, useState } from "react";
import { sendContactMessage } from "@/lib/api";
import { readUserToken, USER_AUTH_CHANGED_EVENT } from "@/lib/auth";
import { addGuestContactMessage } from "@/lib/guestContactMessages";

export function AboutPageClient() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [authToken, setAuthToken] = useState<string | null>(() =>
    typeof window === "undefined" ? null : readUserToken(),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!name.trim() || !email.trim() || !subject.trim() || !message.trim()) {
      setError("Complete all contact fields.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const input = {
        name: name.trim(),
        email: email.trim(),
        subject: subject.trim(),
        message: message.trim(),
      };
      if (authToken) {
        await sendContactMessage(input, authToken);
      } else {
        addGuestContactMessage(input);
      }
      setName("");
      setEmail("");
      setSubject("");
      setMessage("");
      setSuccess(authToken ? "Message saved to database." : "Message saved in this browser.");
    } catch (contactError) {
      setError(
        contactError instanceof Error
          ? contactError.message
          : "Could not send message.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="page-shell">
      <section className="rounded-md border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-5">
          <h1 className="text-2xl font-semibold text-slate-950">About / Contact</h1>
          <p className="mt-1 text-sm text-slate-600">Student Writing Helper project</p>
        </div>

        <div className="grid gap-5 px-5 py-5 md:grid-cols-3">
          <section>
            <h2 className="font-medium text-slate-950">Purpose</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              This application helps students rewrite assignment text into clearer English while keeping the original meaning.
            </p>
          </section>
          <section>
            <h2 className="font-medium text-slate-950">Technology</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              The system uses Next.js, Kotlin Spring Boot, Spring Security, REST APIs, Hibernate/JPA, and MySQL.
            </p>
          </section>
          <section>
            <h2 className="font-medium text-slate-950">Roles</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Guests save data in this browser. Logged-in students save data to the database. Admins control rewrite prompts.
            </p>
          </section>
        </div>

        <div className="border-t border-slate-200 px-5 py-5">
          <h2 className="mb-4 font-medium text-slate-950">Contact</h2>

          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            <TextField id="contact-name" label="Name" value={name} onChange={setName} />
            <TextField id="contact-email" label="Email" value={email} onChange={setEmail} type="email" />
            <div className="sm:col-span-2">
              <TextField id="contact-subject" label="Subject" value={subject} onChange={setSubject} />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="contact-message" className="text-sm font-medium text-slate-800">
                Message
              </label>
              <textarea
                id="contact-message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={5}
                className="mt-2 w-full resize-y rounded-md border border-slate-300 px-3 py-2 text-sm leading-6 text-slate-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
              />
            </div>

            {error && <Status tone="error" message={error} />}
            {success && <Status tone="success" message={success} />}

            <div className="flex justify-end sm:col-span-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex h-11 w-full items-center justify-center rounded-md bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
              >
                {isSubmitting ? (
                  <FontAwesomeIcon icon={faSpinner} className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : null}
                {isSubmitting ? "Saving" : "Send message"}
              </button>
            </div>
          </form>
        </div>
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

function Status({ tone, message }: { tone: "error" | "success"; message: string }) {
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
