// Shared TypeScript shapes for the ДОЖИМ-АЙ app.

export type PlanId = "free" | "pro" | "agency";
export type PaidPlanId = "pro" | "agency";

export interface UserOut {
  id: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
  is_verified: boolean;
  plan: PlanId;
  ai_ads_used_lifetime: number;
}

export type Me = UserOut;

export interface Limits {
  plan: string;
  uploads: number | null;
  ai_ads: number | null;
  max_ads_per_upload: number;
  watermark: boolean;
}

export interface Usage {
  uploads_used: number;
  ai_ads_used: number;
  ai_ads_remaining: number | null;
}

export interface HistoryEntry {
  id: string;
  agent_id: string;
  agent_name: string;
  status: string;
  findings: number;
  applied: number;
  started_at: string;
  finished_at: string | null;
}

export interface HistoryTotals {
  active_agents: number;
  runs: number;
  applied: number;
  pending: number;
}

export interface DashboardResponse {
  plan: string;
  limits: Limits;
  usage: Usage;
  totals: HistoryTotals;
  history: HistoryEntry[];
  history_days: number | null;
}

export interface PlanInfo {
  id: PlanId;
  label: string;
  price_rub: number;
  uploads_per_month: number | null;
  max_ads_per_upload: number;
  ai_ads_per_period: number | null;
  watermark: boolean;
}

export interface PlansResponse {
  plans: PlanInfo[];
}

export interface CreatePaymentResponse {
  payment_id: string;
  confirmation_url: string;
  status: "pending" | "succeeded" | "failed" | "canceled";
}

export interface PaymentStatusResponse {
  id: string;
  plan: PaidPlanId;
  amount: number;
  currency: string;
  status: "pending" | "succeeded" | "failed" | "canceled";
  created_at: string;
  paid_at: string | null;
}

export interface Project {
  id: string;
  name: string;
  archived_at: string | null;
  created_at: string;
}

export interface ProjectListResponse {
  projects: Project[];
}

export interface AdAccount {
  id: string;
  project_id: string;
  provider: "yandex_direct";
  external_id: string;
  status: "active" | "expired" | "revoked" | "error";
  expires_at: string | null;
  created_at: string;
}

export interface OAuthStartResponse {
  url: string;
  stub: boolean;
}

export type AgentMode = "advisor" | "assistant" | "auto";
export type AgentStatus = "draft" | "active" | "paused" | "archived";

export interface AgentBrief {
  url?: string;
  niche?: string;
  audience?: string;
  geo?: string;
  notes?: string;
}

export interface AgentKpi {
  cpa?: number;
  ctr?: number;
  romi?: number;
  budget?: number;
  goal?: string;
}

export interface Agent {
  id: string;
  project_id: string;
  name: string;
  mode: AgentMode;
  status: AgentStatus;
  brief: AgentBrief;
  kpi: AgentKpi;
  ad_account_ids: string[];
  last_run_at: string | null;
  next_run_at: string | null;
  created_at: string;
}

export interface AgentListResponse {
  agents: Agent[];
}

export interface AgentCreatePayload {
  project_id: string;
  name: string;
  mode: AgentMode;
  brief: AgentBrief;
  kpi: AgentKpi;
  ad_account_ids: string[];
}

export interface AgentPatchPayload {
  name?: string;
  mode?: AgentMode;
  brief?: AgentBrief;
  kpi?: AgentKpi;
  ad_account_ids?: string[];
}

export interface Run {
  id: string;
  agent_id: string;
  status: "running" | "succeeded" | "failed" | "canceled";
  started_at: string;
  finished_at: string | null;
  stats: Record<string, unknown>;
  error: string | null;
}

export interface RunListResponse {
  runs: Run[];
}

export interface Finding {
  id: string;
  run_id: string;
  agent_id: string;
  kind: "issue" | "opportunity" | "applied";
  severity: "critical" | "warning" | "info" | "opportunity";
  campaign_external_id: string | null;
  ad_external_id: string | null;
  title: string;
  effect: string | null;
  suggested_action: Record<string, unknown> | null;
  confidence: number;
  state: "new" | "approved" | "applied" | "rejected";
  applied_at: string | null;
  created_at: string;
}

export interface FindingListResponse {
  findings: Finding[];
}

export interface FunnelMetricsResponse {
  signups: number;
  connectors: number;
  activators: number;
  payers: number;
  revenue_minor: number;
  connect_rate: number;
  activate_rate: number;
  pay_rate: number;
}

export interface AdminUserItem {
  id: string;
  email: string;
  full_name: string | null;
  plan: string;
  is_active: boolean;
  plan_expires_at: string | null;
  created_at: string;
}

export interface AdminUsersResponse {
  total: number;
  items: AdminUserItem[];
}

export interface AdminPaymentItem {
  id: string;
  user_email: string;
  plan: string;
  amount: number;
  currency: string;
  status: string;
  provider: string;
  created_at: string;
  paid_at: string | null;
}

export interface AdminPaymentsResponse {
  total: number;
  items: AdminPaymentItem[];
}
