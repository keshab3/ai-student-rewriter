export const USER_TOKEN_STORAGE_KEY = "ai-student-rewriter-user-token";
export const USER_AUTH_CHANGED_EVENT = "ai-student-rewriter-user-auth-changed";

export function createBasicToken(username: string, password: string): string {
  return window.btoa(`${username}:${password}`);
}

export function readUserToken(): string | null {
  return window.localStorage.getItem(USER_TOKEN_STORAGE_KEY);
}

export function saveUserToken(token: string) {
  window.localStorage.setItem(USER_TOKEN_STORAGE_KEY, token);
  notifyUserAuthChanged();
}

export function clearUserToken() {
  window.localStorage.removeItem(USER_TOKEN_STORAGE_KEY);
  notifyUserAuthChanged();
}

function notifyUserAuthChanged() {
  window.dispatchEvent(new Event(USER_AUTH_CHANGED_EVENT));
}
