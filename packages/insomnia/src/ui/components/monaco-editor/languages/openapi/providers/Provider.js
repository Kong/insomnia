class Provider {
  #worker;

  #codeConverter;

  #protocolConverter;

  constructor(worker, codeConverter, protocolConverter) {
    this.#worker = worker;
    this.#codeConverter = codeConverter;
    this.#protocolConverter = protocolConverter;
  }

  get worker() {
    return this.#worker;
  }

  get codeConverter() {
    return this.#codeConverter;
  }

  get protocolConverter() {
    return this.#protocolConverter;
  }

  dispose() {
    this.#worker = null;
    this.#codeConverter = null;
    this.#protocolConverter = null;
  }
}

export default Provider;
