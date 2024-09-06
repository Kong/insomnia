const insomniaDocs = (slug: string) => `https://docs.insomnia.rest${slug}`;

export const docsBase = insomniaDocs('/');
export const docsGitSync = insomniaDocs('/insomnia/git-sync');
export const docsTemplateTags = insomniaDocs('/insomnia/template-tags');
export const docsVersionControl = insomniaDocs('/insomnia/version-control-sync');
export const docsPlugins = insomniaDocs('/insomnia/introduction-to-plugins');
export const docsImportExport = insomniaDocs('/insomnia/import-export-data');
export const docsKeyMaps = insomniaDocs('/insomnia/key-maps');
export const docsIntroductionInsomnia = insomniaDocs('/insomnia/get-started');
export const docsWorkingWithDesignDocs = insomniaDocs('/insomnia/design-documents');
export const docsUnitTesting = insomniaDocs('/insomnia/unit-testing');
export const docsIntroductionToInsoCLI = insomniaDocs('/inso-cli/introduction');
export const docsPreRequestScript = insomniaDocs('/insomnia/pre-request-script');
export const docsAfterResponseScript = insomniaDocs('/insomnia/after-response-script');

export const docsGitAccessToken = {
  github: 'https://docs.github.com/github/authenticating-to-github/creating-a-personal-access-token',
  gitlab: 'https://docs.gitlab.com/ee/user/profile/personal_access_tokens.html',
  bitbucket: 'https://support.atlassian.com/bitbucket-cloud/docs/app-passwords/',
  bitbucketServer: 'https://confluence.atlassian.com/bitbucketserver/personal-access-tokens-939515499.html',
  azureDevOps: 'https://docs.microsoft.com/en-us/azure/devops/organizations/accounts/use-personal-access-tokens-to-authenticate',
};

export const documentationLinks = {
  introductionToInsomnia: {
    title: 'Introduction to Insomnia',
    url: docsIntroductionInsomnia,
  },
  workingWithDesignDocs: {
    title: 'Working with Design Documents',
    url: docsWorkingWithDesignDocs,
  },
  unitTesting: {
    title: 'Unit Testing',
    url: docsUnitTesting,
  },
  introductionToInsoCLI: {
    title: 'Introduction to Inso CLI',
    url: docsIntroductionToInsoCLI,
  },
  introductionToPreRequestScript: {
    title: 'Pre-request Script Overview',
    url: docsPreRequestScript,
  },
  introductionToAfterResponseScript: {
    title: 'After-Response Script Overview',
    url: docsAfterResponseScript,
  },
} as const;
