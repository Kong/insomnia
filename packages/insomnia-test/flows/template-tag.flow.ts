import { TreeNodeType } from "../enums/tree-node-types";
import type { HttpRequest } from "../models/http-request";
import type { ResponseView } from "../models/response";
import type { TemplateTag, TemplateTagName } from "../models/template-tag";
import { BaseFlow } from "./base.flow";

export class TemplateTagFlow extends BaseFlow {
  /**
   * Opens the editor for a tag that's already rendered somewhere on the
   * currently-open request's page (found by matching its own
   * `data-template` attribute, so this is safe even when other tags are
   * also on screen) — insert the tag itself via the request's own fields
   * at creation time (e.g. `httpRequestFlow.create()`'s `url`/`headers`),
   * not through this method — reads its resolved Live Preview value (and,
   * for a `hash` tag specifically, its Algorithm/Digest Encoding/Input
   * arguments too, since those have dedicated getters), and confirms via
   * "Done".
   */
  async get(template: string): Promise<TemplateTag> {
    const templateTag = this.pageManager.templateTagPage;
    const tag = template.match(/\{%.*?%\}/)?.[0] ?? template;
    await templateTag.openTagByTemplate(tag);
    const functionName = (await templateTag.getFunctionName()) as TemplateTagName;
    const result: TemplateTag = {
      functionName,
      preview: await templateTag.getPreview(),
    };
    if (functionName === "hash") {
      result.algorithm = (await templateTag.getAlgorithm()) as TemplateTag["algorithm"];
      result.digestEncoding =
        (await templateTag.getDigestEncoding()) as TemplateTag["digestEncoding"];
      result.input = await templateTag.getInput();
    }
    await templateTag.done();
    return result;
  }

  /**
   * Opens an already-rendered `hash` or `vault` tag (found by matching
   * `template`, the tag's current raw text), switches its arguments to
   * whatever `target` specifies, reads the resulting Live Preview, and
   * confirms via "Done". `hash` switches its Algorithm/Digest
   * Encoding/Input arguments (`TemplateTagPage.setAlgorithm`/
   * `.setDigestEncoding`/`.setInput`); `vault` switches its "Credential
   * For Vault Service Provider" select (`TemplateTagPage
   * .selectVaultCredential`) to an already-created cloud credential (see
   * `PreferencesFlow.addCloudCredentials()`). No other tag is supported
   * today, since these are the only two with dedicated argument setters.
   */
  async edit(template: string, target: TemplateTag): Promise<TemplateTag> {
    const templateTag = this.pageManager.templateTagPage;
    const tag = template.match(/\{%.*?%\}/)?.[0] ?? template;
    await templateTag.openTagByTemplate(tag);
    if (target.functionName === "vault") {
      await templateTag.selectVaultCredential(target.credentialName!);
      const preview = await templateTag.getPreview();
      await templateTag.done();
      return {
        functionName: "vault",
        credentialName: target.credentialName,
        preview,
      };
    }
    await templateTag.setAlgorithm(target.algorithm!);
    await templateTag.setDigestEncoding(target.digestEncoding!);
    await templateTag.setInput(target.input!);
    const preview = await templateTag.getPreview();
    await templateTag.done();
    return {
      functionName: "hash",
      algorithm: target.algorithm,
      digestEncoding: target.digestEncoding,
      input: target.input,
      preview,
    };
  }

  /**
   * Opens a `prompt` tag already rendered on the current request's page,
   * clicks "Clear" to wipe the value cached under its storage key, and
   * confirms via "Done".
   */
  async clearCachedPrompt(template: string): Promise<void> {
    const templateTag = this.pageManager.templateTagPage;
    const tag = template.match(/\{%.*?%\}/)?.[0] ?? template;
    await templateTag.openTagByTemplate(tag);
    await templateTag.clearCachedValue();
    await templateTag.done();
  }

  /**
   * Sends `request` (whose body holds a `prompt` tag with no cached
   * value), answers the resulting prompt dialog, and reads back the
   * response.
   */
  async sendAnsweringPrompt(
    request: HttpRequest,
    label: string,
    value: string,
  ): Promise<{ promptInputType: string; response: ResponseView }> {
    const workspace = this.pageManager.workspacePage;
    const httpRequestPage = this.pageManager.httpRequestPage;
    const templateTag = this.pageManager.templateTagPage;
    const responsePage = this.pageManager.responsePage;

    const node = await workspace.requireItemNode(request, TreeNodeType.Request);
    await workspace.openRequestNode(node);
    await httpRequestPage.navigate();

    await templateTag.clickSend();
    const promptInputType = await templateTag.answerPrompt(label, value);
    await responsePage.navigate();

    return { promptInputType, response: await responsePage.get() };
  }
}
