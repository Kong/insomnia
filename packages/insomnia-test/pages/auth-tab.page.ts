import type { Locator } from "@playwright/test";
import { expect } from "@playwright/test";
import type {
  AuthTypeOAuth1,
  AuthTypeOAuth2,
} from "insomnia-data";
import type { OAuth1SignatureMethod } from "insomnia-data/common";

import { AuthType } from "../enums/auth-type";
import { ACTION_TIMEOUT, DEFAULT_TIMEOUT } from "../misc/constants";
import { TabPanelPage } from "./tab-panel.page";

type OAuth1TextField = keyof Omit<
  AuthTypeOAuth1,
  "type" | "disabled" | "signatureMethod" | "privateKey" | "includeBodyHash"
>;

const OAUTH1_FIELD_LABELS: Record<OAuth1TextField, string> = {
  consumerKey: "Consumer Key",
  consumerSecret: "Consumer Secret",
  tokenKey: "Token Key",
  tokenSecret: "Token Secret",
  callback: "Callback URL",
  version: "Version",
  timestamp: "Timestamp",
  realm: "Realm",
  nonce: "Nonce",
  verifier: "Verifier",
};

type OAuth2TextField = keyof Pick<
  AuthTypeOAuth2,
  | "authorizationUrl"
  | "accessTokenUrl"
  | "clientId"
  | "clientSecret"
  | "redirectUrl"
  | "username"
  | "password"
  | "scope"
  | "state"
  | "tokenPrefix"
  | "audience"
  | "resource"
  | "origin"
>;

const OAUTH2_FIELD_LABELS: Record<OAuth2TextField, string> = {
  authorizationUrl: "Authorization URL",
  accessTokenUrl: "Access Token URL",
  clientId: "Client ID",
  clientSecret: "Client Secret",
  redirectUrl: "Redirect URL",
  username: "Username",
  password: "Password",
  scope: "Scope",
  state: "State",
  tokenPrefix: "Header Prefix",
  audience: "Audience",
  resource: "Resource",
  origin: "Origin",
};

// These 6 fields (plus the "Credentials" dropdown) only render once the
// Auth tab's "Advanced Options" accordion is expanded — see
// expandOAuth2AdvancedOptions().
const OAUTH2_ADVANCED_FIELDS: OAuth2TextField[] = [
  "scope",
  "state",
  "tokenPrefix",
  "audience",
  "resource",
  "origin",
];

export interface OAuth2Tokens {
  refreshToken: string;
  identityToken: string;
  accessToken: string;
}

/**
 * The tokens display/actions block ("Fetch Tokens"/"Refresh Token", "Clear
 * OAuth 2 session") can take a few seconds to settle: Authorization Code
 * and Implicit grants round-trip through a popup authorization window
 * before the Access Token field populates.
 */
const OAUTH2_FETCH_TIMEOUT = ACTION_TIMEOUT;

// A request's auth lives on the Request document; a folder's own auth
// (inherited by its children) on the RequestGroup document.
const AUTH_DB_FILES = ["insomnia.Request.db", "insomnia.RequestGroup.db"];

// How long an edit gets to land on its own before it's re-applied: the
// Auth editors save through a debounce, so a just-made edit legitimately
// isn't on disk yet.
const AUTH_REAPPLY_AFTER_MS = 2000;

// How long the full set of edits must keep holding on disk before the
// form counts as done — long enough for any still-pending debounced save
// built from a stale auth config to have fired and landed.
const AUTH_SETTLE_MS = 2000;

/** One edited `authentication` field, plus how to repeat the edit if it gets lost. */
interface AuthFieldEdit {
  field: string;
  value: unknown;
  reapply?: () => Promise<void>;
}

/**
 * The Auth tab component, shared by any page that renders it — a
 * request's own pane (`RequestPage`, composing an instance as
 * `this.auth`) and a Folder's own settings tab (`FolderPage`, same).
 * Constructed with the owning page's `pane` selector (its tab-bar's outer
 * container), since that's the only thing that differs between them.
 */
export class AuthTabComponent extends TabPanelPage {
  protected get AUTH_TYPE_BUTTON(): string {
    return `${this.PANE} [aria-label="Change Authentication type"]`;
  }

  /**
   * Reads back the Refresh Token, Identity Token, and Access Token
   * fields shown below the Auth tab's OAuth 2.0 form. Empty strings mean
   * no token has been fetched yet.
   * @returns The currently stored OAuth 2.0 tokens
   */
  async getOAuth2Tokens(): Promise<OAuth2Tokens> {
    await this.switchTab("auth");
    return {
      refreshToken: await this.oauth2TokenInput("Refresh-Token").inputValue(),
      identityToken: await this.oauth2TokenInput("Identity-Token").inputValue(),
      accessToken: await this.oauth2TokenInput("Access-Token").inputValue(),
    };
  }

  /**
   * Expands the OAuth 2.0 Auth tab's "Advanced Options" accordion
   * (Scope/State/Credentials/Header Prefix/Audience/Resource/Origin,
   * plus the "Clear OAuth 2 session" button) if it isn't already open.
   * A no-op if some other auth type is selected.
   */
  private async expandOAuth2AdvancedOptions(): Promise<void> {
    const panel = this.page.locator(this.TABPANEL);
    if (await panel.locator("#Scope").count()) return;
    const button = panel.getByRole("button", { name: "Advanced Options" });
    if ((await button.count()) === 0) return;
    await button.click();
    await expect(panel.locator("#Scope + .CodeMirror")).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });
  }

  /**
   * Clicks the "Clear" button next to "Refresh Token"/"Fetch Tokens" —
   * only rendered once at least one token has been fetched — wiping the
   * Refresh/Identity/Access Token fields. Not to be confused with
   * "Advanced Options"' own "Clear OAuth 2 session" button, which resets
   * the embedded authorization popup's own browser session (cookies),
   * not the app's stored tokens.
   */
  async clearOAuth2Tokens(): Promise<void> {
    await this.switchTab("auth");
    const clearButton = this.page
      .locator(this.TABPANEL)
      .getByRole("button", { name: "Clear", exact: true });
    await clearButton.click();
    await expect(clearButton).toBeHidden({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Clicks the Auth tab's token-fetch button — labeled "Fetch Tokens"
   * before any token exists, "Refresh Token" once one does — and waits
   * for the Access Token field to be populated. For the Authorization
   * Code and Implicit grants this drives a real popup authorization
   * window (auto-approved by `misc/oauth2-server.js`, no interaction
   * needed here); for Client Credentials/Resource Owner Password/an
   * existing Refresh Token it resolves directly against the token
   * endpoint with no popup at all.
   */
  async fetchOAuth2Tokens(): Promise<void> {
    await this.switchTab("auth");
    const panel = this.page.locator(this.TABPANEL);
    // The button acts on the auth config in the request's loader data,
    // which refreshes a moment after the last edit lands on disk — drain
    // the renderer first so a fetch can't go out with the previous config.
    await this.waitForRendererIdle();
    await panel
      .getByRole("button", { name: /^(Fetch Tokens|Refresh Token)$/ })
      .click();
    await expect(this.oauth2TokenInput("Access-Token")).not.toHaveValue("", {
      timeout: OAUTH2_FETCH_TIMEOUT,
    });
  }

  /**
   * Switches to the Auth tab, opens the auth-type dropdown, and selects
   * the given type. Waits for the Auth Type button to reflect the
   * selection before returning, so a dropdown option that renders slow
   * (e.g. under heavy parallel load) fails fast here instead of a much
   * later, confusing timeout on a field the new auth type never
   * rendered.
   *
   * Retries the whole open-dropdown/click-option sequence (not just the
   * read-back check) on each attempt: under heavy parallel load the
   * option click can land while the listbox is present in the DOM but
   * not yet actually wired up, so it's silently swallowed and the button
   * text never changes no matter how long we wait on that same click -
   * only redoing the click fixes it.
   * @param type - The auth type to select
   */
  async setAuthType(type: AuthType): Promise<void> {
    await this.switchTab("auth");
    const button = this.page.locator(this.AUTH_TYPE_BUTTON);

    await expect(async () => {
      await this.page.keyboard.press("Escape");
      await button.click();
      await this.page.locator(`[role="option"][aria-label="${type}"]`).click();
      await expect(button).toContainText(type, { timeout: 2000 });
    }).toPass({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Sets the given OAuth 1.0 fields, switching the auth type to OAuth
   * 1.0 first. Fields left undefined are not written, leaving whatever
   * value is already there.
   * @param fields - The OAuth 1.0 fields to set
   */
  async setOAuth1Fields(fields: Partial<AuthTypeOAuth1>): Promise<void> {
    await this.setAuthType(AuthType.OAuth1);
    await expect(
      this.oAuth1FieldEditor(OAUTH1_FIELD_LABELS.consumerKey),
    ).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    const edits: AuthFieldEdit[] = [];
    for (const [field, label] of Object.entries(OAUTH1_FIELD_LABELS)) {
      const value = fields[field as OAuth1TextField];
      if (value === undefined) continue;
      const editor = this.oAuth1FieldEditor(label);
      const edit: AuthFieldEdit = {
        field,
        value,
        reapply: () => this.setCodeMirrorValue(editor, value),
      };
      await edit.reapply!();
      await this.waitForAuthFieldsPersisted([edit]);
      edits.push(edit);
    }
    if (fields.signatureMethod) {
      const signatureMethod = fields.signatureMethod;
      const selectMethod = () =>
        this.page
          .locator(this.TABPANEL)
          .locator("#Signature-Method")
          .selectOption(signatureMethod);
      await selectMethod();
      const edit: AuthFieldEdit = {
        field: "signatureMethod",
        value: signatureMethod,
        reapply: selectMethod,
      };
      await this.waitForAuthFieldsPersisted([edit]);
      edits.push(edit);
    }
    // A later field's debounced save can overwrite an earlier one from a
    // stale copy of the auth config, so confirm they all hold together.
    await this.waitForAuthFieldsPersisted(edits, AUTH_SETTLE_MS);
  }

  /**
   * Sets the given OAuth 2.0 fields, switching the auth type to OAuth
   * 2.0 first (and the grant type, if given, before anything else since
   * it controls which other rows even render). Fields left undefined
   * are not written. Advanced-Options-only fields (`scope`/`state`/
   * `tokenPrefix`/`audience`/`resource`/`origin`/`credentialsInBody`/
   * `responseType`) automatically expand that accordion first. A field
   * with no matching row for the currently selected grant type (e.g.
   * `username` under Client Credentials) is silently skipped rather
   * than hanging.
   * @param fields - The OAuth 2.0 fields to set
   */
  async setOAuth2Fields(fields: Partial<AuthTypeOAuth2>): Promise<void> {
    await this.setAuthType(AuthType.OAuth2);
    await expect(this.page.locator(this.TABPANEL).locator("#Grant-Type")).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });

    const edits: AuthFieldEdit[] = [];
    const selectOnTab = async (id: string, value: string) => {
      await this.page.locator(this.TABPANEL).locator(`#${id}`).selectOption(value);
    };
    const applySelect = async (
      field: string,
      id: string,
      value: string,
      stored: unknown = value,
    ) => {
      const edit: AuthFieldEdit = {
        field,
        value: stored,
        reapply: () => selectOnTab(id, value),
      };
      await edit.reapply!();
      await this.waitForAuthFieldsPersisted([edit]);
      edits.push(edit);
    };

    if (fields.grantType) {
      await applySelect("grantType", "Grant-Type", fields.grantType);
    }

    const needsAdvanced =
      fields.credentialsInBody !== undefined ||
      fields.responseType !== undefined ||
      OAUTH2_ADVANCED_FIELDS.some((field) => fields[field] !== undefined);
    if (needsAdvanced) await this.expandOAuth2AdvancedOptions();

    for (const [field, label] of Object.entries(OAUTH2_FIELD_LABELS)) {
      const value = fields[field as OAuth2TextField];
      if (value === undefined) continue;
      const editor = this.oauth2FieldEditor(label);
      if ((await editor.count()) === 0) continue;
      const edit: AuthFieldEdit = {
        field,
        value,
        reapply: () => this.setCodeMirrorValue(editor, value),
      };
      await edit.reapply!();
      await this.waitForAuthFieldsPersisted([edit]);
      edits.push(edit);
    }

    if (fields.usePkce !== undefined) {
      await this.setToggle("Use-PKCE", fields.usePkce);
      if (fields.usePkce && fields.pkceMethod) {
        await applySelect("pkceMethod", "Code-Challenge-Method", fields.pkceMethod);
      }
    }
    if (fields.useDefaultBrowser !== undefined) {
      await this.setToggle("Using-default-browser", fields.useDefaultBrowser);
    }
    if (
      fields.responseType &&
      (await this.page.locator(this.TABPANEL).locator("#Response-Type").count())
    ) {
      await applySelect("responseType", "Response-Type", fields.responseType);
    }
    if (fields.credentialsInBody !== undefined) {
      await applySelect(
        "credentialsInBody",
        "Credentials",
        fields.credentialsInBody ? "true" : "false",
        fields.credentialsInBody,
      );
    }

    // A later edit's debounced save can be built from a stale copy of the
    // auth config and silently drop an earlier field — each per-field wait
    // above passed at the time — so confirm every field holds together.
    await this.waitForAuthFieldsPersisted(edits, AUTH_SETTLE_MS);
  }

  /**
   * Reads a toggle button's on/off state from its inner icon's
   * `data-testid` ("toggle-is-on" vs "toggle-is-off").
   * @param id - The toggle button's element id
   * @returns Whether the toggle is currently on
   */
  private async isToggleOn(id: string): Promise<boolean> {
    return (
      (await this.page
        .locator(this.TABPANEL)
        .locator(`#${id} [data-testid="toggle-is-on"]`)
        .count()) > 0
    );
  }

  /**
   * Clicks a toggle button only if its current on/off state doesn't
   * already match `enabled`.
   * @param id - The toggle button's element id
   * @param enabled - The desired on/off state
   */
  private async setToggle(id: string, enabled: boolean): Promise<void> {
    if ((await this.isToggleOn(id)) !== enabled) {
      await this.page.locator(this.TABPANEL).locator(`#${id}`).click();
      await expect(async () => {
        expect(await this.isToggleOn(id)).toBe(enabled);
      }).toPass({ timeout: DEFAULT_TIMEOUT });
    }
  }

  /**
   * Polls the on-disk request/folder documents until one carries
   * `authentication[field] === value`, confirming the edit has actually
   * been saved (the editors autosave through a debounce) rather than just
   * shown in the UI.
   * @param field - The `authentication` property that was just edited
   * @param value - The value it must hold
   */
  private async waitForAuthFieldPersisted(
    field: string,
    value: unknown,
  ): Promise<void> {
    await this.waitForAuthFieldsPersisted([{ field, value }]);
  }

  /**
   * Polls the on-disk request/folder documents until a single one holds
   * every edit in `edits` at once. The app's debounced editors can save
   * from a stale copy of the auth config, so a write may never land, or
   * may drop a field persisted earlier; once an edit has had
   * `AUTH_REAPPLY_AFTER_MS` to land on its own, the edits still missing
   * from the closest-matching document are re-applied.
   * @param edits - The edited `authentication` fields and how to repeat each edit
   * @param settleMs - How long every edit must keep holding before returning, to outlast a late stale save
   */
  private async waitForAuthFieldsPersisted(
    edits: AuthFieldEdit[],
    settleMs = 0,
  ): Promise<void> {
    const start = Date.now();
    let lastReapply = start;
    let heldSince = 0;
    await expect(async () => {
      const docs = (
        await Promise.all(AUTH_DB_FILES.map((file) => this.readPersistedDocs(file)))
      ).flat();
      let missing = edits;
      for (const doc of docs) {
        const docMissing = edits.filter(
          (e) => String(doc.authentication?.[e.field]) !== String(e.value),
        );
        if (docMissing.length < missing.length) missing = docMissing;
      }
      if (missing.length === 0) {
        heldSince ||= Date.now();
        expect(Date.now() - heldSince).toBeGreaterThanOrEqual(settleMs);
        return;
      }
      heldSince = 0;
      if (Date.now() - lastReapply >= AUTH_REAPPLY_AFTER_MS) {
        lastReapply = Date.now();
        for (const edit of missing) await edit.reapply?.();
      }
      expect(missing.map((e) => e.field)).toEqual([]);
    }).toPass({ timeout: DEFAULT_TIMEOUT + settleMs, intervals: [250, 500] });
  }

  /**
   * Builds the locator for an OAuth 1.0 field's CodeMirror editor,
   * identified by the row's visible label (e.g. "Consumer Key" -> the
   * "consumer-key"-id textarea CodeMirror replaces).
   * @param label - The field's visible row label
   * @returns The CSS locator for that field's CodeMirror editor
   */
  private oAuth1FieldEditor(label: string): Locator {
    return this.page.locator(
      `${this.TABPANEL} #${label.replace(/ /g, "-")} + .CodeMirror`,
    );
  }

  /**
   * Builds the locator for an OAuth 2.0 field's CodeMirror editor,
   * identified by the row's visible label (e.g. "Client ID" -> the
   * "Client-ID"-id textarea CodeMirror replaces). Resolves to an empty
   * locator (`.count()` is 0) when the field's row isn't rendered for
   * the currently selected grant type or accordion state.
   * @param label - The field's visible row label
   * @returns The CSS locator for that field's CodeMirror editor
   */
  private oauth2FieldEditor(label: string): Locator {
    return this.page.locator(
      `${this.TABPANEL} #${label.replace(/ /g, "-")} + .CodeMirror`,
    );
  }

  /**
   * Builds the locator for one of the read-only Refresh/Identity/Access
   * Token inputs. These are plain `<input>` elements with no `id` of
   * their own — only their wrapping `<label>` carries a (dangling)
   * `for="Access-Token"`-style attribute — so they must be reached via
   * that label's child input, not a `#Access-Token` id selector.
   * @param id - The token's label `for` value, e.g. "Access-Token"
   * @returns The CSS locator for that token's input element
   */
  private oauth2TokenInput(id: string): Locator {
    return this.page.locator(`${this.TABPANEL} label[for="${id}"] input`);
  }
}
