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
  importLoginRequired = 'Import Login Required',
  importResumedAfterLogin = 'Import Resumed After Login',
  importedRequestFirstSend = 'Imported Request First Send',
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
  copyAsCurl = 'Copied As cURL',
  themeChanged = 'Theme Changed',
  generateCodeClicked = 'Generate Code Clicked',
  generateCodeLanguageChanged = 'Generate Code Language Changed',
  filterCreatedHomePage = 'Filter Created From Home Page',
  filterCreatedProjects = 'Filter Created Projects',
  filterCreatedRequests = 'Filter Created Requests',
  filterCreatedResponseBody = 'Filter Created Response Body',

  // INS-2120: Segment events to track common actions
  homepageFiltered = 'homepage-filtered',
  quickSearchOpenedByKeyboard = 'quick-search-opened-by-keyboard',
  quickSearchOpenedByMouse = 'quick-search-opened-by-mouse',
  statusbarLeftbarToggled = 'statusbar-leftbar-toggled',
  statusbarTopbarToggled = 'statusbar-topbar-toggled',
  statusbarOrphanedProjectsClicked = 'statusbar-orphaned-projects-clicked',
  designerGenerateMockClicked = 'designer-generate-mock-clicked',
  designerPreviewToggled = 'designer-preview-toggled',
  requestEnvironmentClicked = 'request-environment-clicked',
  requestAddCookiesClicked = 'request-add-cookies-clicked',
  requestAddCertificatesClicked = 'request-add-certificates-clicked',
  requestListSortClicked = 'request-list-sort-clicked',
  requestListExpandCollapseClicked = 'request-list-expand-collapse-clicked',
  requestParamsDescriptionToggled = 'request-params-description-toggled',
  requestParamsImportFromURLClicked = 'request-params-import-from-URL-clicked',
  requestParamsBulkEditToggled = 'request-params-bulk-edit-toggled',
  responsePreviewJSONPathEntered = 'response-preview-jsonpath-entered',
  requestBodyBeautifyClicked = 'request-body-beautify-clicked',
  requestHeadersDescriptionToggled = 'request-headers-description-toggled',
  requestHeadersBulkEditToggled = 'request-headers-bulk-edit-toggled',
  requestScriptsPreScriptSnippetAdded = 'request-scripts-prescript-snippet-added',
  requestScriptsPostScriptSnippetAdded = 'request-scripts-postscript-snippet-added',
  responseHeadersCopyAllClicked = 'response-headers-copy-all-clicked',
  responseCookiesManageCookiesClicked = 'response-cookies-manage-cookies-clicked',
  requestOpenInNewTabClicked = 'request-open-in-new-tab-clicked',
  requestListMenuPinClicked = 'request-list-menu-pin-clicked',
  requestListMenuDuplicateClicked = 'request-list-menu-duplicate-clicked',
  requestListMenuRenameClicked = 'request-list-menu-rename-clicked',
  requestListMenuSettingsClicked = 'request-list-menu-settings-clicked',
  requestSendMenuGenerateCodeClicked = 'request-send-menu-generate-code-clicked',
  requestSendMenuSendAfterDelayClicked = 'request-send-menu-send-after-delay-clicked',
  requestSendMenuRepeatAfterIntervalClicked = 'request-send-menu-repeat-after-interval-clicked',
  requestSendMenuDownloadAfterSendClicked = 'request-send-menu-download-after-send-clicked',
  requestSendMenuSendAndDownloadClicked = 'request-send-menu-send-and-download-clicked',
  mcpListExpandCollapseClicked = 'mcp-list-expand-collapse-clicked',
  mcpListFiltered = 'mcp-list-filtered',
  mcpRequestParamsBeautifyClicked = 'mcp-request-params-beautify-clicked',
  mcpRequestHeadersDescriptionToggled = 'mcp-request-headers-description-toggled',
  mcpRequestRootsNotifyClicked = 'mcp-request-roots-notify-clicked',
  mcpResponseHeadersCopyAllClicked = 'mcp-response-headers-copy-all-clicked',
  kongKonnectPatValidated = 'kong-konnect-pat-validated',
  kongKonnectSyncCompleted = 'kong-konnect-sync-completed',
  emptyStateSendRequestClicked = 'empty-state-send-request-clicked',
  emptyStateCreateDocumentClicked = 'empty-state-create-document-clicked',
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

function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0];
}

export function hasTrackedToday(key: string): boolean {
  const lastTracked = localStorage.getItem(key);
  return lastTracked === getTodayDateString();
}

export function markTrackedToday(key: string): void {
  localStorage.setItem(key, getTodayDateString());
}

export function trackOnceDaily(event: SegmentEvent, properties?: Record<string, unknown>): void {
  if (hasTrackedToday(event)) {
    return;
  }
  window.main.trackSegmentEvent({ event, properties });
  markTrackedToday(event);
}

export interface ImportAttribution {
  importSource?: string;
  importSourceUrl?: string;
}

export const PENDING_IMPORT_ATTRIBUTION_KEY = 'pendingImportAttribution';

export const importAttributionKey = (requestId: string): string => `importAttribution:request:${requestId}`;

export function readPendingImportAttribution(): ImportAttribution {
  try {
    const raw = window.sessionStorage.getItem(PENDING_IMPORT_ATTRIBUTION_KEY);
    return raw ? (JSON.parse(raw) as ImportAttribution) : {};
  } catch {
    return {};
  }
}

export function trackImportEvent(event: SegmentEvent, properties: Record<string, unknown> = {}): void {
  window.main.trackSegmentEvent({
    event,
    properties: { ...readPendingImportAttribution(), ...properties },
  });
}
