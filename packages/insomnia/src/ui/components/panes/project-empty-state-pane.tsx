import React, { FC } from 'react';
import styled from 'styled-components';

import { Dropdown, DropdownButton, DropdownItem, ItemContent } from '../base/dropdown';
import { Button } from '../themed-button';

const Wrapper = styled.div({
  height: '100%',
  boxSizing: 'border-box',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  opacity: 'calc(var(--opacity-subtle) * 0.8)',
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
    opacity: 'calc(var(--opacity-subtle) * 0.8)',
    marginRight: '1rem',
  },
  '&::after': {
    content: '""',
    height: '1px',
    backgroundColor: 'var(--color-font)',
    flexGrow: '1',
    opacity: 'calc(var(--opacity-subtle) * 0.8)',
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

export const EmptyStatePane: FC<Props> = ({ createRequestCollection, createDesignDocument, importFromFile, importFromURL, importFromClipboard, importFromGit }) => {
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
          aria-label='Import From Dropdown'
          triggerButton={
            <DropdownButton style={{ width: '100%', alignSelf: 'stretch' }}>
              Import From <i className="fa fa-caret-down pad-left-sm" />
            </DropdownButton>
          }
        >
          <DropdownItem aria-label='File'>
            <ItemContent
              icon="plus"
              label="File"
              onClick={importFromFile}
            />
          </DropdownItem>
          <DropdownItem aria-label='URL'>
            <ItemContent
              icon="link"
              label="URL"
              onClick={importFromURL}
            />
          </DropdownItem>
          <DropdownItem aria-label='Clipboard'>
            <ItemContent
              icon="clipboard"
              label="Clipboard"
              onClick={importFromClipboard}
            />
          </DropdownItem>
          <DropdownItem aria-label='Git Clone'>
            <ItemContent
              icon="code-fork"
              label="Git Clone"
              onClick={importFromGit}
            />
          </DropdownItem>
        </Dropdown>
      </div>
    </Wrapper>
  );
};
