import Provider from './Provider.js';

class DocumentSymbolProvider extends Provider {
  async #getSymbolInformationList(vscodeDocument) {
    const worker = await this.worker(vscodeDocument.uri);

    try {
      return await worker.findDocumentSymbols(vscodeDocument.uri.toString());
    } catch {
      return undefined;
    }
  }

  async provideDocumentSymbols(vscodeDocument) {
    const symbolInformationList = await this.#getSymbolInformationList(vscodeDocument);

    return this.protocolConverter.asSymbolInformations(symbolInformationList);
  }
}

export default DocumentSymbolProvider;
