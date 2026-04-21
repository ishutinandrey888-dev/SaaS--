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

export interface ExcelUploadResponse {
  summary: Summary;
  ads: AdResult[];
  errors: ParseError[];
  insights: Insights;
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
