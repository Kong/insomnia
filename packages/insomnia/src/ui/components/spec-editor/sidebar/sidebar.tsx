import React, { FunctionComponent } from 'react';
import useToggle from 'react-use/lib/useToggle';
import styled from 'styled-components';
import { Button } from '../../base/dropdown-aria/button';

import { Dropdown, DropdownItem, DropdownSection, ItemContent } from '../../base/dropdown-aria/dropdown';
import { IconEnum, SvgIcon } from '../../svg-icon';
import { SidebarHeader } from './sidebar-header';
import { SidebarHeaders } from './sidebar-headers';
import { SidebarInfo, SidebarInfoType } from './sidebar-info';
import { SidebarParameters } from './sidebar-parameters';
import { SidebarPaths, SidebarPathsType } from './sidebar-paths';
import { SidebarRequests } from './sidebar-requests';
import { SidebarResponses } from './sidebar-responses';
import { SidebarSchemas } from './sidebar-schemas';
import { SidebarSecurity } from './sidebar-security';
import { SidebarServer, SidebarServers } from './sidebar-servers';

export interface SidebarProps {
  className?: string;
  onClick: (section: string, path: any) => void;
  jsonData?: {
    servers?: SidebarServer[];
    info?: SidebarInfoType;
    paths?: SidebarPathsType;
    components?: {
      requestBodies?: Record<string, any>;
      responses?: Record<string, any>;
      parameters?: Record<string, any>;
      headers?: Record<string, any>;
      schemas?: Record<string, any>;
      securitySchemes?: Record<string, any>;
    };
  };
  pathItems?: Record<string, any>[];
}

const StyledSidebar = styled.div`
  width: 100%;
  height: 100%;
  background-color: var(--color-bg);
  border: none;
  color: var(--color-font);
  position: relative;
  svg {
    fill: var(--hl-lg);
  }
  ul:first-child {
    border-top: none;
  }
  ul:last-child {
    border-bottom: none;
  }
`;

const StyledSection = styled.ul`
  overflow: hidden;
  box-sizing: border-box;
  border-bottom: 1px solid var(--hl-md);
`;

const StyledItem = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--padding-xs)',

  label: {
    paddingTop: 0,
  },
});

const DropdownEllipsis = () => <SvgIcon icon={IconEnum.ellipsesCircle} />;

// Section Expansion & Filtering
export const Sidebar: FunctionComponent<SidebarProps> = ({ jsonData, onClick }) => {
  // Section Visibility
  const [infoSec, setInfoSec] = useToggle(false);
  const [pathsVisible, setPathsVisible] = useToggle(true);
  const [serversVisible, setServersVisible] = useToggle(true);
  const [requestsVisible, setRequestsVisible] = useToggle(true);
  const [responsesVisible, setResponsesVisible] = useToggle(true);
  const [parametersVisible, setParametersVisible] = useToggle(true);
  const [headersVisible, setHeadersVisible] = useToggle(true);
  const [schemasVisible, setSchemasVisible] = useToggle(true);
  const [securityVisible, setSecurityVisible] = useToggle(true);

  // Sections
  if (jsonData === null) {
    return null;
  }

  const {
    servers,
    info,
    paths,
  } = jsonData || {};

  const {
    requestBodies,
    responses,
    parameters,
    headers,
    schemas,
    securitySchemes,
  } = jsonData?.components || {};

  return (
    <StyledSidebar className="theme--sidebar">
      {info && (
        <StyledSection>
          <SidebarHeader headerTitle="INFO" sectionVisible={infoSec} toggleSection={setInfoSec}>
            <Dropdown
              triggerButton={
                <Button>
                  <DropdownEllipsis />
                </Button>
              }
            >
              <DropdownSection title="VISIBILITY">
                <DropdownItem>
                  <ItemContent onClick={setServersVisible}>
                    <StyledItem>
                      <input type="checkbox" checked={serversVisible} readOnly />
                      <label htmlFor="servers">Servers</label>
                    </StyledItem>
                  </ItemContent>
                </DropdownItem>
                <DropdownItem>
                  <ItemContent onClick={setPathsVisible}>
                    <StyledItem>
                      <input type="checkbox" checked={pathsVisible} readOnly />
                      <label htmlFor="paths">Paths</label>
                    </StyledItem>
                  </ItemContent>
                </DropdownItem>
                <DropdownItem>
                  <ItemContent onClick={setRequestsVisible}>
                    <StyledItem>
                      <input type="checkbox" checked={requestsVisible} readOnly />
                      <label htmlFor="requests">Requests</label>
                    </StyledItem>
                  </ItemContent>
                </DropdownItem>
                <DropdownItem>
                  <ItemContent onClick={setResponsesVisible}>
                    <StyledItem>
                      <input type="checkbox" checked={responsesVisible} readOnly />
                      <label htmlFor="responses">Responses</label>
                    </StyledItem>
                  </ItemContent>
                </DropdownItem>
                <DropdownItem>
                  <ItemContent onClick={setParametersVisible}>
                    <StyledItem>
                      <input type="checkbox" checked={parametersVisible} readOnly />
                      <label htmlFor="parameters">Parameters</label>
                    </StyledItem>
                  </ItemContent>
                </DropdownItem>
                <DropdownItem>
                  <ItemContent onClick={setHeadersVisible}>
                    <StyledItem>
                      <input type="checkbox" checked={headersVisible} readOnly />
                      <label htmlFor="headers">Headers</label>
                    </StyledItem>
                  </ItemContent>
                </DropdownItem>
                <DropdownItem>
                  <ItemContent onClick={setSchemasVisible}>
                    <StyledItem>
                      <input type="checkbox" checked={schemasVisible} readOnly />
                      <label htmlFor="schemas">Schemas</label>
                    </StyledItem>
                  </ItemContent>
                </DropdownItem>
                <DropdownItem>
                  <ItemContent onClick={setSecurityVisible}>
                    <StyledItem>
                      <input type="checkbox" checked={securityVisible} readOnly />
                      <label htmlFor="security">Security</label>
                    </StyledItem>
                  </ItemContent>
                </DropdownItem>
              </DropdownSection>
            </Dropdown>
          </SidebarHeader>
          <SidebarInfo childrenVisible={infoSec} info={info} onClick={onClick} />
        </StyledSection>
      )}
      {serversVisible && servers && <SidebarServers servers={servers} onClick={onClick} />}
      {pathsVisible && paths && <SidebarPaths paths={paths} onClick={onClick} />}
      {requestsVisible && requestBodies && (
        <SidebarRequests requests={requestBodies} onClick={onClick} />
      )}
      {responsesVisible && responses && (
        <SidebarResponses responses={responses} onClick={onClick} />
      )}
      {parametersVisible && parameters && (
        <SidebarParameters parameters={parameters} onClick={onClick} />
      )}
      {headersVisible && headers && <SidebarHeaders headers={headers} onClick={onClick} />}
      {schemasVisible && schemas && <SidebarSchemas schemas={schemas} onClick={onClick} />}
      {securityVisible && securitySchemes && (
        <SidebarSecurity security={securitySchemes} onClick={onClick} />
      )}
    </StyledSidebar>
  );
};
