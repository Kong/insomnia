import { importers } from 'insomnia-importers';
import React, { FC, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { getAppName } from '../../../common/constants';
import { docsImportExport } from '../../../common/documentation';
import { getWorkspaceLabel } from '../../../common/get-workspace-label';
import { strings } from '../../../common/strings';
import { exportAllToFile } from '../../redux/modules/global';
import { ForceToWorkspace } from '../../redux/modules/helpers';
import { importClipBoard, importFile, importUri } from '../../redux/modules/import';
import { selectActiveProjectName, selectActiveWorkspace, selectActiveWorkspaceName } from '../../redux/selectors';
import { Dropdown } from '../base/dropdown/dropdown';
import { DropdownButton } from '../base/dropdown/dropdown-button';
import { DropdownDivider } from '../base/dropdown/dropdown-divider';
import { DropdownItem } from '../base/dropdown/dropdown-item';
import { Link } from '../base/link';
import { HelpTooltip } from '../help-tooltip';
import { ExportRequestsModal } from '../modals/export-requests-modal';
import { showModal, showPrompt } from '../modals/index';

interface Props {
  hideSettingsModal: () => void;
}

export const ImportExport: FC<Props> = ({ hideSettingsModal }) => {
  const dispatch = useDispatch();
  const projectName = useSelector(selectActiveProjectName) ?? getAppName();
  const activeWorkspace = useSelector(selectActiveWorkspace);
  const forceToWorkspace = activeWorkspace?._id ? ForceToWorkspace.current : ForceToWorkspace.existing;

  const handleImportUri = useCallback(() => {
    const lastUsedImportUri = window.localStorage.getItem('insomnia.lastUsedImportUri');
    const defaultValue = lastUsedImportUri ? { defaultValue: lastUsedImportUri } : {};

    showPrompt({
      title: 'Import Data from URL',
      submitName: 'Fetch and Import',
      label: 'URL',
      placeholder: 'https://website.com/insomnia-import.json',
      onComplete: (uri: string) => {
        window.localStorage.setItem('insomnia.lastUsedImportUri', uri);
        dispatch(importUri(uri, { workspaceId: activeWorkspace?._id, forceToWorkspace }));
        hideSettingsModal();
      },
      ...defaultValue,
    });
  }, [dispatch, activeWorkspace?._id, forceToWorkspace, hideSettingsModal]);

  const showExportRequestsModal = useCallback(() => {
    showModal(ExportRequestsModal);
    hideSettingsModal();
  }, [hideSettingsModal]);

  const handleExportAllToFile = useCallback(() => {
    dispatch((exportAllToFile()));
    hideSettingsModal();
  }, [hideSettingsModal, dispatch]);

  const handleImportFile = useCallback(() => {
    dispatch(importFile({ workspaceId: activeWorkspace?._id, forceToWorkspace }));
    hideSettingsModal();
  }, [dispatch, activeWorkspace?._id, forceToWorkspace, hideSettingsModal]);

  const handleImportClipBoard = useCallback(() => {
    dispatch(importClipBoard({ workspaceId: activeWorkspace?._id, forceToWorkspace }));
    hideSettingsModal();
  }, [dispatch, activeWorkspace?._id, forceToWorkspace, hideSettingsModal]);

  const activeWorkspaceName = useSelector(selectActiveWorkspaceName);

  return (
    <div data-testid="import-export-tab">
      <div className="no-margin-top">
        Import format will be automatically detected.
        <HelpTooltip className="space-left">
          Supported formats include: {importers.map(importer => importer.name).join(', ')}
        </HelpTooltip>
      </div>
      <p>
        Your format isn't supported? <Link href={docsImportExport}>Add Your Own</Link>.
      </p>
      <div className="pad-top">
        <Dropdown outline>
          <DropdownButton className="btn btn--clicky">
            Export Data <i className="fa fa-caret-down" />
          </DropdownButton>
          <DropdownDivider>Choose Export Type</DropdownDivider>
          {activeWorkspace && <DropdownItem onClick={showExportRequestsModal}>
            <i className="fa fa-home" />
            Export the "{activeWorkspaceName}" {getWorkspaceLabel(activeWorkspace).singular}
          </DropdownItem>}
          <DropdownItem onClick={handleExportAllToFile}>
            <i className="fa fa-empty" />
            All {strings.document.plural} and {strings.collection.plural} from the "{projectName}" {strings.project.singular}
          </DropdownItem>
        </Dropdown>
          &nbsp;&nbsp;
        <Dropdown outline>
          <DropdownButton className="btn btn--clicky">
            Import Data <i className="fa fa-caret-down" />
          </DropdownButton>
          <DropdownDivider>Choose Import Type</DropdownDivider>
          <DropdownItem onClick={handleImportFile}>
            <i className="fa fa-file-o" />
            From File
          </DropdownItem>
          <DropdownItem onClick={handleImportUri}>
            <i className="fa fa-link" />
            From URL
          </DropdownItem>
          <DropdownItem onClick={handleImportClipBoard}>
            <i className="fa fa-clipboard" />
            From Clipboard
          </DropdownItem>
        </Dropdown>
          &nbsp;&nbsp;
        <Link href="https://insomnia.rest/create-run-button" className="btn btn--compact" button>
          Create Run Button
        </Link>
      </div>
      <p className="italic faint">* Tip: You can also paste Curl commands into the URL bar</p>
    </div>
  );
};
