export type TemplateTagName =
  | "faker"
  | "base64"
  | "now"
  | "uuid"
  | "os"
  | "hash"
  | "file"
  | "jsonpath"
  | "cookie"
  | "prompt"
  | "response"
  | "request"
  | "vault"
  | "custom";

export type TemplateTagArgumentInputType = "Static Value" | "Environment Variable";

export type HashAlgorithm = "md5" | "sha1" | "sha256" | "sha512";

export type DigestEncoding = "hex" | "base64";

export interface TemplateTag {
  functionName: TemplateTagName;
  algorithm?: HashAlgorithm;
  digestEncoding?: DigestEncoding;
  input?: string;
  credentialName?: string;
  preview: string;
}
