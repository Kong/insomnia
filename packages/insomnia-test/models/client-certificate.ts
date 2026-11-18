import type { ClientCertificate as AppClientCertificate } from "insomnia-data";

/** `cert`/`key` are file paths to upload here, not the PEM contents the app stores. */
export interface ClientCertificate extends Pick<AppClientCertificate, "host"> {
  cert: string;
  key: string;
  passphrase?: string;
}
