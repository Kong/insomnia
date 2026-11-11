import { ToggleButtonComponent } from "@package/components/toggle.component";
import { AuthType } from "@package/enums/auth-type";
import { DEFAULT_TIMEOUT } from "@package/misc/constants";
import type { Locator } from "@playwright/test";
import { expect } from "@playwright/test";
import type {
  AuthTypeAPIKey,
  AuthTypeBasic,
  AuthTypeBearer,
  AuthTypeOAuth1,
  AuthTypeOAuth2,
  AuthTypeSingleToken,
} from "insomnia-data";

import { TabPanelComponent } from "./tab-panel.component";

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

// A request's auth lives on the Request document; a folder's own auth
// (inherited by its children) on the RequestGroup document.
const AUTH_DB_FILES = [
  "insomnia.Request.db",
  "insomnia.RequestGroup.db",
  "insomnia.WebSocketRequest.db",
  "insomnia.SocketIORequest.db",
  "insomnia.McpRequest.db",
];

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
export class AuthTabComponent extends TabPanelComponent {
  protected get AUTH_TYPE_BUTTON(): string {
    return `${this.PANE} [aria-label="Change Authentication type"]`;
  }

  /**
   * Expands the OAuth 2.0 Auth tab's "Advanced Options" accordion
   * (Scope/State/Credentials/Header Prefix/Audience/Resource/Origin,
   * plus the "Clear OAuth 2 session" button) if it isn't already open.
   * A no-op if some other auth type is selected.
   */
  private async expandOAuth2AdvancedOptions(): Promise<void> {
    const panel = this.page.locator(this.TABPANEL);
    if (await this.fieldByLabel("Scope").count()) return;
    const button = panel.getByRole("button", { name: "Advanced Options" });
    if ((await button.count()) === 0) return;
    await button.click();
    await expect(
      panel.getByTestId("auth-field-Scope").locator(".CodeMirror"),
    ).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
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
   * Reads the auth type shown by the Auth tab's type dropdown (e.g.
   * "OAuth 2.0", "API Key", "None").
   */
  async getAuthType(): Promise<string> {
    await this.switchTab("auth");
    const button = this.page.locator(this.AUTH_TYPE_BUTTON);
    await expect(button).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    return (await button.innerText()).trim();
  }

  /**
   * Reads back the OAuth 2.0 grant type and the URL, client ID and scope
   * fields currently shown. Fields that the selected grant type doesn't
   * render come back as `undefined`.
   */
  async getOAuth2Fields(): Promise<
    Partial<
      Pick<
        AuthTypeOAuth2,
        | "grantType"
        | "authorizationUrl"
        | "accessTokenUrl"
        | "clientId"
        | "scope"
      >
    >
  > {
    await this.switchTab("auth");
    await expect(this.fieldByLabel("Grant-Type")).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });
    await this.expandOAuth2AdvancedOptions();
    const read = async (label: string) => {
      const editor = this.oauth2FieldEditor(label);
      return (await editor.count()) === 0
        ? undefined
        : await this.readCodeMirror(editor);
    };
    return {
      grantType: (await this.fieldByLabel("Grant-Type").inputValue()) as
        | AuthTypeOAuth2["grantType"],
      authorizationUrl: await read("Authorization URL"),
      accessTokenUrl: await read("Access Token URL"),
      clientId: await read("Client ID"),
      scope: await read("Scope"),
    };
  }

  /**
   * Sets the Bearer Token's token, switching the auth type to Bearer
   * Token first.
   */
  async setBearerFields(fields: Partial<AuthTypeBearer>): Promise<void> {
    await this.setAuthType(AuthType.Bearer);
    await this.setTokenField(fields.token);
  }

  /**
   * Sets the single token's value, switching the auth type to the
   * single-token type (Socket.IO's only auth option) first.
   */
  async setSingleTokenFields(
    fields: Partial<AuthTypeSingleToken>,
  ): Promise<void> {
    await this.setAuthType(AuthType.Token);
    await this.setTokenField(fields.token);
  }

  /**
   * Switches the auth type to None and waits for it to be saved.
   */
  async setNoAuthentication(): Promise<void> {
    await this.setAuthType(AuthType.None);
    await this.waitForAuthFieldsPersisted(
      [{ field: "type", value: "none" }],
      AUTH_SETTLE_MS,
    );
  }

  /**
   * Sets the Basic auth username and password, switching the auth type
   * to Basic first.
   */
  async setBasicFields(fields: Partial<AuthTypeBasic>): Promise<void> {
    await this.setAuthType(AuthType.Basic);
    await this.setAuthTextFields([
      { field: "username", label: "Username", value: fields.username },
      { field: "password", label: "Password", value: fields.password },
    ]);
  }

  /**
   * Sets the API Key auth key and value, switching the auth type to
   * API Key first. The "Add to" select is left at its default (Header).
   */
  async setApiKeyFields(fields: Partial<AuthTypeAPIKey>): Promise<void> {
    await this.setAuthType(AuthType.ApiKey);
    await this.setAuthTextFields([
      { field: "key", label: "Key", value: fields.key },
      { field: "value", label: "Value", value: fields.value },
    ]);
  }

  private async setTokenField(token: string | undefined): Promise<void> {
    await this.setAuthTextFields([
      { field: "token", label: "Token", value: token },
    ]);
  }

  private async setAuthTextFields(
    fields: { field: string; label: string; value: string | undefined }[],
  ): Promise<void> {
    const edits: AuthFieldEdit[] = [];
    for (const { field, label, value } of fields) {
      if (value === undefined) continue;
      const editor = this.authFieldEditor(label);
      await expect(editor).toBeVisible({ timeout: DEFAULT_TIMEOUT });
      const edit: AuthFieldEdit = {
        field,
        value,
        reapply: () => this.setCodeMirrorValue(editor, value),
      };
      await edit.reapply!();
      await this.waitForAuthFieldsPersisted([...edits, edit]);
      edits.push(edit);
    }
    await this.waitForAuthFieldsPersisted(edits, AUTH_SETTLE_MS);
  }

  /**
   * Sets the given OAuth 1.0 fields, switching the auth type to OAuth
   * 1.0 first. Fields left undefined are not written, leaving whatever
   * value is already there.
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
      // Verify every field written so far, not just this one: its save can
      // overwrite an earlier field from a stale copy of the auth config.
      await this.waitForAuthFieldsPersisted([...edits, edit]);
      edits.push(edit);
    }
    if (fields.signatureMethod) {
      const signatureMethod = fields.signatureMethod;
      const selectMethod = async () => {
        await this.fieldByLabel("Signature-Method").selectOption(signatureMethod);
      };
      await selectMethod();
      const edit: AuthFieldEdit = {
        field: "signatureMethod",
        value: signatureMethod,
        reapply: selectMethod,
      };
      await this.waitForAuthFieldsPersisted([...edits, edit]);
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
   */
  async setOAuth2Fields(fields: Partial<AuthTypeOAuth2>): Promise<void> {
    await this.setAuthType(AuthType.OAuth2);
    await expect(this.fieldByLabel("Grant-Type")).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });

    const edits: AuthFieldEdit[] = [];
    const selectOnTab = async (id: string, value: string) => {
      await this.fieldByLabel(id).selectOption(value);
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
      // Changing the grant type re-renders the form's rows and refreshes
      // loader data; let any stale debounced save land and the editors
      // settle first, or the text fields written next get reverted by it.
      await this.waitForAuthFieldsPersisted(edits, AUTH_SETTLE_MS);
      await this.waitForRendererIdle();
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
      await this.waitForAuthFieldsPersisted([...edits, edit]);
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
      (await this.fieldByLabel("Response-Type").count())
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

  private toggle(id: string): ToggleButtonComponent {
    return new ToggleButtonComponent(this.page, this.fieldByLabel(id));
  }

  private async setToggle(id: string, enabled: boolean): Promise<void> {
    await this.toggle(id).set(enabled);
  }

  /**
   * Polls the on-disk request/folder documents until a single one holds
   * every edit in `edits` at once. The app's debounced editors can save
   * from a stale copy of the auth config, so a write may never land, or
   * may drop a field persisted earlier; once an edit has had
   * `AUTH_REAPPLY_AFTER_MS` to land on its own, the edits still missing
   * from the closest-matching document are re-applied.
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
   * Builds the locator for a labelled Auth form control (a select or a
   * toggle button) from its row's label, given in the row's id form
   * (`Grant-Type` -> the "Grant Type" label). The app links each row's
   * `<label>` to its control via `for`/`id`, so no `#id` selector is needed.
   */
  private fieldByLabel(id: string): Locator {
    return this.page
      .locator(this.TABPANEL)
      .getByLabel(id.replace(/-/g, " "), { exact: true });
  }

  /**
   * Builds the locator for an OAuth 1.0 field's CodeMirror editor,
   * identified by the row's visible label (e.g. "Consumer Key" -> the
   * "consumer-key"-id textarea CodeMirror replaces).
   */
  private oAuth1FieldEditor(label: string): Locator {
    return this.authFieldEditor(label);
  }

  /**
   * Builds the locator for an OAuth 2.0 field's CodeMirror editor,
   * identified by the row's visible label (e.g. "Client ID" -> the
   * "Client-ID"-id textarea CodeMirror replaces). Resolves to an empty
   * locator (`.count()` is 0) when the field's row isn't rendered for
   * the currently selected grant type or accordion state.
   */
  private oauth2FieldEditor(label: string): Locator {
    return this.authFieldEditor(label);
  }

  /**
   * Builds the locator for the CodeMirror editor inside an Auth form row,
   * given the row's visible label (e.g. "Client ID" -> the row with
   * `data-testid="auth-field-Client-ID"`).
   */
  private authFieldEditor(label: string): Locator {
    return this.page
      .locator(this.TABPANEL)
      .getByTestId(`auth-field-${label.replace(/ /g, "-")}`)
      .locator(".CodeMirror");
  }
}
