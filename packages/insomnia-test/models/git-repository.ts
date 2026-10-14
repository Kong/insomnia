import type { GitRepository as AppGitRepository } from "insomnia-data";

export interface GitRepository extends Pick<AppGitRepository, "uri"> {
  branch?: string;
  cloneParentDir?: string;
}
