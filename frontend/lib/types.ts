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
  token_limit: number;
  gross_margin: string;
  estimated_cogs_rub: number;
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

export interface TokenBalanceResponse {
  plan: PlanId;
  period: string;
  token_limit: number;
  tokens_used: number;
  bonus_tokens: number;
  tokens_remaining: number;
  usage_percent: number;
  warn_at_percent: number;
  limit_reached: boolean;
  period_ends_at: string | null;
}

export interface ReferralProgramResponse {
  code: string;
  invite_url: string;
  invited: number;
  activated: number;
  earned_tokens: number;
  pending_tokens: number;
}

export interface Referral {
  id: string;
  code: string;
  status: string;
  reward_tokens: number;
  created_at: string;
}

export interface CompetitorAnalyzePayload {
  query: string;
  region?: string;
  source?: string;
}

export interface CompetitorReport {
  id: string;
  query: string;
  region: string;
  source: string;
  results: Record<string, unknown>;
  created_at: string;
}

export interface CompetitorWatchPayload {
  name: string;
  domain: string;
  query: string;
  notes?: string | null;
  last_snapshot?: Record<string, unknown>;
}

export interface CompetitorWatch {
  id: string;
  name: string;
  domain: string;
  query: string;
  notes: string | null;
  active: boolean;
  last_snapshot: Record<string, unknown>;
  created_at: string;
}

export interface ImageBriefPayload {
  project_id?: string | null;
  site_url?: string | null;
  brand?: Record<string, unknown>;
  brief?: Record<string, unknown>;
}

export interface ImageBrief {
  id: string;
  project_id: string | null;
  site_url: string | null;
  status: string;
  brand: Record<string, unknown>;
  brief: Record<string, unknown>;
  generated_assets: unknown[];
  created_at: string;
  updated_at: string;
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

export interface AdminCrmLead {
  id: string;
  user_id: string | null;
  name: string | null;
  email: string | null;
  plan: string;
  source: string;
  status: string;
  score: number;
  next_action_at: string | null;
  meta: Record<string, unknown>;
}

export interface AdminCrmSegment {
  id: string;
  slug: string;
  title: string;
  color: string;
  sort_order: number;
  trigger_event: string;
  trigger_delay_minutes: number;
  auto_enabled: boolean;
  template: string;
  channels: Record<string, unknown>;
  lead_count: number;
  leads: AdminCrmLead[];
}

export interface AdminCrmOverviewResponse {
  segments: AdminCrmSegment[];
}

export interface AdminCrmTemplateUpdate {
  template: string;
  auto_enabled?: boolean;
  channels?: Record<string, unknown>;
}

export interface AdminBroadcastResult {
  segment_slug: string;
  queued: number;
  channels: Record<string, unknown>;
}

export interface FeedbackPayload {
  kind: string;
  title: string;
  body: string;
  rating?: number | null;
  source?: string;
  meta?: Record<string, unknown>;
}

export interface FeedbackItem {
  id: string;
  user_id: string | null;
  kind: string;
  rating: number | null;
  status: string;
  title: string;
  body: string;
  source: string;
  meta: Record<string, unknown>;
  created_at: string;
}

export interface ProductAgentRun {
  id: string;
  name: string;
  kind: string;
  status: string;
  schedule: string;
  started_at: string | null;
  finished_at: string | null;
  next_run_at: string | null;
  input_tokens: number;
  output_tokens: number;
  cost_minor: number;
  summary: string | null;
  error: string | null;
}

export interface AiUsageDay {
  day: string;
  provider: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_minor: number;
  budget_minor: number;
}

export interface AgentOpsResponse {
  runs: ProductAgentRun[];
  usage: AiUsageDay[];
  month_cost_minor: number;
  month_tokens: number;
  budget_minor: number;
  budget_used_pct: number;
  telegram_enabled: boolean;
  code_audit_schedule_days: number;
}

export interface PayrollEntry {
  id: string;
  period: string;
  employee_name: string;
  employee_email: string | null;
  role: string;
  hours: number;
  variable_minor: number;
  kpi_bonus_minor: number;
  total_minor: number;
  status: string;
}

export interface PayrollResponse {
  period: string;
  total_minor: number;
  entries: PayrollEntry[];
}
