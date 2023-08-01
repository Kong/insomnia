import fs from 'fs';
import React, { FC, useCallback } from 'react';
import styled from 'styled-components';

import { documentationLinks } from '../../common/documentation';
import { selectFileOrFolder } from '../../common/select-file-or-folder';
import { Dropdown, DropdownButton, DropdownItem, ItemContent } from './base/dropdown';
import { showPrompt } from './modals';
import { EmptyStatePane } from './panes/empty-state-pane';
import { SvgIcon } from './svg-icon';
const Wrapper = styled.div({
  position: 'absolute',
  top: '50%',
  transform: 'translateY(-50%)',
  pointerEvents: 'none',
  width: '100%',
});

const StyledDropdownButton = styled(DropdownButton)({
  '&&': {
    pointerEvents: 'all',
    color: 'var(--color-font)',
    marginTop: 'var(--padding-md)',
    marginLeft: '0 !important', // unfortunately, we're in specificity battle with a default marginLeft
  },
});

const ExampleButton = styled.div({
  cursor: 'pointer',
  display: 'inline',
  textDecoration: 'underline',
  pointerEvents: 'all',
  '&:hover': {
    opacity: 'var(--opacity-subtle)',
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
    <Dropdown
      aria-label='Import OpenAPI Dropdown'
      triggerButton={
        <StyledDropdownButton
          variant='outlined'
          removePaddings={false}
          disableHoverBehavior={false}
        >
          Import OpenAPI
          <i className="fa fa-caret-down pad-left-sm" />
        </StyledDropdownButton>
      }
    >
      <DropdownItem aria-label='File'>
        <ItemContent
          icon="plus"
          label="File"
          onClick={handleImportFile}
        />
      </DropdownItem>
      <DropdownItem aria-label='URL'>
        <ItemContent
          icon="link"
          label="URL"
          onClick={handleImportUri}
        />
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
