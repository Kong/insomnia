import type { Locator } from "@playwright/test";
import { expect } from "@playwright/test";
import type {
  AuthTypeOAuth1,
  AuthTypeOAuth2,
} from "insomnia-data";
import type { OAuth1SignatureMethod } from "insomnia-data/common";

import { AuthType } from "../enums/auth-type";
import { DEFAULT_TIMEOUT } from "../misc/fixtures";
import { BasePage } from "./base.page";

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
const OAUTH2_FETCH_TIMEOUT = 15 * 1000;

/**
 * Shared Auth-tab logic for any page that renders the same Auth tab
 * component — currently `RequestPage` (HTTP/GraphQL/gRPC/... requests) and
 * `FolderPage` (a Collection folder's own settings tab, opened via its
 * "Open in New Tab" context-menu item). Subclasses only need to supply
 * `PANE`, the CSS selector for their tab's outer container.
 */
export abstract class AuthTabPage extends BasePage {
  protected abstract readonly PANE: string;

  protected get AUTH_TYPE_BUTTON(): string {
    return `${this.PANE} [aria-label="Change Authentication type"]`;
  }

  protected get TABPANEL(): string {
    return `${this.PANE} [role="tabpanel"]`;
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
    await this.page.waitForTimeout(300);
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
    await this.page
      .locator(this.TABPANEL)
      .getByRole("button", { name: "Clear", exact: true })
      .click();
    await this.page.waitForTimeout(500);
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
    await this.page.waitForTimeout(500);
    for (const [field, label] of Object.entries(OAUTH1_FIELD_LABELS)) {
      const value = fields[field as OAuth1TextField];
      if (value === undefined) continue;
      await this.setCodeMirrorValue(this.oAuth1FieldEditor(label), value);
      await this.page.waitForTimeout(500);
    }
    if (fields.signatureMethod) {
      await this.page
        .locator(this.TABPANEL)
        .locator("#Signature-Method")
        .selectOption(fields.signatureMethod);
      await this.page.waitForTimeout(500);
    }
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
    await this.page.waitForTimeout(500);

    if (fields.grantType) {
      await this.page
        .locator(this.TABPANEL)
        .locator("#Grant-Type")
        .selectOption(fields.grantType);
      await this.page.waitForTimeout(500);
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
      await this.setCodeMirrorValue(editor, value);
      await this.page.waitForTimeout(500);
    }

    if (fields.usePkce !== undefined) {
      await this.setToggle("Use-PKCE", fields.usePkce);
      if (fields.usePkce && fields.pkceMethod) {
        await this.page
          .locator(this.TABPANEL)
          .locator("#Code-Challenge-Method")
          .selectOption(fields.pkceMethod);
        await this.page.waitForTimeout(500);
      }
    }
    if (fields.useDefaultBrowser !== undefined) {
      await this.setToggle("Using-default-browser", fields.useDefaultBrowser);
    }
    if (fields.responseType) {
      const select = this.page.locator(this.TABPANEL).locator("#Response-Type");
      if (await select.count()) {
        await select.selectOption(fields.responseType);
        await this.page.waitForTimeout(500);
      }
    }
    if (fields.credentialsInBody !== undefined) {
      await this.page
        .locator(this.TABPANEL)
        .locator("#Credentials")
        .selectOption(fields.credentialsInBody ? "true" : "false");
      await this.page.waitForTimeout(500);
    }
  }

  /**
   * Clicks the tab within this page's pane identified by its data-key.
   * @param tab - The data-key of the tab to switch to
   */
  protected async switchTab(tab: string): Promise<void> {
    await this.page
      .locator(`${this.PANE} [data-key="${tab}"][role="tab"]`)
      .click();
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
      await this.page.waitForTimeout(300);
    }
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
