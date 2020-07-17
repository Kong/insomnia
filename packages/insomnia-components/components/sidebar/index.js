// @flow
import * as React from 'react';
import { useState } from 'react';
import { motion } from 'framer-motion';
import styled from 'styled-components';
import SidebarHeader from './sidebar-header';
import SidebarInfo from './sidebar-info';
import SidebarServers from './sidebar-servers';
import SidebarPaths from './sidebar-paths';
import SidebarRequests from './sidebar-requests';
import SidebarResponses from './sidebar-responses';
import SidebarParameters from './sidebar-parameters';
import SidebarHeaders from './sidebar-headers';
import SidebarSchemas from './sidebar-schemas';
import SidebarSecurity from './sidebar-security';
import Dropdown from '../dropdown/dropdown';
import DropdownItem from '../dropdown/dropdown-item';
import DropdownDivider from '../dropdown/dropdown-divider';
import SvgIcon, { IconEnum } from '../svg-icon';

type Props = {|
  className?: string,
  jsonData: Object,
|};

const StyledSidebar: React.ComponentType<{}> = styled.div`
  width: 100%;
  height: 100%;
  background-color: var(--color-bg);
  border: none;
  color: var(--color-font);
  position: relative;
  svg {
    font-size: var(--font-size-xl);
    fill: var(--hl-lg);
  }
  ul:first-child {
    border-top: none;
  }
  ul:last-child {
    border-bottom: none;
  }
`;

const StyledSection: React.ComponentType<{}> = styled(motion.ul)`
  overflow: hidden;
  box-sizing: border-box;
  border-bottom: 1px solid var(--hl-md);
`;

const DropdownEllipsis = () => <SvgIcon icon={IconEnum.ellipsesCircle} />;
// Section Expansion & Filtering
const useToggle = (state, set) =>
  React.useCallback(
    (e: SyntheticKeyboardEvent<HTMLButtonElement>) => {
      // e.stopPropagation();
      set(!state);
    },
    [set, state],
  );

function Sidebar(props: Props) {
  // Info
  const [infoSec, setInfoSec] = useState(false);
  const toggleInfoSec = useToggle(infoSec, setInfoSec);

  // Section Visibility
  const [pathsVisible, setPathsVisible] = useState(true);
  const handlePathsVisibleClick = useToggle(pathsVisible, setPathsVisible);
  const [serversVisible, setServersVisible] = useState(true);
  const handleServersVisibleClick = useToggle(serversVisible, setServersVisible);
  const [requestsVisible, setRequestsVisible] = useState(true);
  const handleRequestsVisibleClick = useToggle(requestsVisible, setRequestsVisible);
  const [responsesVisible, setResponsesVisible] = useState(true);
  const handleResponsesVisibleClick = useToggle(responsesVisible, setResponsesVisible);
  const [parametersVisible, setParametersVisible] = useState(true);
  const handleParametersVisibleClick = useToggle(parametersVisible, setParametersVisible);
  const [headersVisible, setHeadersVisible] = useState(true);
  const handleHeadersVisibleClick = useToggle(headersVisible, setHeadersVisible);
  const [schemasVisible, setSchemasVisible] = useState(true);
  const handleSchemasVisibleClick = useToggle(schemasVisible, setSchemasVisible);
  const [securityVisible, setSecurityVisible] = useState(true);
  const handleSecurityVisibleClick = useToggle(securityVisible, setSecurityVisible);

  // Sections
  if (props.jsonData === null) {
    return null;
  }
  const { servers } = props.jsonData;
  const {
    requestBodies,
    responses,
    parameters,
    headers,
    schemas,
    securitySchemes,
  } = props.jsonData.components;
  const paths = Object.entries(props.jsonData.paths);

  return (
    <StyledSidebar className="theme--sidebar">
      <StyledSection>
        <SidebarHeader headerTitle="INFO" sectionVisible={infoSec} toggleSection={toggleInfoSec}>
          <Dropdown renderButton={DropdownEllipsis}>
            <DropdownDivider>VISIBILITY</DropdownDivider>
            <DropdownItem stayOpenAfterClick>
              <input
                type="checkbox"
                onClick={handleServersVisibleClick}
                defaultChecked={serversVisible}
              />
              <label htmlFor="servers">Servers</label>
            </DropdownItem>
            <DropdownItem stayOpenAfterClick>
              <input
                type="checkbox"
                onClick={handlePathsVisibleClick}
                defaultChecked={pathsVisible}
              />
              <label htmlFor="paths">Paths</label>
            </DropdownItem>
            <DropdownItem stayOpenAfterClick>
              <input
                type="checkbox"
                onClick={handleRequestsVisibleClick}
                defaultChecked={requestsVisible}
              />
              <label htmlFor="requests">Requests</label>
            </DropdownItem>
            <DropdownItem stayOpenAfterClick>
              <input
                type="checkbox"
                onClick={handleResponsesVisibleClick}
                defaultChecked={responsesVisible}
              />
              <label htmlFor="responses">Responses</label>
            </DropdownItem>
            <DropdownItem stayOpenAfterClick>
              <input
                type="checkbox"
                onClick={handleParametersVisibleClick}
                defaultChecked={parametersVisible}
              />
              <label htmlFor="parameters">Parameters</label>
            </DropdownItem>
            <DropdownItem stayOpenAfterClick>
              <input
                type="checkbox"
                onClick={handleHeadersVisibleClick}
                defaultChecked={headersVisible}
              />
              <label htmlFor="headers">Headers</label>
            </DropdownItem>
            <DropdownItem stayOpenAfterClick>
              <input
                type="checkbox"
                onClick={handleSchemasVisibleClick}
                defaultChecked={schemasVisible}
              />
              <label htmlFor="schemas">Schemas</label>
            </DropdownItem>
            <DropdownItem stayOpenAfterClick>
              <input
                type="checkbox"
                onClick={handleSecurityVisibleClick}
                defaultChecked={securityVisible}
              />
              <label htmlFor="security">Security</label>
            </DropdownItem>
          </Dropdown>
        </SidebarHeader>
        <SidebarInfo childrenVisible={infoSec} info={props.jsonData.info} />
      </StyledSection>
      {serversVisible && servers && <SidebarServers servers={servers} />}
      {pathsVisible && paths && <SidebarPaths paths={paths} />}
      {requestsVisible && requestBodies && <SidebarRequests requests={requestBodies} />}
      {responsesVisible && responses && <SidebarResponses responses={responses} />}
      {parametersVisible && parameters && <SidebarParameters parameters={parameters} />}
      {headersVisible && headers && <SidebarHeaders headers={headers} />}
      {schemasVisible && schemas && <SidebarSchemas schemas={schemas} />}
      {securityVisible && schemas && <SidebarSecurity security={securitySchemes} />}
    </StyledSidebar>
  );
}

export default Sidebar;
