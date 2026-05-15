import type {
  AdAccount,
  Agent,
  AgentBrief,
  AgentCreatePayload,
  AgentKpi,
  AgentListResponse,
  AgentPatchPayload,
  CreatePaymentResponse,
  DashboardResponse,
  Finding,
  FindingListResponse,
  FunnelMetricsResponse,
  Me,
  OAuthStartResponse,
  PaidPlanId,
  PaymentStatusResponse,
  PlansResponse,
  ProjectListResponse,
  Project,
  Run,
  RunListResponse,
  AdminUsersResponse,
  AdminPaymentsResponse,
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
    /* ignore */
  }
  throw new ApiError(response.status, detail);
}

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, { credentials: "include" });
  if (!response.ok) await raise(response);
  return (await response.json()) as T;
}

async function send<T>(
  path: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<T> {
  const init: RequestInit = {
    method,
    credentials: "include",
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  };
  const response = await fetch(`${API_BASE}${path}`, init);
  if (!response.ok) {
    if (method === "DELETE" && response.status === 204) return undefined as T;
    await raise(response);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

// ---------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------
export async function fetchMe(): Promise<Me> {
  return get<Me>("/auth/me");
}

export async function logout(): Promise<void> {
  const response = await fetch(`${API_BASE}/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
  if (!response.ok && response.status !== 401) await raise(response);
}

export interface RegisterPayload {
  email: string;
  password: string;
  full_name?: string;
}

export async function register(payload: RegisterPayload): Promise<void> {
  const response = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) await raise(response);
}

export async function login(email: string, password: string): Promise<void> {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) await raise(response);
}

// ---------------------------------------------------------------------
// Dashboard / billing
// ---------------------------------------------------------------------
export async function fetchDashboard(): Promise<DashboardResponse> {
  return get<DashboardResponse>("/dashboard");
}

export async function fetchPlans(): Promise<PlansResponse> {
  return get<PlansResponse>("/billing/plans");
}

export async function createPayment(plan: PaidPlanId): Promise<CreatePaymentResponse> {
  return send<CreatePaymentResponse>("/billing/create-payment", "POST", { plan });
}

export async function fetchPaymentStatus(paymentId: string): Promise<PaymentStatusResponse> {
  return get<PaymentStatusResponse>(`/billing/status/${encodeURIComponent(paymentId)}`);
}

// ---------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------
export async function listProjects(): Promise<ProjectListResponse> {
  return get<ProjectListResponse>("/projects");
}

export async function createProject(name: string): Promise<Project> {
  return send<Project>("/projects", "POST", { name });
}

export async function archiveProject(projectId: string): Promise<void> {
  await send<void>(`/projects/${projectId}`, "DELETE");
}

// ---------------------------------------------------------------------
// Yandex Direct accounts
// ---------------------------------------------------------------------
export async function startYandexOAuth(projectId: string): Promise<OAuthStartResponse> {
  return get<OAuthStartResponse>(
    `/yandex/oauth/start?project_id=${encodeURIComponent(projectId)}`,
  );
}

export async function listAdAccounts(): Promise<AdAccount[]> {
  return get<AdAccount[]>("/yandex/ad-accounts");
}

export async function disconnectAdAccount(accountId: string): Promise<void> {
  await send<void>(`/yandex/ad-accounts/${accountId}`, "DELETE");
}

// ---------------------------------------------------------------------
// Agents
// ---------------------------------------------------------------------
export async function listAgents(): Promise<AgentListResponse> {
  return get<AgentListResponse>("/agents");
}

export async function createAgent(payload: AgentCreatePayload): Promise<Agent> {
  return send<Agent>("/agents", "POST", payload);
}

export async function patchAgent(
  agentId: string,
  payload: AgentPatchPayload,
): Promise<Agent> {
  return send<Agent>(`/agents/${agentId}`, "PATCH", payload);
}

export async function launchAgent(agentId: string): Promise<Agent> {
  return send<Agent>(`/agents/${agentId}/launch`, "POST");
}

export async function pauseAgent(agentId: string): Promise<Agent> {
  return send<Agent>(`/agents/${agentId}/pause`, "POST");
}

export async function runAgent(agentId: string): Promise<Agent> {
  return send<Agent>(`/agents/${agentId}/run`, "POST");
}

export async function listAgentRuns(agentId: string): Promise<RunListResponse> {
  return get<RunListResponse>(`/agents/${agentId}/runs`);
}

export async function listAgentFindings(agentId: string): Promise<FindingListResponse> {
  return get<FindingListResponse>(`/agents/${agentId}/findings`);
}

export async function approveFinding(findingId: string): Promise<Finding> {
  return send<Finding>(`/agents/findings/${findingId}/approve`, "POST");
}

export async function rejectFinding(findingId: string): Promise<Finding> {
  return send<Finding>(`/agents/findings/${findingId}/reject`, "POST");
}

// ---------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------
export async function fetchAdminMetrics(): Promise<FunnelMetricsResponse> {
  return get<FunnelMetricsResponse>("/admin/metrics");
}

export async function fetchAdminUsers(plan?: string): Promise<AdminUsersResponse> {
  const q = plan ? `?plan=${plan}` : "";
  return get<AdminUsersResponse>(`/admin/users${q}`);
}

export async function fetchAdminPayments(): Promise<AdminPaymentsResponse> {
  return get<AdminPaymentsResponse>("/admin/payments");
}

// Compatibility shim — wizard wants this name.
export type { AgentBrief, AgentKpi, Run };

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
