import type { ObservationDraft, ObservationSummary, UserRecord } from "./types";
import type { FilterRuleSet } from "./filter-rules";
import type { FilterRuleSetStatus } from "./filter-rule-matching";

export interface UpsertObservationsMessage {
  type: "observations:upsert";
  observations: ObservationDraft[];
  viewerHandle: string | null;
}

export interface UpsertObservationsResponse {
  ok: true;
  users: UserRecord[];
}

export interface OpenDashboardMessage {
  type: "dashboard:open";
  section?: "filter-rules";
}

export interface DataChangedMessage {
  type: "data:changed";
}

export interface GetSummaryMessage {
  type: "summary:get";
}

export interface GetSummaryResponse {
  ok: true;
  summary: ObservationSummary;
}

export interface LookupUsersMessage {
  type: "users:lookup";
  userKeys: string[];
}

export interface LookupUsersResponse {
  ok: true;
  users: UserRecord[];
}

export interface OpenSidePanelMessage {
  type: "sidepanel:open";
}

export interface OpenSidePanelResponse {
  ok: boolean;
  error?: string;
}

export interface GetFilterRulesMessage {
  type: "filter-rules:get";
  viewerHandle?: string | null;
}

export interface GetFilterRulesResponse {
  ok: true;
  ruleSet: FilterRuleSet;
}

export interface GetFilterRulesStatusMessage {
  type: "filter-rules:status";
  viewerHandle?: string | null;
}

export interface GetFilterRulesStatusResponse {
  ok: true;
  status: FilterRuleSetStatus;
}

export interface QuickAddFilterRuleMessage {
  type: "filter-rules:quick-add";
  kind: "handle" | "content";
  value: string;
  viewerHandle?: string | null;
}

export interface QuickAddFilterRuleResponse {
  ok: true;
  added: boolean;
  kind: "handle" | "content";
  value: string;
  enabledHiding: boolean;
  status: FilterRuleSetStatus;
}

export type RuntimeMessage =
  | UpsertObservationsMessage
  | OpenDashboardMessage
  | GetSummaryMessage
  | LookupUsersMessage
  | GetFilterRulesMessage
  | GetFilterRulesStatusMessage
  | QuickAddFilterRuleMessage
  | OpenSidePanelMessage
  | DataChangedMessage;
