import type {
  AdOriginal,
  CreatePaymentResponse,
  DashboardResponse,
  ExcelUploadResponse,
  ExportRequest,
  FunnelMetricsResponse,
  ImproveAllResponse,
  JobCreatedResponse,
  JobState,
  JobStateResponse,
  Me,
  PaidPlanId,
  PaymentStatusResponse,
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

export async function createExcelJob(file: File): Promise<JobCreatedResponse> {
  const form = new FormData();
  form.append("file", file);

  const response = await fetch(`${API_BASE}/excel/jobs`, {
    method: "POST",
    credentials: "include",
    body: form,
  });
  if (!response.ok) await raise(response);
  return (await response.json()) as JobCreatedResponse;
}

export async function fetchExcelJob(jobId: string): Promise<JobStateResponse> {
  const response = await fetch(`${API_BASE}/excel/jobs/${encodeURIComponent(jobId)}`, {
    credentials: "include",
  });
  if (!response.ok) await raise(response);
  return (await response.json()) as JobStateResponse;
}

/**
 * Submit file, poll every second until done/failed (or timeout).
 * `onState` fires on every state transition, so the UI can show
 * "queued" vs "running" copy without owning the polling loop.
 */
export async function uploadExcelViaJob(
  file: File,
  onState?: (state: JobState) => void,
): Promise<ExcelUploadResponse> {
  const created = await createExcelJob(file);
  onState?.(created.state);

  const startedAt = Date.now();
  const timeoutMs = 3 * 60 * 1000;
  const intervalMs = 1000;
  let lastState: JobState = created.state;

  while (true) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new ApiError(504, "job_timeout");
    }
    await new Promise((r) => setTimeout(r, intervalMs));
    const poll = await fetchExcelJob(created.job_id);
    if (poll.state !== lastState) {
      lastState = poll.state;
      onState?.(poll.state);
    }
    if (poll.state === "done" && poll.result) {
      return poll.result;
    }
    if (poll.state === "failed") {
      throw new ApiError(500, poll.error ?? "job_failed");
    }
  }
}

export async function improveAll(
  ads: AdOriginal[],
): Promise<ImproveAllResponse> {
  const response = await fetch(`${API_BASE}/excel/improve-all`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ads }),
  });
  if (!response.ok) await raise(response);
  return (await response.json()) as ImproveAllResponse;
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

export async function createPayment(
  plan: PaidPlanId,
): Promise<CreatePaymentResponse> {
  const response = await fetch(`${API_BASE}/billing/create-payment`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan }),
  });
  if (!response.ok) await raise(response);
  return (await response.json()) as CreatePaymentResponse;
}

export async function fetchPaymentStatus(
  paymentId: string,
): Promise<PaymentStatusResponse> {
  const response = await fetch(
    `${API_BASE}/billing/status/${encodeURIComponent(paymentId)}`,
    { credentials: "include" },
  );
  if (!response.ok) await raise(response);
  return (await response.json()) as PaymentStatusResponse;
}

export async function fetchAdminMetrics(): Promise<FunnelMetricsResponse> {
  const response = await fetch(`${API_BASE}/admin/metrics`, {
    credentials: "include",
  });
  if (!response.ok) await raise(response);
  return (await response.json()) as FunnelMetricsResponse;
}

export async function fetchMe(): Promise<Me> {
  const response = await fetch(`${API_BASE}/auth/me`, {
    credentials: "include",
  });
  if (!response.ok) await raise(response);
  return (await response.json()) as Me;
}

export async function logout(): Promise<void> {
  const response = await fetch(`${API_BASE}/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
  if (!response.ok && response.status !== 401) await raise(response);
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
