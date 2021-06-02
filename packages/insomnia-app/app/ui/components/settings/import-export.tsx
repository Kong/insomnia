import React, { FC, useCallback } from 'react';
import { Dropdown, DropdownButton, DropdownDivider, DropdownItem } from '../base/dropdown';
import Link from '../base/link';
import { showPrompt } from '../modals/index';
import { docsImportExport } from '../../../common/documentation';
import { strings } from '../../../common/strings';

interface Props {
  handleImportFile: () => void;
  handleImportClipBoard: () => void;
  handleImportUri: (uri: string) => void;
  handleExportAllToFile: () => void;
  handleShowExportRequestsModal: () => void;
}

export const ImportExport: FC<Props> = ({
  handleImportFile,
  handleImportClipBoard,
  handleExportAllToFile,
  handleShowExportRequestsModal,
  handleImportUri,
}) => {
  const importUri = useCallback(() => {
    const lastUsedImportUri = window.localStorage.getItem('insomnia.lastUsedImportUri');
    const defaultValue = lastUsedImportUri ? { defaultValue: lastUsedImportUri } : {};
    showPrompt({
      title: 'Import Data from URL',
      submitName: 'Fetch and Import',
      label: 'URL',
      placeholder: 'https://website.com/insomnia-import.json',
      onComplete: (uri: string) => {
        window.localStorage.setItem('insomnia.lastUsedImportUri', uri);
        handleImportUri(uri);
      },
      ...defaultValue,
    });
  }, [handleImportUri]);

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
          <DropdownItem onClick={handleShowExportRequestsModal}>
            <i className="fa fa-home" />
              Current {strings.document.singular} / {strings.collection.singular}
          </DropdownItem>
          <DropdownItem onClick={handleExportAllToFile}>
            <i className="fa fa-empty" />
              All {strings.document.plural} / {strings.collection.plural}
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
          <DropdownItem onClick={importUri}>
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
