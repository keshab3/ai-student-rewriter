import { ContactMessageInput, ContactMessageResponse } from "@/lib/api";

const GUEST_CONTACT_MESSAGES_STORAGE_KEY = "ai-student-rewriter-guest-contact-messages";

export function addGuestContactMessage(
  input: ContactMessageInput,
): ContactMessageResponse {
  const saved = {
    ...input,
    id: Date.now(),
    createdAt: new Date().toISOString(),
  };
  const current = readGuestContactMessages();
  window.localStorage.setItem(
    GUEST_CONTACT_MESSAGES_STORAGE_KEY,
    JSON.stringify([saved, ...current]),
  );
  return saved;
}

export function readGuestContactMessages(): ContactMessageResponse[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(GUEST_CONTACT_MESSAGES_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as ContactMessageResponse[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
