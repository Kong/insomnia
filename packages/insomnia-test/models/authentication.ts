import type { RequestAuthentication as AppRequestAuthentication } from "insomnia-data";

/**
 * Auth types the framework can drive through the Auth tab. Digest, NTLM,
 * AWS IAM, Netrc, Hawk and Atlassian ASAP are intentionally excluded so a
 * spec can't silently run with the wrong authentication.
 */
export type RequestAuthentication = Extract<
  AppRequestAuthentication,
  {
    type: "none" | "bearer" | "basic" | "apikey" | "oauth2" | "singleToken";
  }
>;
