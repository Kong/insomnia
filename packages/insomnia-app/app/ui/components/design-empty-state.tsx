import fs from 'fs';
import { Button, Dropdown, DropdownItem, SvgIcon } from 'insomnia-components';
import React, { FC, useCallback } from 'react';
import { useSelector } from 'react-redux';
import styled from 'styled-components';

import { documentationLinks } from '../../common/documentation';
import { selectFileOrFolder } from '../../common/select-file-or-folder';
import * as models from '../../models';
import { faint } from '../css/css-in-js';
import { selectActiveApiSpec } from '../redux/selectors';
import { showPrompt } from './modals';
import { EmptyStatePane } from './panes/empty-state-pane';

const Wrapper = styled.div({
  position: 'absolute',
  top: '50%',
  transform: 'translateY(-50%)',
  pointerEvents: 'none',
  width: '100%',
});

const StyledButton = styled(Button)({
  pointerEvents: 'all',
  color: 'var(--color-font)',
  marginTop: 'var(--padding-md)',
  marginLeft: '0 !important', // unfortunately, we're in specificty battle with a default marginLeft
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
  onUpdateContents: (contents: string) => void;
}

const useUpdateApiSpecContents = () => {
  const activeApiSpec = useSelector(selectActiveApiSpec);
  return useCallback(async (contents: string) => {
    if (!contents) {
      return;
    }
    if (!activeApiSpec) {
      return;
    }
    await models.apiSpec.update(activeApiSpec, { contents });
  }, [activeApiSpec]);
};

const ImportSpecButton: FC<Props> = ({ onUpdateContents }) => {
  const updateApiSpecContents = useUpdateApiSpecContents();

  const handleImportFile = useCallback(async () => {
    const { canceled, filePath } = await selectFileOrFolder({
      extensions: ['yml', 'yaml'],
      itemTypes: ['file'],
    });
    // Exit if no file selected
    if (canceled || !filePath) {
      return;
    }

    const contents = String(await fs.promises.readFile(filePath));
    await updateApiSpecContents(contents);
  }, [updateApiSpecContents]);

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
        await updateApiSpecContents(contents);
        onUpdateContents(contents);
      },
    });
  }, [updateApiSpecContents, onUpdateContents]);

  const button = (
    <StyledButton variant="outlined" bg="surprise" className="margin-left">
      Import
      <i className="fa fa-caret-down pad-left-sm" />
    </StyledButton>
  );

  return (
    <Dropdown renderButton={button}>
      <DropdownItem
        icon={<i className="fa fa-plus" />}
        onClick={handleImportFile}
      >
        File
      </DropdownItem>
      <DropdownItem
        icon={<i className="fa fa-link" />}
        onClick={handleImportUri}
      >
        URL
      </DropdownItem>
    </Dropdown>
  );
};

const SecondaryAction: FC<Props> = ({ onUpdateContents }) => {
  const PETSTORE_EXAMPLE_URI = 'https://gist.githubusercontent.com/gschier/4e2278d5a50b4bbf1110755d9b48a9f9/raw/801c05266ae102bcb9288ab92c60f52d45557425/petstore-spec.yaml';

  const updateApiSpecContents = useUpdateApiSpecContents();
  const onClick = useCallback(async () => {
    const response = await window.fetch(PETSTORE_EXAMPLE_URI);
    if (!response) {
      return;
    }
    const contents = await response.text();
    await updateApiSpecContents(contents);
    onUpdateContents(contents);
  }, [updateApiSpecContents, onUpdateContents]);

  return (
    <div>
      <div>
        Or import existing an OpenAPI spec or <ExampleButton onClick={onClick}>start from an example</ExampleButton>
      </div>
      <ImportSpecButton onUpdateContents={onUpdateContents} />
    </div>
  );
};

export const DesignEmptyState: FC<Props> = ({ onUpdateContents }) => {
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
        secondaryAction={<SecondaryAction onUpdateContents={onUpdateContents} />}
        title="Enter an OpenAPI specification here"
      />
    </Wrapper>
  );
};
