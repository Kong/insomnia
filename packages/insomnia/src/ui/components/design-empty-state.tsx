import fs from 'fs';
import React, { FC, useCallback } from 'react';
import { useSelector } from 'react-redux';
import styled from 'styled-components';

import { documentationLinks } from '../../common/documentation';
import { selectFileOrFolder } from '../../common/select-file-or-folder';
import { faint } from '../css/css-in-js';
import { selectActiveApiSpec } from '../redux/selectors';
import { Dropdown } from './base/dropdown/dropdown';
import { DropdownButton } from './base/dropdown/dropdown-button';
import { DropdownItem } from './base/dropdown/dropdown-item';
import { showPrompt } from './modals';
import { EmptyStatePane } from './panes/empty-state-pane';
import { SvgIcon } from './svg-icon';
import { Button } from './themed-button';

const Wrapper = styled.div({
  position: 'absolute',
  top: '50%',
  transform: 'translateY(-50%)',
  pointerEvents: 'none',
  width: '100%',
});

const StyledButton = styled(Button)({
  '&&': {
    pointerEvents: 'all',
    color: 'var(--color-font)',
    marginTop: 'var(--padding-md)',
    marginLeft: '0 !important', // unfortunately, we're in specificty battle with a default marginLeft
  },
});

const ExampleButton = styled.div({
  cursor: 'pointer',
  display: 'inline',
  textDecoration: 'underline',
  pointerEvents: 'all',
  '&:hover': {
    ...faint,
  },
});

interface Props {
  onImport: (contents: string) => void;
}

const ImportSpecButton: FC<Props> = ({ onImport }) => {
  const handleImportFile = useCallback(async () => {
    const { canceled, filePath } = await selectFileOrFolder({
      extensions: ['yml', 'yaml', 'json'],
      itemTypes: ['file'],
    });
    // Exit if no file selected
    if (canceled || !filePath) {
      return;
    }

    const contents = String(await fs.promises.readFile(filePath));
    onImport(contents);
  }, [onImport]);

  const handleImportUri = useCallback(async () => {
    showPrompt({
      title: 'Import document from URL',
      submitName: 'Fetch and Import',
      label: 'URL',
      placeholder: 'e.g. https://petstore.swagger.io/v2/swagger.json',
      onComplete: async (uri: string) => {
        const response = await window.fetch(uri);
        if (!response) {
          return;
        }
        const contents = await response.text();
        onImport(contents);
      },
    });
  }, [onImport]);

  return (
    <Dropdown>
      <DropdownButton buttonClass={StyledButton}>
        Import OpenAPI
        <i className="fa fa-caret-down pad-left-sm" />
      </DropdownButton>
      <DropdownItem
        onClick={handleImportFile}
      >
        <i className="fa fa-plus" />
        File
      </DropdownItem>
      <DropdownItem
        onClick={handleImportUri}
      >
        <i className="fa fa-link" />
        URL
      </DropdownItem>
    </Dropdown>
  );
};

const SecondaryAction: FC<Props> = ({ onImport }) => {
  const PETSTORE_EXAMPLE_URI = 'https://gist.githubusercontent.com/gschier/4e2278d5a50b4bbf1110755d9b48a9f9/raw/801c05266ae102bcb9288ab92c60f52d45557425/petstore-spec.yaml';

  const onClick = useCallback(async () => {
    const response = await window.fetch(PETSTORE_EXAMPLE_URI);
    if (!response) {
      return;
    }
    const contents = await response.text();
    onImport(contents);
  }, [onImport]);

  return (
    <div>
      <div>
        Or import an existing OpenAPI spec or <ExampleButton onClick={onClick}>start from an example</ExampleButton>
      </div>
      <ImportSpecButton onImport={onImport} />
    </div>
  );
};

export const DesignEmptyState: FC<Props> = ({ onImport }) => {
  const activeApiSpec = useSelector(selectActiveApiSpec);

  if (!activeApiSpec || activeApiSpec.contents) {
    return null;
  }

  return (
    <Wrapper>
      <EmptyStatePane
        icon={<SvgIcon icon="drafting-compass" />}
        documentationLinks={[
          documentationLinks.workingWithDesignDocs,
          documentationLinks.introductionToInsomnia,
        ]}
        secondaryAction={<SecondaryAction onImport={onImport} />}
        title="Enter an OpenAPI specification here"
      />
    </Wrapper>
  );
};
