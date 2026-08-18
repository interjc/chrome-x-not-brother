import type { ObservationDraft, ObservationSummary, UserRecord } from "./types";

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

export type RuntimeMessage =
  | UpsertObservationsMessage
  | OpenDashboardMessage
  | GetSummaryMessage
  | LookupUsersMessage
  | OpenSidePanelMessage
  | DataChangedMessage;
