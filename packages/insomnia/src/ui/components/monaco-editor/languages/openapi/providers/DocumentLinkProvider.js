import Provider from './Provider.js';

class DocumentLinkProvider extends Provider {
  async #getLinks(vscodeDocument) {
    const worker = await this.worker(vscodeDocument.uri);

    try {
      return await worker.doLinks(vscodeDocument.uri.toString());
    } catch {
      return undefined;
    }
  }

  async provideDocumentLinks(vscodeDocument) {
    const links = await this.#getLinks(vscodeDocument);
    const linksWithNonEmptyRanges = links.filter(
      (link) => !this.protocolConverter.asRange(link.range).isEmpty
    );

    return this.protocolConverter.asDocumentLinks(linksWithNonEmptyRanges);
  }

  // eslint-disable-next-line class-methods-use-this
  async resolveDocumentLink(link) {
    return link;
  }
}

export default DocumentLinkProvider;
