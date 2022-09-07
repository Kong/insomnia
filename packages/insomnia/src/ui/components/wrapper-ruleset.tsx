import React, { createRef, FC, ReactNode, RefObject, useMemo } from 'react';
import { useSelector } from 'react-redux';
import styled from 'styled-components';

import { debounce } from '../../common/misc';
import * as models from '../../models/index';
import { superFaint } from '../css/css-in-js';
import { selectActiveApiSpecRuleset } from '../redux/selectors';
import { CodeEditor, UnconnectedCodeEditor } from './codemirror/code-editor';
import { PageLayout } from './page-layout';
import { WorkspacePageHeader } from './workspace-page-header';
import type { HandleActivityChange } from './wrapper';

const RenderEditor: FC<{ editor: RefObject<UnconnectedCodeEditor> }> = ({ editor }) => {
  const activeApiSpecRuleset = useSelector(selectActiveApiSpecRuleset);
  const contents = activeApiSpecRuleset?.contents ?? '';

  const onCodeEditorChange = useMemo(() => {
    const handler = async (contents: string) => {
      if (!activeApiSpecRuleset) {
        return;
      }

      await models.apiSpecRuleset.updateOrCreateForParentId(activeApiSpecRuleset.parentId, { ...activeApiSpecRuleset, contents});
    };

    return debounce(handler, 500);
  }, [activeApiSpecRuleset]);

  if (!activeApiSpecRuleset) {
    return null;
  }

  const uniquenessKey = `${activeApiSpecRuleset?._id}`;

  return (
    <div className="column tall theme--pane__body">
      <div className="tall relative overflow-hidden">
        <CodeEditor
          manualPrettify
          ref={editor}
          lintOptions={{ delay: 1000 }}
          mode="openapi"
          defaultValue={contents}
          onChange={onCodeEditorChange}
          uniquenessKey={uniquenessKey}
        />
      </div>
    </div>
  );
};

const EmptySpaceHelper = styled.div({
  ...superFaint,
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  padding: '2em',
  textAlign: 'center',
});

const RenderPageSidebar: FC = () => {

  return (
    <EmptySpaceHelper>
     <p>These custom rulesets are Spectral-compatible: <br /><br />
      <a href="https://meta.stoplight.io/docs/spectral/e5b9616d6d50c-custom-rulesets">Learn More</a>
      </p>
    </EmptySpaceHelper>
  );
};

interface Props {
  gitSyncDropdown: ReactNode;
  handleActivityChange: HandleActivityChange;
}

export const WrapperRuleset: FC<Props> = ({
  gitSyncDropdown,
  handleActivityChange,
}) => {
  const editor = createRef<UnconnectedCodeEditor>();

  return (
    <PageLayout
      renderPageHeader={(
        <WorkspacePageHeader
          handleActivityChange={handleActivityChange}
          gridRight={gitSyncDropdown}
        />
      )}
      renderPaneOne={<RenderEditor editor={editor} />}
      renderPageSidebar={<RenderPageSidebar />}
    />
  );
};

export default WrapperRuleset;
