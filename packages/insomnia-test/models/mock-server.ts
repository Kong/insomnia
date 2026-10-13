export class MockServer {
  id?: string;

  constructor(
    readonly name: string,
    /** The self-hosted server's base URL — what the create dialog's "What is your self-hosted mock server URL?" field is filled with. */
    readonly url: string,
  ) {}
}
