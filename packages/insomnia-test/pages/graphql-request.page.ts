import { expect } from "@playwright/test";
import { RequestPage } from "./request.page";
import {
  GraphQLRequest,
  GraphQLRequestBody,
  GraphQLSchema,
} from "../models/graphql-request";
import { ContentType } from "../enums/content-type";
import { HttpMethod } from "../enums/http-method";

export class GraphQLRequestPage extends RequestPage {
  protected readonly urlBarId = "request-url-bar";

  /**
   * Reads the full GraphQL request state from the UI (method, url, params,
   * body, schema documentation, and scripts). Headers are always returned
   * empty since this page doesn't expose a headers tab.
   * @returns the GraphQL request fields, excluding `name`
   */
  async get(): Promise<Omit<GraphQLRequest, "name">> {
    const scripts = await this.getScripts();
    return {
      method: (await this.getMethod()).trim() as HttpMethod,
      url: await this.getUrl(),
      params: await this.getParams(),
      headers: [],
      body: await this.getBody(),
      schema: await this.getSchemaInfo(),
      preRequestScript: scripts?.preRequest,
      afterResponseScript: scripts?.afterResponse,
    };
  }

  /**
   * Reads the current body from the GraphQL request's own query/variables
   * editors — a fixed pair of CodeMirror instances on the "Body" tab, not
   * the generic single-editor "Change Body Type" flow the HTTP/WebSocket
   * request pages use (that dropdown has no option matching this domain's
   * mimeType, so it can't be driven the same way).
   * @returns the body's mime type and JSON-encoded `{ query, variables }` text, or `undefined` if no query is set
   */
  private async getBody(): Promise<GraphQLRequestBody | undefined> {
    await this.switchTab("content-type");
    const editors = this.page.locator(this.TABPANEL).locator(".CodeMirror");
    if ((await editors.count()) === 0) return undefined;

    const query = await this.readCodeMirror(editors.nth(0));
    if (!query) return undefined;

    const variablesText =
      (await editors.count()) > 1
        ? await this.readCodeMirror(editors.nth(1))
        : "";
    let variables: unknown;
    try {
      variables = variablesText ? JSON.parse(variablesText) : undefined;
    } catch {
    }

    return {
      mimeType: ContentType.JSON,
      text: JSON.stringify(
        variables !== undefined ? { query, variables } : { query },
      ),
    };
  }

  /**
   * Writes into the GraphQL request's query/variables editors, splitting
   * `body.text` (a `{ query, variables }` JSON-shaped payload — the shape
   * `getBody()` returns) into its two parts. No-ops if `body.mimeType` is
   * unset. Waits afterward for the editors' debounced save to flush —
   * `setCodeMirrorValue()` only confirms the live CodeMirror instance
   * reflects the change, not that it has been persisted, so a caller that
   * immediately re-navigates (e.g. `create()` re-reading via `get()`) can
   * otherwise observe a stale empty query.
   * @param body - the GraphQL request body to apply
   */
  async setBody(body: GraphQLRequestBody): Promise<void> {
    if (body.mimeType == null) return;
    await this.switchTab("content-type");
    const editors = this.page.locator(this.TABPANEL).locator(".CodeMirror");

    const { query, variablesText } = splitGraphQLBody(body.text ?? "");
    await this.setCodeMirrorValue(editors.nth(0), query);
    if (variablesText !== undefined) {
      await this.setCodeMirrorValue(editors.nth(1), variablesText);
    }
    await this.page.waitForTimeout(1500);
  }

  /**
   * Clicks "Prettify GraphQL" to reformat the query editor's current
   * content.
   */
  async prettify(): Promise<void> {
    await this.switchTab("content-type");
    await this.page
      .getByRole("button", { name: "Prettify GraphQL", exact: true })
      .click();
  }

  /**
   * Opens the schema documentation panel (the wrench-icon "schema" button's
   * "Show Documentation" menu item) and reads the root types and the query
   * root type's fields (name, args, return type, and description) —
   * closing the panel again afterward, since it otherwise stays open
   * across navigation and overlaps the Send button. "Show Documentation"
   * jumps straight to the sole root type's fields when there's only one
   * (as with this project's mock schema), so this navigates back to the
   * root screen first to also capture the root types list.
   * @returns The schema documentation, or `undefined` if it hasn't resolved (e.g. the request doesn't point at a GraphQL endpoint)
   */
  private async getSchemaInfo(): Promise<GraphQLSchema | undefined> {
    await this.switchTab("content-type");
    const errorButton = this.page.getByRole("button", {
      name: /error fetching schema/i,
    });
    await expect(errorButton)
      .toBeHidden({ timeout: 15000 })
      .catch(() => {});
    if (await errorButton.isVisible().catch(() => false)) return undefined;

    await this.page.getByRole("button", { name: /schema/i }).click();
    await this.page
      .getByRole("menuitem", { name: /Show Documentation/i })
      .click();

    const backButton = this.page.locator(
      ".graphql-explorer__header__back-btn",
    );
    if (await backButton.count()) {
      await backButton.click();
    }

    const schemaSection = this.page.locator(".graphql-explorer__schema");
    const rootTypes = Object.fromEntries(
      (
        await schemaSection
          .locator("li")
          .filter({ hasText: /\S/ })
          .evaluateAll((items) =>
            items.map((item) => [
              item.querySelector(".success")?.textContent?.trim() ?? "",
              item.querySelector("a")?.textContent?.trim() ?? "",
            ]),
          )
      ).filter(([key]) => key),
    );

    await schemaSection.locator("a").first().click();

    const fields = await this.page
      .locator("li")
      .filter({ has: this.page.locator(".graphql-explorer__defs__description") })
      .evaluateAll((items) =>
        items.map((item) => {
          const name = item.querySelector("a.success")?.textContent?.trim() ?? "";
          const args = Array.from(
            item.querySelectorAll(".graphql-explorer__defs__arg"),
          ).map((arg) => ({
            name: arg.querySelector(".info")?.textContent?.trim() ?? "",
            type: arg.querySelector("a")?.textContent?.trim() ?? "",
          }));
          const description =
            item
              .querySelector(".graphql-explorer__defs__description")
              ?.textContent?.trim() ?? "";
          const clone = item.cloneNode(true) as HTMLElement;
          clone.querySelector("a.success")?.remove();
          clone
            .querySelectorAll(".graphql-explorer__defs__arg")
            .forEach((el) => el.remove());
          clone.querySelector(".graphql-explorer__defs__description")?.remove();
          const typeText = (clone.textContent ?? "").replace(/^:/, "").trim();
          return { name, args, description, typeText };
        }),
      );

    await this.page
      .locator("#graphql-explorer-container")
      .getByRole("button")
      .first()
      .click();

    return {
      queryType: rootTypes.query,
      mutationType: rootTypes.mutation,
      subscriptionType: rootTypes.subscription,
      fields: fields.map(({ typeText, ...field }) => ({
        ...field,
        type: parseTypeRef(typeText),
      })),
    };
  }
}

/**
 * Parses a GraphQL return-type signature (e.g. `CharacterResults!`,
 * `Episode`, `[Character!]!`) into the introspection standard's simplified
 * `name`/`isList`/`isNonNull` shape — see `GraphQLSchemaTypeRef`.
 * @param typeText - The raw type signature text
 * @returns The parsed type reference
 */
function parseTypeRef(typeText: string): {
  name: string;
  isList: boolean;
  isNonNull: boolean;
} {
  let text = typeText.trim();
  const isNonNull = text.endsWith("!");
  if (isNonNull) text = text.slice(0, -1).trim();

  const isList = text.startsWith("[") && text.endsWith("]");
  if (isList) {
    text = text.slice(1, -1).trim();
    if (text.endsWith("!")) text = text.slice(0, -1).trim();
  }

  return { name: text, isList, isNonNull };
}

/**
 * Splits a `{ query, variables }` JSON-shaped payload into its query text
 * and raw variables text, without round-tripping `variables` through
 * `JSON.parse`/`JSON.stringify` — that would break on Insomnia template
 * tags (`{{ someVar }}`), which aren't valid JSON but are valid inside the
 * variables editor (they resolve to real values at send time).
 * @param text - The raw `{ query, variables }` payload
 * @returns The extracted query text, and the variables object's raw source text if present
 */
function splitGraphQLBody(text: string): {
  query: string;
  variablesText?: string;
} {
  const queryMatch = text.match(/"query"\s*:\s*"((?:\\.|[^"\\])*)"/);
  let query = text;
  if (queryMatch) {
    try {
      query = JSON.parse(`"${queryMatch[1]}"`);
    } catch {
      query = queryMatch[1];
    }
  }

  const variablesKeyIndex = text.indexOf('"variables"');
  let variablesText: string | undefined;
  if (variablesKeyIndex !== -1) {
    const braceStart = text.indexOf("{", text.indexOf(":", variablesKeyIndex));
    if (braceStart !== -1) {
      let depth = 0;
      for (let i = braceStart; i < text.length; i++) {
        if (text[i] === "{") depth++;
        else if (text[i] === "}") {
          depth--;
          if (depth === 0) {
            variablesText = text.slice(braceStart, i + 1);
            break;
          }
        }
      }
    }
  }

  return { query, variablesText };
}
