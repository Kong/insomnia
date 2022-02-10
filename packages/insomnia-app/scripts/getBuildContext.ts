export interface BuildContext {
  app?: string | null;
  channel?: string | null;
  gitCommit?: string | null;
  gitRef?: string | null;
  version: string | null;
}

const fromGitRef = (): BuildContext => {
  const {
    GITHUB_REF,
    GITHUB_SHA,
  } = process.env;

  const gitCommit = GITHUB_SHA;
  const gitRef = GITHUB_REF || '';
  const tagMatch = gitRef.match(/(core)@(\d{4}\.\d+\.\d+(-(alpha|beta)\.\d+)?)$/);

  const app = tagMatch ? tagMatch[1] : null;
  const version = tagMatch ? tagMatch[2] : null;
  const channel = tagMatch ? tagMatch[4] : 'stable';

  return {
    app,
    channel,
    gitCommit,
    gitRef,
    version,
  };
};

export const getBuildContext = (forceFromGitRef: boolean) => {
  if (forceFromGitRef) {
    return fromGitRef();
  }

  return {
    version: '0.0.1-dev+unknown',
  } as const;
};
