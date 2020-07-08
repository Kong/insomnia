// @flow
import * as React from 'react';
import { useState } from 'react';
import { motion } from 'framer-motion';
import styled from 'styled-components';
import Tooltip from '../tooltip';
import SidebarHeader from './sidebar-header';
import SidebarPanel from './sidebar-panel';
import SidebarFilter from './sidebar-filter';
import SidebarServers from './sidebar-servers';
import SidebarResponses from './sidebar-responses';
import Dropdown from '../dropdown/dropdown';
import DropdownItem from '../dropdown/dropdown-item';
import DropdownDivider from '../dropdown/dropdown-divider';
import SvgIcon, { IconEnum } from '../svg-icon';
import { useToggleState } from '../hooks';

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
  .method {
    h6 {
      font-size: var(--font-size-xxs);
    }
  }
  .method-post {
    color: var(--color-success);
  }
  .method-get {
    color: var(--color-surprise);
  }
  .method-delete {
    color: var(--color-danger);
  }
  .method-parameters {
    display: none;
  }
  .method-options-head,
  .method-custom {
    color: var(--color-info);
  }
  .method-patch {
    color: var(--color-notice);
  }
  .method-put {
    color: var(--color-warning);
  }
  h6 {
    font-size: var(--font-size-xs);
    display: flex;
    flex-grow: 1;
    &:hover {
      cursor: default;
    }
  }
  h5 {
    font-size: var(--font-size-sm);
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

const StyledItem: React.ComponentType<{}> = styled.li`
  padding: 0 0 0 0;
  margin: 0;
  display: grid;
  grid-template-columns: 0.2fr 0.25fr 5fr;
  column-gap: var(--padding-sm);
  grid-template-rows: 1fr;
  align-items: start;
  white-space: nowrap;
  font-size: var(--font-size-md);
  line-height: var(--font-size-sm);
  span {
    text-overflow: ellipsis;
    white-space: nowrap;
    overflow: hidden;
    padding: 4px var(--padding-sm) var(--padding-xs) 0px;
  }
  a {
    color: var(--hl-xl);
  }
  div:nth-child(1) {
    text-align: right;
  }
  &:hover {
    background-color: var(--hl-xxs);
    cursor: default;
  }
  &:last-child {
    margin-bottom: var(--padding-md);
  }
`;

const StyledBlockItem: React.ComponentType<{}> = styled.div`
  padding: 0 var(--padding-md) var(--padding-sm) var(--padding-md);
  margin: 0;
  display: block;
  font-size: var(--font-size-md);
  line-height: var(--font-size-sm);
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
  &:hover {
    background-color: var(--hl-xxs);
    cursor: default;
  }
  &:last-child {
    margin-bottom: var(--padding-md);
  }
  span {
    margin: 0 var(--padding-sm) 0 var(--padding-sm);
  }
  div {
    display: inline;
    margin: 0 var(--padding-sm) 0 var(--padding-sm);

    &:first-of-type {
      margin-left: var(--padding-lg);
    }
  }
`;

const DropdownEllipsis = () => <SvgIcon icon={IconEnum.ellipsesCircle} />;
const panelMotion = { duration: 0.2, ease: 'easeInOut', delay: 0 };
// Section Expansion & Filtering
const useToggle = (state, set) => React.useCallback(() => set(!state), [set, state]);

function Sidebar(props: Props) {
  // Info
  const [infoSec, setInfoSec] = useState(false);
  const toggleInfoSec = useToggle(infoSec, setInfoSec);

  // Paths
  const [pathsSec, setPathsSec] = useState(false);
  const togglePathsSec = useToggle(pathsSec, setPathsSec);
  const [pathsFilter, setPathsFilter] = useState(false);
  const togglePathsFilter = useToggle(pathsFilter, setPathsFilter);
  const [pathFilter, setPathFilter] = useState('');

  // Schemas
  const [schemasSec, setSchemasSec] = useState(false);
  const toggleSchemasSec = useToggle(schemasSec, setSchemasSec);
  const [schemasFilter, setSchemasFilter] = useState(false);
  const toggleSchemasFilter = useToggle(schemasFilter, setSchemasFilter);
  const [schemaFilter, setSchemaFilter] = useState('');

  // Requests
  const [requestsSec, setRequestsSec] = useState(false);
  const toggleRequestsSec = useToggle(requestsSec, setRequestsSec);
  const [requestsFilter, setRequestsFilter] = useState(false);
  const toggleRequestsFilter = useToggle(requestsFilter, setRequestsFilter);
  const [requestFilter, setRequestFilter] = useState('');

  // Responses
  const [responsesSec, setResponsesSec] = useState(false);
  const toggleResponsesSec = useToggle(responsesSec, setResponsesSec);
  const [responsesFilter, setResponsesFilter] = useState(false);
  const toggleResponsesFilter = useToggle(responsesFilter, setResponsesFilter);
  const [responseFilter, setResponseFilter] = useState('');

  // Parameters
  const [parametersSec, setParametersSec] = useState(false);
  const toggleParametersSec = useToggle(parametersSec, setParametersSec);
  const [parametersFilter, setParametersFilter] = useState(false);
  const toggleParametersFilter = useToggle(parametersFilter, setParametersFilter);
  const [parameterFilter, setParameterFilter] = useState('');

  // Headers
  const [headersSec, setHeadersSec] = useState(false);
  const toggleHeadersSec = useToggle(headersSec, setHeadersSec);
  const [headersFilter, setHeadersFilter] = useState(false);
  const toggleHeadersFilter = useToggle(headersFilter, setHeadersFilter);
  const [headerFilter, setHeaderFilter] = useState('');

  // Security
  const [securitiesSec, setSecuritiesSec] = useState(false);
  const toggleSecuritiesSec = useToggle(securitiesSec, setSecuritiesSec);
  const [securitiesFilter, setSecuritiesFilter] = useState(false);
  const toggleSecuritiesFilter = useToggle(securitiesFilter, setSecuritiesFilter);
  const [securityFilter, setSecurityFilter] = useState('');

  // Section Visibility
  const [pathsVisible, setPathsVisible] = useState(true);
  const handlePathsVisibleClick = e => {
    e.stopPropagation();
    setPathsVisible(!pathsVisible);
  };

  const [serversVisible, toggleServerVisibility] = useToggleState(true);

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
  const { requestBodies, responses, parameters, headers } = props.jsonData.components;
  const { servers } = props.jsonData;
  const paths = Object.entries(props.jsonData.paths);

  const handleOnChange = (targetFilter: Function) => (e: SyntheticInputEvent<HTMLInputElement>) => {
    targetFilter(e.target.value);
  };

  return (
    <StyledSidebar className="theme--sidebar">
      <StyledSection>
        <SidebarHeader headerTitle="INFO" section={infoSec} toggleSection={toggleInfoSec}>
          <Dropdown renderButton={DropdownEllipsis}>
            <DropdownDivider>VISIBILITY</DropdownDivider>
            <DropdownItem>
              <input
                type="checkbox"
                onClick={toggleServerVisibility}
                defaultChecked={serversVisible}
              />
              <label htmlFor="servers">Servers</label>
            </DropdownItem>
            <DropdownItem>
              <input
                type="checkbox"
                onClick={handlePathsVisibleClick}
                defaultChecked={pathsVisible}
              />
              <label htmlFor="paths">Paths</label>
            </DropdownItem>
            <DropdownItem>
              <input
                type="checkbox"
                onClick={handleRequestsVisibleClick}
                defaultChecked={requestsVisible}
              />
              <label htmlFor="requests">Requests</label>
            </DropdownItem>
            <DropdownItem>
              <input
                type="checkbox"
                onClick={handleResponsesVisibleClick}
                defaultChecked={responsesVisible}
              />
              <label htmlFor="responses">Responses</label>
            </DropdownItem>
            <DropdownItem>
              <input
                type="checkbox"
                onClick={handleParametersVisibleClick}
                defaultChecked={parametersVisible}
              />
              <label htmlFor="parameters">Parameters</label>
            </DropdownItem>
            <DropdownItem>
              <input
                type="checkbox"
                onClick={handleHeadersVisibleClick}
                defaultChecked={headersVisible}
              />
              <label htmlFor="headers">Headers</label>
            </DropdownItem>
            <DropdownItem>
              <input
                type="checkbox"
                onClick={handleSchemasVisibleClick}
                defaultChecked={schemasVisible}
              />
              <label htmlFor="schemas">Schemas</label>
            </DropdownItem>
            <DropdownItem>
              <input
                type="checkbox"
                onClick={handleSecurityVisibleClick}
                defaultChecked={securityVisible}
              />
              <label htmlFor="security">Security</label>
            </DropdownItem>
          </Dropdown>
        </SidebarHeader>
        <SidebarPanel parent={infoSec}>
          {props.jsonData.info.title && (
            <StyledBlockItem>
              <br />
              <strong>Title: </strong> {props.jsonData.info.title}
            </StyledBlockItem>
          )}
          {props.jsonData.info.description && (
            <StyledBlockItem>
              <strong>Description: </strong> {props.jsonData.info.description}
            </StyledBlockItem>
          )}
          {props.jsonData.info.version && (
            <StyledBlockItem>
              <strong>Version: </strong> {props.jsonData.info.version}
            </StyledBlockItem>
          )}
          {props.jsonData.info.license.name && (
            <StyledBlockItem>
              <strong>License: </strong> {props.jsonData.info.license.name}
            </StyledBlockItem>
          )}
        </SidebarPanel>
      </StyledSection>
      {serversVisible && servers && <SidebarServers servers={servers} />}
      {pathsVisible && paths && (
        <StyledSection>
          <SidebarHeader
            headerTitle="PATHS"
            section={pathsSec}
            toggleSection={togglePathsSec}
            toggleFilter={togglePathsFilter}
            transitionStyle={panelMotion}
          />
          <SidebarPanel parent={pathsSec}>
            <SidebarFilter
              filter={pathsFilter}
              transitionStyle={panelMotion}
              onChange={handleOnChange(setPathsFilter)}></SidebarFilter>
            {paths.map(path => (
              <React.Fragment key={path[0]}>
                {path[0].includes(pathFilter) && (
                  <React.Fragment>
                    <StyledItem>
                      <div></div>
                      <div>
                        <SvgIcon icon={IconEnum.indentation} />
                      </div>
                      <span>{path[0]}</span>
                    </StyledItem>
                    <StyledBlockItem>
                      <span></span>&nbsp;&nbsp;
                      {Object.keys((path[1]: any)).map(method => (
                        <span key={method} className={`method-${method}`}>
                          {method}
                        </span>
                      ))}
                    </StyledBlockItem>
                  </React.Fragment>
                )}
              </React.Fragment>
            ))}
          </SidebarPanel>
        </StyledSection>
      )}
      {requestsVisible && requestBodies && (
        <StyledSection>
          <SidebarHeader
            headerTitle="REQUESTS"
            section={requestsSec}
            toggleSection={toggleRequestsSec}
            toggleFilter={toggleRequestsFilter}
            transitionStyle={panelMotion}
          />
          <SidebarPanel parent={requestsSec}>
            <SidebarFilter
              filter={requestsFilter}
              transitionStyle={panelMotion}
              onChange={handleOnChange(setRequestsFilter)}></SidebarFilter>
            {Object.keys(requestBodies).map((requestName, value) => (
              <React.Fragment key={requestName}>
                {requestName.toLowerCase().includes(requestFilter) && (
                  <React.Fragment>
                    <StyledItem>
                      <div></div>
                      <div>
                        <SvgIcon icon={IconEnum.folderOpen} />
                      </div>
                      <span>
                        <Tooltip message={requestBodies[requestName].description} position="right">
                          {requestName}
                        </Tooltip>
                      </span>
                    </StyledItem>
                    {Object.keys(requestBodies[requestName].content).map(requestFormat => (
                      <React.Fragment key={requestFormat}>
                        <StyledItem>
                          <div></div>
                          <div>
                            &nbsp;
                            <SvgIcon icon={IconEnum.indentation} />
                          </div>
                          <span>{requestFormat}</span>
                        </StyledItem>
                        <StyledBlockItem>
                          {Object.keys(
                            requestBodies[requestName].content[requestFormat].examples,
                          ).map(requestExample => (
                            <div className="method-post" key={requestExample}>
                              {requestExample}
                            </div>
                          ))}
                        </StyledBlockItem>
                      </React.Fragment>
                    ))}
                  </React.Fragment>
                )}
              </React.Fragment>
            ))}
          </SidebarPanel>
        </StyledSection>
      )}
      {responsesVisible && responses && (
        <StyledSection>
          <SidebarHeader
            headerTitle="RESPONSES"
            section={responsesSec}
            toggleSection={toggleResponsesSec}
            toggleFilter={toggleResponsesFilter}
            transitionStyle={panelMotion}
          />
          <SidebarPanel parent={responsesSec}>
            <SidebarFilter
              filter={responsesFilter}
              transitionStyle={panelMotion}
              onChange={handleOnChange(setResponsesFilter)}></SidebarFilter>
            <SidebarResponses
              responses={responses}
              filter={responseFilter}
              filter={responseFilter}></SidebarResponses>
            {Object.keys(responses).map(response => (
              <React.Fragment key={response}>
                {response.toLowerCase().includes(responseFilter) && (
                  <StyledItem>
                    <div></div>
                    <div>
                      <SvgIcon icon={IconEnum.indentation} />
                    </div>
                    <span>
                      <Tooltip message={responses[response].description} position="right">
                        {response}
                      </Tooltip>
                    </span>
                  </StyledItem>
                )}
              </React.Fragment>
            ))}
          </SidebarPanel>
        </StyledSection>
      )}
      {parametersVisible && parameters && (
        <StyledSection>
          <SidebarHeader
            headerTitle="PARAMETERS"
            section={parametersSec}
            toggleSection={toggleParametersSec}
            toggleFilter={toggleParametersFilter}
            transitionStyle={panelMotion}
          />
          <SidebarPanel parent={parametersSec}>
            <SidebarFilter
              filter={parametersFilter}
              transitionStyle={panelMotion}
              onChange={handleOnChange(setParametersFilter)}></SidebarFilter>
            {Object.keys(parameters).map(parameter => (
              <React.Fragment key={parameter}>
                {parameter.toLowerCase().includes(parameterFilter) && (
                  <StyledItem>
                    <div></div>
                    <div>
                      <SvgIcon icon={IconEnum.indentation} />
                    </div>
                    <span>
                      <Tooltip message={parameters[parameter].description} position="right">
                        {parameter}
                      </Tooltip>
                    </span>
                  </StyledItem>
                )}
              </React.Fragment>
            ))}
          </SidebarPanel>
        </StyledSection>
      )}
      {headersVisible && headers && (
        <StyledSection>
          <SidebarHeader
            headerTitle="HEADERS"
            section={headersSec}
            toggleSection={toggleHeadersSec}
            toggleFilter={toggleHeadersFilter}
            transitionStyle={panelMotion}
          />
          <SidebarPanel parent={headersSec}>
            <SidebarFilter
              filter={headersFilter}
              transitionStyle={panelMotion}
              onChange={handleOnChange(setHeadersFilter)}></SidebarFilter>
            {Object.keys(headers).map(header => (
              <React.Fragment key={header}>
                {header.toLowerCase().includes(headerFilter) && (
                  <StyledItem>
                    <div></div>
                    <div>
                      <SvgIcon icon={IconEnum.indentation} />
                    </div>
                    <span>
                      <Tooltip message={headers[header].description} position="right">
                        {header}
                      </Tooltip>
                    </span>
                  </StyledItem>
                )}
              </React.Fragment>
            ))}
          </SidebarPanel>
        </StyledSection>
      )}
      {schemasVisible && props.jsonData.components.schemas && (
        <StyledSection>
          <SidebarHeader
            headerTitle="SCHEMAS"
            section={schemasSec}
            toggleSection={toggleSchemasSec}
            toggleFilter={toggleSchemasFilter}
            transitionStyle={panelMotion}
          />
          <SidebarPanel parent={schemasSec}>
            <SidebarFilter
              filter={schemasFilter}
              transitionStyle={panelMotion}
              onChange={handleOnChange(setSchemasFilter)}></SidebarFilter>
            {Object.keys(props.jsonData.components.schemas).map(schema => (
              <React.Fragment key={schema}>
                {schema.toLowerCase().includes(schemaFilter) && (
                  <StyledItem>
                    <div></div>
                    <div>
                      <SvgIcon icon={IconEnum.brackets} />
                    </div>
                    <span>{schema}</span>
                  </StyledItem>
                )}
              </React.Fragment>
            ))}
          </SidebarPanel>
        </StyledSection>
      )}
      {securityVisible && props.jsonData.components.securitySchemes && (
        <StyledSection>
          <SidebarHeader
            headerTitle="SECURITY"
            section={securitiesSec}
            toggleSection={toggleSecuritiesSec}
            toggleFilter={toggleSecuritiesFilter}
            transitionStyle={panelMotion}
          />
          <SidebarPanel parent={securitiesSec}>
            <SidebarFilter
              filter={securitiesFilter}
              transitionStyle={panelMotion}
              onChange={handleOnChange(setSecuritiesFilter)}></SidebarFilter>
            {Object.keys(props.jsonData.components.securitySchemes).map(scheme => (
              <React.Fragment key={scheme}>
                {scheme.toLowerCase().includes(securityFilter) && (
                  <StyledItem>
                    <div></div>
                    <div>
                      <SvgIcon icon={IconEnum.key} />
                    </div>
                    <span>{scheme}</span>
                  </StyledItem>
                )}
              </React.Fragment>
            ))}
          </SidebarPanel>
        </StyledSection>
      )}
    </StyledSidebar>
  );
}

export default Sidebar;
