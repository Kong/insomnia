export interface GitLongValues {
  longRequest: string;
  shortRequest: string;
  workspace: string;
  totalLines: number;
  build: (changed: boolean) => string;
}
