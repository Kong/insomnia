export enum SegmentEvent {
  appStarted = 'App Started',
  analyticsDisabled = 'Analytics Disabled',
  collectionCreate = 'Collection Created',
  dataExport = 'Data Exported',
  dataImport = 'Data Imported',
  documentCreate = 'Document Created',
  mockCreate = 'Mock Created',
  environmentWorkspaceCreate = 'Environment Workspace Created',
  loginSuccess = 'Login Success',
  inviteTrigger = 'Invite Triggered From App',
  exportAllCollections = 'Exported All Collections',
  kongConnected = 'Kong Connected',
  kongSync = 'Kong Synced',
  requestBodyTypeSelect = 'Request Body Type Selected',
  requestCreate = 'Request Created',
  requestExecute = 'Request Executed',
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
  inviteMember = 'Invite Member',
}

type PushPull = 'push' | 'pull';
type VCSAction = PushPull | `force_${PushPull}` |
  'create_branch' | 'merge_branch' | 'delete_branch' | 'checkout_branch' |
  'commit' | 'stage_all' | 'stage' | 'unstage_all' | 'unstage' | 'rollback' | 'rollback_all' |
  'update' | 'setup' | 'clone';
export function vcsSegmentEventProperties(
  type: 'git',
  action: VCSAction,
  error?: string
) {
  return { type, action, error };
}
