import type { CustomGitCredentialV2 } from "insomnia-data";

export interface GitCredential extends Pick<
  CustomGitCredentialV2["credentials"],
  "username" | "password"
> {
  /** The app's own display name for this credential once created (e.g.
   * "Custom Git Credential" for a custom/PAT credential — the app
   * hardcodes this itself; it isn't a field the create form collects). */
  name: string;
  authorEmail: string;
  authorName: string;
}
