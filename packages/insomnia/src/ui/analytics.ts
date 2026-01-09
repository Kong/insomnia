export enum SegmentEvent {
  appStarted = 'App Started',
  analyticsDisabled = 'Analytics Disabled',
  collectionCreate = 'Collection Created',
  dataExport = 'Data Exported',
  exportCompleted = 'Export Completed',
  dataImport = 'Data Imported',
  importStarted = 'Import Started',
  importScanned = 'Import Scanned',
  importCompleted = 'Import Completed',
  documentCreate = 'Document Created',
  mockCreateModalOpened = 'Mock Server Create Modal Opened',
  mockCreate = 'Mock Created',
  mockEdit = 'Mock Server Edited',
  mockDelete = 'Mock Server Deleted',
  mockRouteCreate = 'Mock Route Created',
  mockRouteEdit = 'Mock Route Edited',
  mockRouteDelete = 'Mock Route Deleted',
  generateCollection = 'Generated Collection',
  generateCollectionFromMock = 'Generate Collection From Mock',
  environmentCreate = 'Environment Created',
  loginSuccess = 'Login Success',
  inviteTrigger = 'Invite Triggered From App',
  exportAllCollections = 'Exported All Collections',
  kongConnected = 'Kong Connected',
  kongSync = 'Kong Synced',
  requestBodyTypeSelect = 'Request Body Type Selected',
  requestCreated = 'Request Created',
  requestExecuted = 'Request Executed',
  requestEdit = 'Request Edited',
  requestDeleted = 'Request Deleted',
  requestRenamed = 'Request Renamed',
  requestUrlCopied = 'Request URL Copied',
  collectionRunExecute = 'Collection Run Executed',
  projectLocalCreate = 'Local Project Created',
  projectLocalDelete = 'Local Project Deleted',
  selectScratchpad = 'Scratchpad Selected at Login',
  syncConflictResolutionStart = 'Sync Conflict Resolution Started',
  syncConflictResolutionCompleteMine = 'Sync Conflict Resolution Completed Mine',
  syncConflictResolutionCompleteTheirs = 'Sync Conflict Resolution Completed Theirs',
  testSuiteCreate = 'Test Suite Created',
  testSuiteDelete = 'Test Suite Deleted',
  unitTestCreate = 'Unit Test Created',
  unitTestDelete = 'Unit Test Deleted',
  unitTestRun = 'Ran Individual Unit Test',
  unitTestRunAll = 'Ran All Unit Tests',
  vcsSyncStart = 'VCS Sync Started',
  vcsSyncComplete = 'VCS Sync Completed',
  vcsAction = 'VCS Action Executed',
  buttonClick = 'Button Clicked',
  inviteMember = 'Invite Sent',
  inviteResent = 'Invite Resent',
  inviteRevoked = 'Invite Revoked',
  projectCreated = 'Project Created',
  projectUpdated = 'Project Updated',
  exportStarted = 'Export Started',
  exportRequestsChosen = 'Export Requests Chosen',
  recommendCommitsGenerated = 'Recommend Commits Generated',
  recommendCommitsSaved = 'Recommend Commits Saved',
  recommendCommitsCancelled = 'Recommend Commits Cancelled',
  recommendCommitsClicked = 'Recommend Commits Clicked',
  mcpClientWorkspaceCreate = 'MCP Client Workspace Created',
  mcpClientAdded = 'MCP Client Added',
  inviteNotPermitted = 'Invite Not Permitted',
  responseToMockClicked = 'Response To Mock Clicked',
  gitSyncButtonClicked = 'Git Sync Button Clicked',
  preferencesViewed = 'Preferences Viewed',
  installPlugin = 'Plugin Installed',
  copyAsCurl = 'Copied As cURL',
  themeChanged = 'Theme Changed',
  generateCodeClicked = 'Generate Code Clicked',
  generateCodeLanguageChanged = 'Generate Code Language Changed',
  filterCreatedHomePage = 'Filter Created From Home Page',
  filterCreatedProjects = 'Filter Created Projects',
  filterCreatedRequests = 'Filter Created Requests',
  filterCreatedResponseBody = 'Filter Created Response Body',
  // TODO(INS-1912): Remove in 12.5
  tempOrganizationOpened = 'temp_organization_opened',
  tempProjectOpened = 'temp_project_opened',
}

type PushPull = 'push' | 'pull';
type VCSAction =
  | PushPull
  | `force_${PushPull}`
  | 'create_branch'
  | 'merge_branch'
  | 'delete_branch'
  | 'checkout_branch'
  | 'commit'
  | 'stage_all'
  | 'stage'
  | 'unstage_all'
  | 'unstage'
  | 'rollback'
  | 'rollback_all'
  | 'update'
  | 'setup'
  | 'clone';
export function vcsSegmentEventProperties(type: 'git', action: VCSAction, error?: string) {
  return { type, action, error };
}
