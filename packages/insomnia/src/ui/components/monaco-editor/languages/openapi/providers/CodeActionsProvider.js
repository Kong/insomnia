import Provider from './Provider.js';

class CodeActionsProvider extends Provider {
  async #getCodeActionList(vscodeDocument, diagnosticList) {
    const worker = await this.worker(vscodeDocument.uri);

    try {
      return await worker.doCodeActions(vscodeDocument.uri.toString(), diagnosticList);
    } catch {
      return undefined;
    }
  }

  #maybeConvert(codeActionList) {
    if (typeof codeActionList === 'undefined') {
      return codeActionList;
    }

    return this.protocolConverter.asCodeActionResult(codeActionList);
  }

  async provideCodeActions(vscodeDocument, range, ctx) {
    const diagnosticList = await this.codeConverter.asDiagnostics(ctx.diagnostics);
    const codeActionList = await this.#getCodeActionList(vscodeDocument, diagnosticList);

    return this.#maybeConvert(codeActionList);
  }
}

export default CodeActionsProvider;
