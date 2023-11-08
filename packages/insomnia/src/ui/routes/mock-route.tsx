import React from 'react';
import { Button, Tabs } from 'react-aria-components';
import { LoaderFunction } from 'react-router-dom';
import styled from 'styled-components';

import { HTTP_METHODS } from '../../common/constants';
import { invariant } from '../../utils/invariant';
import { Dropdown, DropdownButton, DropdownItem, ItemContent } from '../components/base/dropdown';
import { TabItem } from '../components/base/tabs';
import { OneLineEditor } from '../components/codemirror/one-line-editor';
import { RequestHeadersEditor } from '../components/editors/request-headers-editor';
import { Pane, PaneBody, PaneHeader } from '../components/panes/pane';

export const loader: LoaderFunction = async ({
  request,
  params,
}): Promise<{}> => {
  const { organizationId, projectId, workspaceId } = params;
  invariant(organizationId, 'Organization ID is required');
  invariant(projectId, 'Project ID is required');
  invariant(workspaceId, 'Workspace ID is required');
  return {};
};
const StyledUrlBar = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: stretch;
`;

const StyledUrlEditor = styled.div`
  flex: 1;
`;

const StyledDropdownButton = styled(DropdownButton)({
  '&&': {
    paddingLeft: 'var(--padding-sm)',
  },
});

export const MockRouteRoute = () => {
  const mockUrl = 'url goes here?';
  const method = 'GET';
  return (
    <Pane type="request">
      <PaneHeader>
        <StyledUrlBar>
          <Dropdown
            className="method-dropdown"
            triggerButton={
              <StyledDropdownButton className={'pad-right pad-left vertically-center'}>
                <span className={`http-method-${method}`}>{method}</span>{' '}
                <i className="fa fa-caret-down space-left" />
              </StyledDropdownButton>
            }
          >      {HTTP_METHODS.map(method => (
            <DropdownItem key={method}>
              <ItemContent
                className={`http-method-${method}`}
                label={method}
              // onClick={() => onChange(method)}
              />
            </DropdownItem>
          ))}
          </Dropdown>
          <StyledUrlEditor title={mockUrl}>
            <OneLineEditor
              id="grpc-url"
              type="text"
              defaultValue={mockUrl}
              placeholder="something"
            // onChange={url => patchRequest(requestId, { url })}
            // getAutocompleteConstants={() => queryAllWorkspaceUrls(workspaceId, models.grpcRequest.type, requestId)}
            />
          </StyledUrlEditor>
          <div className='flex p-1'>
            <Button>Test</Button>
          </div>
        </StyledUrlBar>
      </PaneHeader>
      <PaneBody>
        <Tabs aria-label="Websocket request pane tabs">
          <TabItem key="mock-body" title="Mock Body">
            <div>body</div>
          </TabItem>
          <TabItem key="headers" title="Mock Headers">
            <RequestHeadersEditor
              bulk={false}
            />
          </TabItem>
        </Tabs>
      </PaneBody>
    </Pane>
  );
};
