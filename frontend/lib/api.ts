import type {
  DashboardResponse,
  ExcelUploadResponse,
  ExportRequest,
  PlansResponse,
  UpgradeIntentRequest,
  UpgradeIntentResponse,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

export class AuthError extends Error {
  constructor() {
    super("auth_required");
    this.name = "AuthError";
  }
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function raise(response: Response): Promise<never> {
  if (response.status === 401) throw new AuthError();
  let detail = `HTTP ${response.status}`;
  try {
    const body = await response.json();
    if (typeof body?.detail === "string") detail = body.detail;
  } catch {
    // ignore
  }
  throw new ApiError(response.status, detail);
}

export async function uploadExcel(file: File): Promise<ExcelUploadResponse> {
  const form = new FormData();
  form.append("file", file);

  const response = await fetch(`${API_BASE}/excel/upload`, {
    method: "POST",
    credentials: "include",
    body: form,
  });
  if (!response.ok) await raise(response);
  return (await response.json()) as ExcelUploadResponse;
}

export async function exportExcel(request: ExportRequest): Promise<Blob> {
  const response = await fetch(`${API_BASE}/excel/export`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!response.ok) await raise(response);
  return await response.blob();
}

export async function fetchDashboard(): Promise<DashboardResponse> {
  const response = await fetch(`${API_BASE}/dashboard`, {
    credentials: "include",
  });
  if (!response.ok) await raise(response);
  return (await response.json()) as DashboardResponse;
}

export async function fetchPlans(): Promise<PlansResponse> {
  const response = await fetch(`${API_BASE}/billing/plans`, {
    credentials: "include",
  });
  if (!response.ok) await raise(response);
  return (await response.json()) as PlansResponse;
}

export async function postUpgradeIntent(
  body: UpgradeIntentRequest,
): Promise<UpgradeIntentResponse> {
  const response = await fetch(`${API_BASE}/billing/upgrade-intent`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) await raise(response);
  return (await response.json()) as UpgradeIntentResponse;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
