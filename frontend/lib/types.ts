// Matches backend/app/schemas/excel.py

export interface AdOriginal {
  row: number;
  campaign: string;
  group: string;
  headline: string;
  headline2: string | null;
  text: string;
  keywords: string[];
}

export interface AdAudit {
  score: number;
  issues: string[];
  suggestions: string[];
}

export interface AdImproved {
  headline: string;
  text: string;
  reasoning: string;
}

export interface AdResult {
  original: AdOriginal;
  audit: AdAudit;
  improved: AdImproved | null;
}

export interface CampaignSummary {
  name: string;
  groups: string[];
  ads_count: number;
}

export interface Summary {
  total_ads: number;
  total_campaigns: number;
  avg_score: number;
  improved_count: number;
  campaigns: CampaignSummary[];
}

export interface Insights {
  weak_ads_percent: number;
  estimated_ctr_loss: string;
}

export interface ParseError {
  row: number;
  field: string;
  message: string;
}

export type PlanId = "free" | "starter" | "pro";

export interface Limits {
  plan: PlanId;
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

export type PaywallTrigger =
  | "after_analysis"
  | "on_improve_all"
  | "on_upload_exhausted"
  | "on_ads_per_upload"
  | "on_export_over_limit";

export interface Paywall {
  trigger: PaywallTrigger;
  message: string;
  cta: string;
  upgrade_hint: string | null;
}

export interface CampaignIssue {
  key: string;
  label: string;
  count: number;
}

export type CampaignTone = "good" | "warn" | "bad";

export interface CampaignAnalytics {
  name: string;
  groups: string[];
  ads_count: number;
  improved_count: number;
  avg_score: number;
  weak_ads_percent: number;
  top_issues: CampaignIssue[];
  recommendations: string[];
  tone: CampaignTone;
}

export interface ExcelUploadResponse {
  summary: Summary;
  ads: AdResult[];
  errors: ParseError[];
  insights: Insights;
  plan: PlanId;
  limits: Limits;
  usage: Usage;
  paywall: Paywall | null;
  campaign_analytics: CampaignAnalytics[];
}

export interface UpgradeIntentRequest {
  plan: PlanId;
  trigger: string;
  context?: Record<string, string | number | boolean | null>;
}

export interface UpgradeIntentResponse {
  accepted: boolean;
  message: string;
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

export interface HistoryEntry {
  id: string;
  filename: string;
  total_ads: number;
  total_campaigns: number;
  improved_count: number;
  weak_ads_percent: number;
  avg_score: number;
  created_at: string;
}

export interface HistoryTotals {
  uploads: number;
  ads: number;
  improved: number;
  avg_score: number;
}

export interface DashboardResponse {
  plan: PlanId;
  limits: Limits;
  usage: Usage;
  totals: HistoryTotals;
  history: HistoryEntry[];
  history_days: number | null;
}

export interface AdForExport {
  campaign: string;
  group: string;
  headline: string;
  headline2: string | null;
  text: string;
  keywords: string[];
}

export interface ExportRequest {
  ads: AdForExport[];
  filename?: string;
}

export interface ImprovedAdRow {
  row: number;
  improved: AdImproved;
}

export type JobState = "queued" | "running" | "done" | "failed";

export interface JobCreatedResponse {
  job_id: string;
  state: JobState;
}

export interface JobStateResponse {
  job_id: string;
  state: JobState;
  result: ExcelUploadResponse | null;
  error: string | null;
}

export interface ImproveAllResponse {
  improved: ImprovedAdRow[];
  improved_count: number;
  requested_count: number;
  plan: PlanId;
  limits: Limits;
  usage: Usage;
  paywall: Paywall | null;
}

export type StartTone =
  | "neutral"
  | "friendly"
  | "confident"
  | "premium"
  | "playful";

export interface StartBrief {
  product: string;
  audience: string;
  region: string;
  keywords: string[];
  tone: StartTone;
  count: number;
}

export interface StartGeneratedAd {
  headline: string;
  headline2: string | null;
  text: string;
  keywords: string[];
  reasoning: string;
}

export interface StartGenerateResponse {
  ads: StartGeneratedAd[];
  requested_count: number;
  generated_count: number;
  plan: PlanId;
  limits: Limits;
  usage: Usage;
  paywall: Paywall | null;
}
