import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import {
  bundledDefaultFilterRuleJson,
  bundledDefaultFilterRuleSet,
  DEFAULT_FILTER_RULES_URL,
} from "../../domain/filter-rules-default";
import {
  createEmptyFilterRuleSet,
  FilterRuleValidationError,
  FilterRuleSetSchema,
  MAX_FILTER_RULES_JSON_BYTES,
  importFilterRuleSet,
  parseFilterRuleSetJson,
  type FilterRuleImportMode,
  serializeFilterRuleSet,
  type FilterRule,
  type FilterRuleSet,
  type FilterRuleType,
} from "../../domain/filter-rules";
import {
  fetchFilterRuleSet,
  FilterRuleImportError,
  resolveFilterRuleImportTarget,
  type FilterRuleImportErrorCode,
} from "../../domain/filter-rule-import";
import type { HideStats } from "../../domain/hide-stats";
import { translate, type AppLocale, type MessageKey } from "../../i18n";
import {
  getStoredFilterRuleSet,
  isFilterRulesStorageChange,
  saveFilterRuleSet,
} from "../../storage/filter-rules";
import { downloadFile } from "../format";
import { InterceptStats } from "./InterceptStats";

export const FILTER_RULES_EDITOR_HASH = "#filter-rules";

export function filterRulesEditorIsDirty(root: ParentNode = document): boolean {
  return root.querySelector("[data-filter-rules-dirty]") !== null;
}

export function confirmLeaveFilterRulesEditor(
  locale: AppLocale,
  root: ParentNode = document,
): boolean {
  if (!filterRulesEditorIsDirty(root)) return true;
  return window.confirm(translate(locale, "filterRulesUnsavedLeave"));
}

export function revealFilterRulesEditor(root: Document = document): boolean {
  const manager = root.getElementById("filter-rules");
  if (!manager) return false;
  if (manager instanceof HTMLDetailsElement) manager.open = true;
  manager.scrollIntoView?.({ block: "start" });
  manager.querySelector<HTMLElement>(
    manager instanceof HTMLDetailsElement ? "summary" : "[data-filter-rules-focus]",
  )?.focus({ preventScroll: true });
  return true;
}

const IMPORT_ERROR_KEYS: Record<FilterRuleImportErrorCode, MessageKey> = {
  "invalid-url": "filterRulesInvalidUrl",
  "permission-denied": "filterRulesPermissionDenied",
  "request-failed": "filterRulesRequestFailed",
  "response-too-large": "filterRulesTooLarge",
  "gist-file-ambiguous": "filterRulesGistAmbiguous",
  "gist-file-missing": "filterRulesGistMissing",
  "invalid-rules": "filterRulesInvalidImport",
};

function ruleId(): string {
  const random = globalThis.crypto?.randomUUID?.().replaceAll("-", "") ??
    Math.random().toString(36).slice(2);
  return `rule-${random.slice(0, 24)}`;
}

function newRule(type: FilterRuleType, label: string): FilterRule {
  const common = { id: ruleId(), label, enabled: true, expiresAt: null };
  if (type === "user_handles") return { ...common, type, handles: [] };
  return {
    ...common,
    type,
    match: { mode: "contains", value: "", caseSensitive: false },
  };
}

function withRule(ruleSet: FilterRuleSet, index: number, rule: FilterRule): FilterRuleSet {
  return {
    ...ruleSet,
    rules: ruleSet.rules.map((current, currentIndex) =>
      currentIndex === index ? rule : current),
  };
}

function changeRuleType(rule: FilterRule, type: FilterRuleType): FilterRule {
  const common = {
    id: rule.id,
    label: rule.label,
    enabled: rule.enabled,
    expiresAt: rule.expiresAt,
  };
  if (type === "user_handles") return { ...common, type, handles: [] };
  return {
    ...common,
    type,
    match: { mode: "contains", value: "", caseSensitive: false },
  };
}

function dateTimeLocalValue(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function expiryFromInput(value: string): string | null {
  if (!value) return null;
  return new Date(value).toISOString();
}

function issueText(error: FilterRuleValidationError, detail: string): string {
  const issue = error.issues[0];
  if (!issue) return detail;
  const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
  return `${path}${detail}`;
}

function localizedEmptyRuleSet(locale: AppLocale): FilterRuleSet {
  const empty = createEmptyFilterRuleSet();
  return { ...empty, name: translate(locale, "filterRulesDefaultName") };
}

export function FilterRulesManager({
  locale,
  enabled,
  disabled,
  standalone = false,
  compact = false,
  viewerHandle = null,
  hideStats = null,
  onEnabledChange,
}: {
  locale: AppLocale;
  enabled: boolean;
  disabled: boolean;
  standalone?: boolean;
  compact?: boolean;
  viewerHandle?: string | null;
  hideStats?: HideStats | null;
  onEnabledChange: (enabled: boolean) => void;
}) {
  const t = (key: MessageKey, values?: Record<string, string | number>) =>
    translate(locale, key, values);
  const [draft, setDraft] = useState<FilterRuleSet>(() => localizedEmptyRuleSet(locale));
  const [ready, setReady] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState("");
  const [remoteUrl, setRemoteUrl] = useState(DEFAULT_FILTER_RULES_URL);
  const [importPrompt, setImportPrompt] = useState<"file" | "url" | null>(null);
  const [importing, setImporting] = useState(false);
  const importModeRef = useRef<FilterRuleImportMode>("update");
  const [addType, setAddType] = useState<FilterRuleType>("user_handles");
  const manager = useRef<HTMLElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const dirtyRef = useRef(false);
  const localeRef = useRef(locale);
  const viewerHandleRef = useRef(viewerHandle);
  localeRef.current = locale;
  viewerHandleRef.current = viewerHandle;

  useEffect(() => {
    const revealFromHash = (): void => {
      if (window.location.hash !== FILTER_RULES_EDITOR_HASH || !manager.current) return;
      revealFilterRulesEditor();
    };
    revealFromHash();
    window.addEventListener("hashchange", revealFromHash);
    return () => window.removeEventListener("hashchange", revealFromHash);
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const setEditedDraft = (next: FilterRuleSet): void => {
    dirtyRef.current = true;
    setDirty(true);
    setDraft(next);
    setStatus("");
  };

  useEffect(() => {
    let active = true;
    const localT = (key: MessageKey): string => translate(localeRef.current, key);
    const load = async (): Promise<void> => {
      try {
        const stored = await getStoredFilterRuleSet(viewerHandleRef.current);
        if (!active) return;
        if (!stored) {
          const example = bundledDefaultFilterRuleSet;
          await saveFilterRuleSet(example, viewerHandleRef.current);
          if (!active) return;
          setDraft(example);
          dirtyRef.current = false;
          setDirty(false);
          setStatus(localT("filterRulesExampleLoaded"));
          return;
        }
        const next = stored.rules.length === 0 && stored.name === "My blacklist rules"
          ? localizedEmptyRuleSet(localeRef.current)
          : stored;
        setDraft(next);
        dirtyRef.current = false;
        setDirty(false);
      } catch {
        if (active) setStatus(localT("filterRulesStoredInvalid"));
      } finally {
        if (active) setReady(true);
      }
    };
    const onChanged = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ): void => {
      if (!active || !isFilterRulesStorageChange(changes, areaName, viewerHandleRef.current)) return;
      if (dirtyRef.current) {
        setStatus(localT("filterRulesExternalChange"));
        return;
      }
      void load();
    };
    chrome.storage.onChanged.addListener(onChanged);
    void load();
    return () => {
      active = false;
      chrome.storage.onChanged.removeListener(onChanged);
    };
  }, [viewerHandle]);

  const save = async (event?: FormEvent): Promise<void> => {
    event?.preventDefault();
    const result = FilterRuleSetSchema.safeParse(draft);
    if (!result.success) {
      const error = new FilterRuleValidationError("Invalid filter rule set.", result.error.issues);
      setStatus(t("filterRulesValidationFailed", {
        detail: issueText(error, t("filterRulesValidationDetail")),
      }));
      return;
    }
    try {
      const saved = await saveFilterRuleSet(result.data, viewerHandleRef.current);
      setDraft(saved);
      dirtyRef.current = false;
      setDirty(false);
      setStatus(t("filterRulesSaved"));
    } catch (error) {
      setStatus(t("filterRulesValidationFailed", {
        detail: t("filterRulesUnknownError"),
      }));
    }
  };

  const applyImported = async (
    incoming: FilterRuleSet,
    mode: FilterRuleImportMode,
  ): Promise<void> => {
    const saved = await saveFilterRuleSet(
      importFilterRuleSet(draft, incoming, mode),
      viewerHandleRef.current,
    );
    setDraft(saved);
    dirtyRef.current = false;
    setDirty(false);
    setStatus(t(
      mode === "replace" ? "filterRulesReplaced" : "filterRulesUpdated",
      { count: incoming.rules.length },
    ));
  };

  const importFailure = (error: unknown): void => {
    if (error instanceof FilterRuleImportError) {
      setStatus(t(IMPORT_ERROR_KEYS[error.code]));
      return;
    }
    if (error instanceof FilterRuleValidationError) {
      setStatus(t("filterRulesInvalidImport"));
      return;
    }
    setStatus(t("filterRulesInvalidImport"));
  };

  const importFile = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > MAX_FILTER_RULES_JSON_BYTES) {
      setStatus(t("filterRulesTooLarge"));
      return;
    }
    setImporting(true);
    try {
      await applyImported(parseFilterRuleSetJson(await file.text()), importModeRef.current);
    } catch (error) {
      importFailure(error);
    } finally {
      setImporting(false);
    }
  };

  const importRemote = async (): Promise<void> => {
    let target;
    try {
      target = resolveFilterRuleImportTarget(remoteUrl);
    } catch (error) {
      importFailure(error);
      return;
    }

    const permissionRequest = chrome.permissions.request({
      origins: target.permissionOrigins,
    });
    setImporting(true);
    try {
      if (!await permissionRequest) {
        throw new FilterRuleImportError("permission-denied", "Host access was not granted.");
      }
      await applyImported(await fetchFilterRuleSet(target), importModeRef.current);
    } catch (error) {
      importFailure(error);
    } finally {
      setImporting(false);
    }
  };

  const confirmImportMode = (mode: FilterRuleImportMode): void => {
    const pending = importPrompt;
    importModeRef.current = mode;
    setImportPrompt(null);
    if (pending === "file") {
      fileInput.current?.click();
      return;
    }
    if (pending === "url") void importRemote();
  };

  const exportRules = (): void => {
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      downloadFile(
        `not-brother-filter-rules-${stamp}.json`,
        serializeFilterRuleSet(draft),
        "application/json",
      );
      setStatus(t("filterRulesExported"));
    } catch (error) {
      importFailure(error);
    }
  };

  const clearRules = async (): Promise<void> => {
    if (!window.confirm(t("filterRulesClearConfirm"))) return;
    const empty = localizedEmptyRuleSet(locale);
    await saveFilterRuleSet(empty, viewerHandleRef.current);
    setDraft(empty);
    dirtyRef.current = false;
    setDirty(false);
    setStatus(t("filterRulesCleared"));
  };

  const body = (
    <div className="filter-rules-manager__body">
        <header>
          <div>
            <p className="eyebrow">FILTER RULES / JSON V1</p>
            {standalone ? (
              <h1 data-filter-rules-focus tabIndex={-1}>{t("filterRulesHeading")}</h1>
            ) : (
              <h2 data-filter-rules-focus tabIndex={-1}>{t("filterRulesHeading")}</h2>
            )}
            <p>{t("filterRulesIntro")}</p>
            <p className="filter-rules-manager__namespace">
              {viewerHandle
                ? t("filterRulesNamespace", { handle: viewerHandle.replace(/^@/, "") })
                : t("filterRulesNamespaceUnknown")}
            </p>
            {hideStats ? (
              <InterceptStats
                locale={locale}
                stats={hideStats}
                status={{
                  applying: enabled,
                  ruleCount: draft.rules.length,
                  activeRuleCount: draft.rules.filter((rule) => rule.enabled).length,
                }}
                variant="header"
              />
            ) : null}
          </div>
          <label className="filter-rules-manager__master">
            <input
              checked={enabled}
              disabled={disabled}
              onChange={(event) => onEnabledChange(event.target.checked)}
              type="checkbox"
            />
            <span>{t("hideByFilterRulesLabel")}</span>
          </label>
        </header>

        <details className="filter-rules-guide">
          <summary className="filter-rules-guide__heading">
            <p className="eyebrow">AUTHORING GUIDE / JSON V1</p>
            <h3 id="filter-rules-guide-heading">{t("filterRulesGuideHeading")}</h3>
            <p>{t("filterRulesGuideIntro")}</p>
          </summary>

          <ol className="filter-rules-guide__steps">
            <li>{t("filterRulesGuideStepChoose")}</li>
            <li>{t("filterRulesGuideStepMatch")}</li>
            <li>{t("filterRulesGuideStepSave")}</li>
            <li>{t("filterRulesGuideStepApply")}</li>
          </ol>

          <div className="filter-rules-guide__topics">
            <article>
              <h4>{t("filterRulesGuideHandlesHeading")}</h4>
              <p>{t("filterRulesGuideHandlesBody")}</p>
              <code>@alice, bob_123</code>
            </article>
            <article>
              <h4>{t("filterRulesGuideTextHeading")}</h4>
              <p>{t("filterRulesGuideTextBody")}</p>
              <code>giveaway</code>
            </article>
            <article>
              <h4>{t("filterRulesGuideRegexHeading")}</h4>
              <p>{t("filterRulesGuideRegexBody")}</p>
              <code>giveaway\s+(today|now)</code>
            </article>
            <article>
              <h4>{t("filterRulesGuideExpiryHeading")}</h4>
              <p>{t("filterRulesGuideExpiryBody")}</p>
            </article>
            <article>
              <h4>{t("filterRulesGuideImportHeading")}</h4>
              <p>{t("filterRulesGuideImportBody")}</p>
            </article>
            <article>
              <h4>{t("filterRulesGuidePrivacyHeading")}</h4>
              <p>{t("filterRulesGuidePrivacyBody")}</p>
            </article>
          </div>

          <div className="filter-rules-guide__json">
            <div>
              <h4>{t("filterRulesGuideJsonHeading")}</h4>
              <p>{t("filterRulesGuideJsonBody")}</p>
            </div>
            <pre tabIndex={0}><code>{bundledDefaultFilterRuleJson}</code></pre>
          </div>
        </details>

        <form
          className={`filter-rules-editor${dirty ? " is-dirty" : ""}`}
          onSubmit={(event) => void save(event)}
        >
          <div className="filter-rules-editor__meta">
            <label>
              <span>{t("filterRulesSetName")}</span>
              <input
                maxLength={120}
                value={draft.name}
                onChange={(event) => setEditedDraft({ ...draft, name: event.target.value })}
              />
            </label>
            <label>
              <span>{t("filterRulesSetDescription")}</span>
              <input
                maxLength={500}
                value={draft.description}
                onChange={(event) => setEditedDraft({ ...draft, description: event.target.value })}
              />
            </label>
          </div>

          <div className="filter-rule-list">
            {draft.rules.length === 0 ? (
              <p className="filter-rule-list__empty">{t("filterRulesEmpty")}</p>
            ) : null}
            {draft.rules.map((rule, index) => (
              <fieldset className="filter-rule-card" key={rule.id}>
                <legend>{t("filterRulesRuleNumber", { number: index + 1 })}</legend>
                <div className="filter-rule-card__top">
                  <label>
                    <span>{t("filterRulesRuleName")}</span>
                    <input
                      maxLength={120}
                      value={rule.label}
                      onChange={(event) => setEditedDraft(withRule(
                        draft,
                        index,
                        { ...rule, label: event.target.value },
                      ))}
                    />
                  </label>
                  <label>
                    <span>{t("filterRulesRuleType")}</span>
                    <select
                      value={rule.type}
                      onChange={(event) => setEditedDraft(withRule(
                        draft,
                        index,
                        changeRuleType(rule, event.target.value as FilterRuleType),
                      ))}
                    >
                      <option value="user_handles">{t("filterRulesTypeHandles")}</option>
                      <option value="display_name">{t("filterRulesTypeDisplayName")}</option>
                      <option value="content">{t("filterRulesTypeContent")}</option>
                    </select>
                  </label>
                </div>

                {rule.type === "user_handles" ? (
                  <label className="filter-rule-card__wide">
                    <span>{t("filterRulesHandles")}</span>
                    <textarea
                      rows={4}
                      value={rule.handles.join("\n")}
                      aria-describedby={`${rule.id}-handles-hint`}
                      onChange={(event) => setEditedDraft(withRule(draft, index, {
                        ...rule,
                        handles: event.target.value.split(/[\s,]+/).filter(Boolean),
                      }))}
                    />
                    <small id={`${rule.id}-handles-hint`}>{t("filterRulesHandlesHint")}</small>
                  </label>
                ) : (
                  <div className="filter-rule-card__match">
                    <label>
                      <span>{t("filterRulesMatchMode")}</span>
                      <select
                        value={rule.match.mode}
                        onChange={(event) => setEditedDraft(withRule(draft, index, {
                          ...rule,
                          match: { ...rule.match, mode: event.target.value as "contains" | "regex" },
                        }))}
                      >
                        <option value="contains">{t("filterRulesMatchContains")}</option>
                        <option value="regex">{t("filterRulesMatchRegex")}</option>
                      </select>
                    </label>
                    <label className="filter-rule-card__pattern">
                      <span>{t("filterRulesPattern")}</span>
                      <input
                        maxLength={256}
                        value={rule.match.value}
                        aria-describedby={`${rule.id}-pattern-hint`}
                        onChange={(event) => setEditedDraft(withRule(draft, index, {
                          ...rule,
                          match: { ...rule.match, value: event.target.value },
                        }))}
                      />
                      <small id={`${rule.id}-pattern-hint`}>
                        {t(rule.match.mode === "regex"
                          ? "filterRulesRegexHint"
                          : "filterRulesContainsHint")}
                      </small>
                    </label>
                    <label className="filter-rule-card__check">
                      <input
                        checked={rule.match.caseSensitive}
                        onChange={(event) => setEditedDraft(withRule(draft, index, {
                          ...rule,
                          match: { ...rule.match, caseSensitive: event.target.checked },
                        }))}
                        type="checkbox"
                      />
                      <span>{t("filterRulesCaseSensitive")}</span>
                    </label>
                  </div>
                )}

                <div className="filter-rule-card__footer">
                  <label className="filter-rule-card__check">
                    <input
                      checked={rule.enabled}
                      onChange={(event) => setEditedDraft(withRule(
                        draft,
                        index,
                        { ...rule, enabled: event.target.checked },
                      ))}
                      type="checkbox"
                    />
                    <span>{t("filterRulesRuleEnabled")}</span>
                  </label>
                  <label>
                    <span>{t("filterRulesExpiresAt")}</span>
                    <input
                      type="datetime-local"
                      value={dateTimeLocalValue(rule.expiresAt)}
                      onChange={(event) => setEditedDraft(withRule(
                        draft,
                        index,
                        { ...rule, expiresAt: expiryFromInput(event.target.value) },
                      ))}
                    />
                  </label>
                  <code title={t("filterRulesStableId")}>{rule.id}</code>
                  <button
                    className="danger-text"
                    type="button"
                    onClick={() => setEditedDraft({
                      ...draft,
                      rules: draft.rules.filter((_, currentIndex) => currentIndex !== index),
                    })}
                  >
                    {t("filterRulesRemoveRule")}
                  </button>
                </div>
              </fieldset>
            ))}
          </div>

          <div className="filter-rules-editor__actions">
            <div className="filter-rules-editor__compose">
              <label>
                <span>{t("filterRulesAddType")}</span>
                <select value={addType} onChange={(event) => setAddType(event.target.value as FilterRuleType)}>
                  <option value="user_handles">{t("filterRulesTypeHandles")}</option>
                  <option value="display_name">{t("filterRulesTypeDisplayName")}</option>
                  <option value="content">{t("filterRulesTypeContent")}</option>
                </select>
              </label>
              <button
                className="filter-rules-editor__add"
                type="button"
                onClick={() => setEditedDraft({
                  ...draft,
                  rules: [...draft.rules, newRule(addType, t("filterRulesNewRule"))],
                })}
              >
                {t("filterRulesAddRule")}
              </button>
            </div>
            <div className="filter-rules-editor__commit">
              {dirty ? (
                <span className="filter-rules-editor__unsaved">{t("filterRulesUnsavedHint")}</span>
              ) : null}
              <button
                className="primary-button"
                disabled={!ready || !dirty}
                type="submit"
              >
                {t("filterRulesSave")}
              </button>
            </div>
          </div>
        </form>

        <section className="filter-rules-import" aria-labelledby="filter-rules-import-heading">
          <div>
            <p className="eyebrow">IMPORT / EXPORT</p>
            <h3 id="filter-rules-import-heading">{t("filterRulesImportHeading")}</h3>
            <p>{t("filterRulesImportIntro")}</p>
          </div>
          <div className="filter-rules-import__buttons">
            <button disabled={dirty || importing} type="button" onClick={() => setImportPrompt("file")}>
              {t("filterRulesImportFile")}
            </button>
            <input
              ref={fileInput}
              className="visually-hidden"
              accept="application/json,.json"
              type="file"
              onChange={(event) => void importFile(event)}
            />
            <button disabled={importing} type="button" onClick={exportRules}>
              {t("filterRulesExport")}
            </button>
            <button className="danger-text" disabled={importing} type="button" onClick={() => void clearRules()}>
              {t("filterRulesClear")}
            </button>
          </div>
          <form
            className="filter-rules-import__url"
            onSubmit={(event) => {
              event.preventDefault();
              if (dirty || importing) return;
              setImportPrompt("url");
            }}
          >
            <label htmlFor="filter-rules-url">{t("filterRulesUrlLabel")}</label>
            <div>
              <input
                id="filter-rules-url"
                inputMode="url"
                placeholder={DEFAULT_FILTER_RULES_URL}
                type="url"
                required
                value={remoteUrl}
                onChange={(event) => setRemoteUrl(event.target.value)}
              />
              <button disabled={dirty || importing} type="submit">
                {importing ? t("filterRulesLoading") : t("filterRulesLoadUrl")}
              </button>
            </div>
            <small>
              {t("filterRulesRemotePrivacy")}
              {" "}
              <button
                className="filter-rules-import__example"
                type="button"
                onClick={() => setRemoteUrl(DEFAULT_FILTER_RULES_URL)}
              >
                {t("filterRulesUseExampleUrl")}
              </button>
            </small>
          </form>
          {importPrompt ? (
            <div
              aria-labelledby="filter-rules-import-ask"
              aria-modal="true"
              className="filter-rules-import-prompt"
              role="dialog"
            >
              <strong id="filter-rules-import-ask">{t("filterRulesImportAsk")}</strong>
              <p>{t("filterRulesImportAskBody")}</p>
              <div className="filter-rules-import-prompt__actions">
                <button type="button" onClick={() => confirmImportMode("update")}>
                  {t("filterRulesImportUpdate")}
                </button>
                <button
                  className="danger-text"
                  type="button"
                  onClick={() => confirmImportMode("replace")}
                >
                  {t("filterRulesImportReplace")}
                </button>
                <button type="button" onClick={() => setImportPrompt(null)}>
                  {t("filterRulesImportCancel")}
                </button>
              </div>
            </div>
          ) : null}
          {dirty ? <p className="filter-rules-import__dirty">{t("filterRulesSaveBeforeImport")}</p> : null}
        </section>

        <p className="filter-rules-status" role="status" aria-live="polite">{status}</p>
    </div>
  );

  if (standalone) {
    return (
      <section
        className={`filter-rules-manager filter-rules-manager--standalone${compact ? " filter-rules-manager--compact" : ""}`}
        data-filter-rules-dirty={dirty ? "true" : undefined}
        id="filter-rules"
        ref={(node) => { manager.current = node; }}
      >
        {body}
      </section>
    );
  }

  return (
    <details
      className={`filter-rules-manager${compact ? " filter-rules-manager--compact" : ""}`}
      data-filter-rules-dirty={dirty ? "true" : undefined}
      id="filter-rules"
      ref={(node) => { manager.current = node; }}
    >
      <summary>
        <span>
          <strong>{t("filterRulesTitle")}</strong>
          <small>{t("filterRulesCount", { count: draft.rules.length })}</small>
        </span>
        <em>{enabled ? t("filterRulesApplying") : t("filterRulesNotApplying")}</em>
      </summary>
      {body}
    </details>
  );
}
