export type RewriteMode =
  | "GRAMMAR_FIX"
  | "ACADEMIC_REWRITE"
  | "SIMPLE_REWRITE"
  | "SHORTER_VERSION"
  | "LONGER_VERSION"
  | "PARAPHRASE"
  | "LEVEL_1_ADVANCED"
  | "LEVEL_2_CLEAR"
  | "LEVEL_3_NATURAL"
  | "LEVEL_4_SIMPLE"
  | "LEVEL_5_BASIC";

export type RewriteModeOption = {
  value: RewriteMode;
  label: string;
  description: string;
};

export type PromptSetting = {
  mode: RewriteMode;
  label: string;
  description: string;
  promptInstruction: string;
  outputInstruction: string;
  enabled: boolean;
  updatedAt: string;
};

export type UserPromptSetting = {
  mode: RewriteMode;
  label: string;
  description: string;
  promptInstruction: string;
  outputInstruction: string;
  defaultPromptInstruction: string;
  defaultOutputInstruction: string;
  customized: boolean;
  updatedAt: string;
};

export type UpdatePromptSettingInput = {
  label: string;
  description: string;
  promptInstruction: string;
  outputInstruction: string;
  enabled: boolean;
};

export type UpdateUserPromptSettingInput = {
  promptInstruction: string;
  outputInstruction: string;
};

export type AdminSession = {
  username: string;
  roles: string[];
};

export type AdminAuditLog = {
  id: number;
  actorUsername: string | null;
  action: string;
  details: string;
  createdAt: string;
};

export type UserSession = {
  username: string;
  roles: string[];
  displayName: string;
};

export type ProfileResponse = {
  username: string;
  displayName: string;
  fullName: string;
  email: string;
  roles: string[];
  createdAt: string;
};

export type ContactMessageInput = {
  name: string;
  email: string;
  subject: string;
  message: string;
};

export type ContactMessageResponse = ContactMessageInput & {
  id: number;
  createdAt: string;
};

export type ExtractedTextResponse = {
  filename: string;
  text: string;
  characterCount: number;
};

export type RewriteEvaluationCheck = {
  no: number;
  check: string;
  whatToExamine: string;
  result: string;
};

export type RewriteEvaluationResponse = {
  checklist: RewriteEvaluationCheck[];
  scores: Record<string, number>;
  finalDecision: string;
  notes: string;
};

export type RewriteResponse = {
  id: number;
  originalText: string;
  rewrittenText: string;
  mode: RewriteMode;
  modeLabel: string;
  vocabularySuggestions: Record<string, string[]>;
  avoidWords: string[];
  matchedAvoidWords: string[];
  evaluation: RewriteEvaluationResponse | null;
  createdAt: string;
};

export type RewriteStatsResponse = {
  totalRewrites: number;
  recentRewrites: RewriteResponse[];
};

export type RegisterInput = {
  username: string;
  password: string;
  displayName: string;
  fullName: string;
  email: string;
};

export type UpdateProfileInput = {
  displayName: string;
  fullName: string;
  email: string;
};

export type UpdateRewriteInput = {
  originalText: string;
  rewrittenText: string;
  mode: RewriteMode;
  avoidWords?: string[];
  vocabularySuggestions?: Record<string, string[]>;
};

export type ApiErrorResponse = {
  status: number;
  error: string;
  message: string;
  timestamp: string;
};

export const REWRITE_MODES: RewriteModeOption[] = [
  {
    value: "GRAMMAR_FIX",
    label: "Grammar",
    description: "Fix grammar, punctuation, and capitalization.",
  },
  {
    value: "ACADEMIC_REWRITE",
    label: "Academic",
    description: "Use a more formal school-writing style.",
  },
  {
    value: "SIMPLE_REWRITE",
    label: "Simple",
    description: "Make the writing easier to understand.",
  },
  {
    value: "SHORTER_VERSION",
    label: "Shorter",
    description: "Keep only the most important points.",
  },
  {
    value: "LONGER_VERSION",
    label: "Longer",
    description: "Add clearer explanation and detail.",
  },
  {
    value: "PARAPHRASE",
    label: "Paraphrase",
    description: "Use different wording with the same meaning.",
  },
  {
    value: "LEVEL_1_ADVANCED",
    label: "Mode 1 - C1-C2 Advanced",
    description: "Precise vocabulary and controlled complex student sentences.",
  },
  {
    value: "LEVEL_2_CLEAR",
    label: "Mode 2 - B2-C1 Clear",
    description: "Strong readable academic wording without heavy density.",
  },
  {
    value: "LEVEL_3_NATURAL",
    label: "Mode 3 - B1-B2 Natural",
    description: "Normal assignment English with common academic words.",
  },
  {
    value: "LEVEL_4_SIMPLE",
    label: "Mode 4 - A2-B1 Simple",
    description: "Simple assignment English with short to medium sentences.",
  },
  {
    value: "LEVEL_5_BASIC",
    label: "Mode 5 - A1-A2 Basic",
    description: "Very simple words and short direct sentences.",
  },
];

export const SIMPLE_WRITING_MODES = new Set<RewriteMode>([
  "GRAMMAR_FIX",
  "ACADEMIC_REWRITE",
  "SIMPLE_REWRITE",
  "SHORTER_VERSION",
  "LONGER_VERSION",
  "PARAPHRASE",
]);

export const STUDENT_LEVEL_MODES = new Set<RewriteMode>([
  "LEVEL_1_ADVANCED",
  "LEVEL_2_CLEAR",
  "LEVEL_3_NATURAL",
  "LEVEL_4_SIMPLE",
  "LEVEL_5_BASIC",
]);

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080"
).replace(/\/$/, "");

async function parseError(response: Response): Promise<Error> {
  try {
    const body = (await response.json()) as Partial<ApiErrorResponse>;
    return new Error(body.message || `Request failed with ${response.status}`);
  } catch {
    return new Error(`Request failed with ${response.status}`);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  const isFormData = typeof FormData !== "undefined" && init?.body instanceof FormData;

  if (!isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers,
    });
  } catch {
    throw new Error(`Backend is not reachable at ${API_BASE_URL}. Start the backend server and try again.`);
  }

  if (!response.ok) {
    throw await parseError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function createRewrite(input: {
  text: string;
  mode: RewriteMode;
  avoidWords?: string[];
  promptInstruction?: string;
  outputInstruction?: string;
}, token?: string): Promise<RewriteResponse> {
  return request<RewriteResponse>("/api/rewrites", {
    method: "POST",
    headers: token ? authHeaders(token) : undefined,
    body: JSON.stringify(input),
  });
}

export function previewRewrite(input: {
  text: string;
  mode: RewriteMode;
  avoidWords?: string[];
  promptInstruction?: string;
  outputInstruction?: string;
}): Promise<RewriteResponse> {
  return request<RewriteResponse>("/api/rewrites/preview", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function listRewrites(token?: string): Promise<RewriteResponse[]> {
  return request<RewriteResponse[]>("/api/rewrites", {
    headers: token ? authHeaders(token) : undefined,
  });
}

export function listRewriteModes(): Promise<RewriteModeOption[]> {
  return request<RewriteModeOption[]>("/api/rewrites/modes");
}

export function getRewriteStats(token?: string): Promise<RewriteStatsResponse> {
  return request<RewriteStatsResponse>("/api/rewrites/stats", {
    headers: token ? authHeaders(token) : undefined,
  });
}

export function deleteRewrite(id: number, token?: string): Promise<void> {
  return request<void>(`/api/rewrites/${id}`, {
    method: "DELETE",
    headers: token ? authHeaders(token) : undefined,
  });
}

export function extractUploadedText(file: File): Promise<ExtractedTextResponse> {
  const formData = new FormData();
  formData.append("file", file);

  return request<ExtractedTextResponse>("/api/uploads/text", {
    method: "POST",
    body: formData,
  });
}

export function updateRewrite(
  id: number,
  input: UpdateRewriteInput,
  token?: string,
): Promise<RewriteResponse> {
  return request<RewriteResponse>(`/api/rewrites/${id}`, {
    method: "PUT",
    headers: token ? authHeaders(token) : undefined,
    body: JSON.stringify(input),
  });
}

export function listUserPromptSettings(token: string): Promise<UserPromptSetting[]> {
  return request<UserPromptSetting[]>("/api/user/prompt-settings", {
    headers: authHeaders(token),
  });
}

export function updateUserPromptSetting(
  token: string,
  mode: RewriteMode,
  input: UpdateUserPromptSettingInput,
): Promise<UserPromptSetting> {
  return request<UserPromptSetting>(`/api/user/prompt-settings/${mode}`, {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
}

function adminAuthHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Basic ${token}`,
  };
}

function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Basic ${token}`,
  };
}

export function registerUser(input: RegisterInput): Promise<UserSession> {
  return request<UserSession>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getUserSession(token: string): Promise<UserSession> {
  return request<UserSession>("/api/auth/me", {
    headers: authHeaders(token),
  });
}

export function getProfile(token: string): Promise<ProfileResponse> {
  return request<ProfileResponse>("/api/profile", {
    headers: authHeaders(token),
  });
}

export function updateProfile(
  token: string,
  input: UpdateProfileInput,
): Promise<ProfileResponse> {
  return request<ProfileResponse>("/api/profile", {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
}

export function sendContactMessage(
  input: ContactMessageInput,
  token?: string,
): Promise<ContactMessageResponse> {
  return request<ContactMessageResponse>("/api/contact", {
    method: "POST",
    headers: token ? authHeaders(token) : undefined,
    body: JSON.stringify(input),
  });
}

export function listContactMessages(token: string): Promise<ContactMessageResponse[]> {
  return request<ContactMessageResponse[]>("/api/admin/contact-messages", {
    headers: adminAuthHeaders(token),
  });
}

export function getAdminSession(token: string): Promise<AdminSession> {
  return request<AdminSession>("/api/admin/me", {
    headers: adminAuthHeaders(token),
  });
}

export function listPromptSettings(token: string): Promise<PromptSetting[]> {
  return request<PromptSetting[]>("/api/admin/prompt-settings", {
    headers: adminAuthHeaders(token),
  });
}

export function updatePromptSetting(
  token: string,
  mode: RewriteMode,
  input: UpdatePromptSettingInput,
): Promise<PromptSetting> {
  return request<PromptSetting>(`/api/admin/prompt-settings/${mode}`, {
    method: "PUT",
    headers: adminAuthHeaders(token),
    body: JSON.stringify(input),
  });
}

export function listAdminAuditLogs(token: string): Promise<AdminAuditLog[]> {
  return request<AdminAuditLog[]>("/api/admin/audit-logs", {
    headers: adminAuthHeaders(token),
  });
}
