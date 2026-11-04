const projectDocs = 'https://github.com/outmanos/restless#readme';

export const docsBase = projectDocs;
export const docsGitSync = projectDocs;
export const docsTemplateTags = projectDocs;
export const docsVersionControl = projectDocs;
export const docsPlugins = projectDocs;
export const docsImportExport = projectDocs;
export const docsKeyMaps = projectDocs;
export const docsIntroductionInsomnia = projectDocs;
export const docsWorkingWithDesignDocs = projectDocs;
export const docsUnitTesting = projectDocs;
export const docsIntroductionToInsoCLI = projectDocs;
export const docsPreRequestScript = projectDocs;
export const docsAfterResponseScript = projectDocs;
export const docsMcpClient = projectDocs;
export const docsMcpAuthentication = projectDocs;
export const docsPricingLearnMoreLink = projectDocs;
export const docsPreRequestAndAfterResponseScripts = projectDocs;

export const docsGitAccessToken = {
  github: 'https://docs.github.com/github/authenticating-to-github/creating-a-personal-access-token',
  gitlab: 'https://docs.gitlab.com/ee/user/profile/personal_access_tokens.html',
  bitbucket: 'https://support.atlassian.com/bitbucket-cloud/docs/app-passwords/',
  bitbucketServer: 'https://confluence.atlassian.com/bitbucketserver/personal-access-tokens-939515499.html',
  azureDevOps:
    'https://docs.microsoft.com/en-us/azure/devops/organizations/accounts/use-personal-access-tokens-to-authenticate',
};

export const documentationLinks = {
  introductionToInsomnia: {
    title: 'Introduction to Restless',
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
