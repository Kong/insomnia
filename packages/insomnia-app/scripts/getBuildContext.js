module.exports.getBuildContext = forceFromGitRef => {
  if (forceFromGitRef) {
    return fromGitRef();
  }

  return fromSmokeTest() || fromGitRef();
};

function fromSmokeTest() {
  const { SMOKE_TEST } = process.env;

  if (SMOKE_TEST) {
    return {
      smokeTest: true,
      version: '0.0.1',
    };
  }

  return null;
}

function fromGitRef() {
  const {
    GIT_TAG,
    GITHUB_REF,
    GITHUB_SHA,
    TRAVIS_TAG,
    TRAVIS_COMMIT,
    TRAVIS_CURRENT_BRANCH,
  } = process.env;

  const gitCommit = GITHUB_SHA || TRAVIS_COMMIT;
  const gitRef = GIT_TAG || GITHUB_REF || TRAVIS_TAG || TRAVIS_CURRENT_BRANCH || '';
  const tagMatch = gitRef.match(/(core)@(\d{4}\.\d+\.\d+(-(alpha|beta)\.\d+)?)$/);

  const app = tagMatch ? tagMatch[1] : null;
  const version = tagMatch ? tagMatch[2] : null;
  const channel = tagMatch ? tagMatch[4] : 'stable';

  return {
    app,
    channel,
    version,
    gitRef,
    gitCommit,
  };
}
