import React, { FC, useCallback } from 'react';
import { Dropdown, DropdownButton, DropdownDivider, DropdownItem } from '../base/dropdown';
import Link from '../base/link';
import { showModal, showPrompt } from '../modals/index';
import { docsImportExport } from '../../../common/documentation';
import { strings } from '../../../common/strings';
import { useDispatch, useSelector } from 'react-redux';
import { selectActiveSpace, selectActiveSpaceName, selectActiveWorkspace } from '../../redux/selectors';
import ExportRequestsModal from '../modals/export-requests-modal';
import { exportAllToFile, importClipBoard, importFile, importUri } from '../../redux/modules/global';

interface Props {
  hideSettingsModal: () => void;
}

export const ImportExport: FC<Props> = ({ hideSettingsModal }) => {
  const dispatch = useDispatch();
  const space = useSelector(selectActiveSpace);
  const spaceName = useSelector(selectActiveSpaceName);
  const activeWorkspace = useSelector(selectActiveWorkspace);
  const activeResourceScope = activeWorkspace.scope === 'collection' ? strings.collection : strings.document;

  const handleImportUri = useCallback(() => {
    const lastUsedImportUri = window.localStorage.getItem('insomnia.lastUsedImportUri');
    const defaultValue = lastUsedImportUri ? { defaultValue: lastUsedImportUri } : {};
    showPrompt({
      title: 'Import Data from URL',
      submitName: 'Fetch and Import',
      label: 'URL',
      placeholder: 'https://website.com/insomnia-import.json',
      onComplete: async (uri: string) => {
        window.localStorage.setItem('insomnia.lastUsedImportUri', uri);
        await importUri(activeWorkspace._id, uri)(dispatch);
        hideSettingsModal();
      },
      ...defaultValue,
    });
  }, [hideSettingsModal, activeWorkspace, dispatch]);

  const showExportRequestsModal = useCallback(() => {
    showModal(ExportRequestsModal);
    hideSettingsModal();
  }, [hideSettingsModal]);

  const handleExportAllToFile = useCallback(async () => {
    await exportAllToFile(dispatch)(space?._id);
    hideSettingsModal();
  }, [hideSettingsModal, space, dispatch]);

  const handleImportFile = useCallback(async () => {
    await importFile(activeWorkspace._id)(dispatch);
    hideSettingsModal();
  }, [hideSettingsModal, activeWorkspace, dispatch]);

  const handleImportClipBoard = useCallback(async () => {
    await importClipBoard(activeWorkspace._id)(dispatch);
    hideSettingsModal();
  }, [hideSettingsModal, activeWorkspace, dispatch]);

  return (
    <div>
      <p className="no-margin-top">
          Import format will be automatically detected (
        <strong>Insomnia, Postman v2, HAR, Curl, Swagger, OpenAPI v3</strong>)
      </p>
      <p>
          Don't see your format here? <Link href={docsImportExport}>Add Your Own</Link>.
      </p>
      <div className="pad-top">
        <Dropdown outline>
          <DropdownButton className="btn btn--clicky">
              Export Data <i className="fa fa-caret-down" />
          </DropdownButton>
          <DropdownDivider>Choose Export Type</DropdownDivider>
          <DropdownItem onClick={showExportRequestsModal}>
            <i className="fa fa-home" />
              Export Requests from the "{activeWorkspace.name}" {activeResourceScope.singular}
          </DropdownItem>
          <DropdownItem onClick={handleExportAllToFile}>
            <i className="fa fa-empty" />
              All {strings.document.plural} and {strings.collection.plural} from the "{spaceName}" {strings.space.singular}
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
