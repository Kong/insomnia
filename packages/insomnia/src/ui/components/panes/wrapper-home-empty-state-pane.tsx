import { Button, Dropdown, DropdownItem } from 'insomnia-components';
import React, { FC } from 'react';
import styled from 'styled-components';

import { superFaint, ultraFaint } from '../../css/css-in-js';

const Wrapper = styled.div({
  maxHeight: '100%',
  height: 'calc(100% - 4 * var(--padding-xl))',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 'var(--padding-xl) var(--padding-xl)',
  textAlign: 'center',
  ...superFaint,
});

const Divider = styled.div({
  color: 'var(--color-font)',
  maxWidth: 500,
  width: '100%',
  margin: 'var(--padding-md) 0',
  display: 'flex',
  alignItems: 'center',
  fontSize: 'var(--text-sm)',
  '&::before': {
    content: '""',
    height: '1px',
    backgroundColor: 'var(--color-font)',
    flexGrow: '1',
    ...ultraFaint,
    marginRight: '1rem',
  },
  '&::after': {
    content: '""',
    height: '1px',
    backgroundColor: 'var(--color-font)',
    flexGrow: '1',
    ...ultraFaint,
    marginLeft: '1rem',
  },
});

const Title = styled.div({
  fontWeight: 'bold',
});

interface Props {
  createRequestCollection: () => void;
  createDesignDocument: () => void;
  importFromFile: () => void;
  importFromURL: () => void;
  importFromClipboard: () => void;
  importFromGit: () => void;
}

export const WrapperHomeEmptyStatePane: FC<Props> = ({ createRequestCollection, createDesignDocument, importFromFile, importFromURL, importFromClipboard, importFromGit }) => {
  return (
    <Wrapper>
      <Title>This is an empty project, to get started create your first resource:</Title>
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', marginTop: 'var(--padding-md)' }}>
        <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 'var(--padding-md)', gap: 'var(--padding-md)' }}>
          <Button
            onClick={createRequestCollection}
          >
            New Collection
          </Button>
          <Button
            onClick={createDesignDocument}
          >
            New Document
          </Button>
        </div>
        <Divider>or</Divider>
        <Dropdown
          style={{ alignSelf: 'stretch' }}
          renderButton={<Button style={{ width: '100%' }}>
            Import From <i className="fa fa-caret-down pad-left-sm" />
          </Button>}
        >
          <DropdownItem
            icon={<i className="fa fa-plus" />}
            onClick={importFromFile}
          >
            File
          </DropdownItem>
          <DropdownItem
            icon={<i className="fa fa-link" />}
            onClick={importFromURL}
          >
            URL
          </DropdownItem>
          <DropdownItem
            icon={<i className="fa fa-clipboard" />}
            onClick={importFromClipboard}
          >
            Clipboard
          </DropdownItem>
          <DropdownItem
            icon={<i className="fa fa-code-fork" />}
            onClick={importFromGit}
          >
            Git Clone
          </DropdownItem>
        </Dropdown>
      </div>
    </Wrapper>
  );
};
