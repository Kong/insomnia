// @flow
import * as React from 'react';
import { useState } from 'react';
import { motion } from 'framer-motion';
import styled from 'styled-components';
import Tooltip from './tooltip';
import Dropdown from './dropdown/dropdown';
import DropdownItem from './dropdown/dropdown-item';
import DropdownDivider from './dropdown/dropdown-divider';
import SvgIcon, { IconEnum } from './svg-icon';

type Props = {|
  className?: string,
  jsonData: Object,
|};

const StyledSidebar: React.ComponentType<{}> = styled.div`
  /* END To constants */
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

const StyledHeader: React.ComponentType<{}> = styled.li`
  display: flex;
  justify-content: space-between;
  align-items: center;

  &:hover {
    background-color: var(--hl-xs);
  }

  h6:hover {
    text-decoration: underline;
  }

  label {
    color: red !important;
    position: absolute;
    padding-top: var(--padding-xs);
  }

  & > * {
    padding: var(--padding-md) var(--padding-md) var(--padding-md) var(--padding-md);
    font-size: var(--font-size-md);

    svg {
      margin-left: var(--padding-sm);

      &:hover {
        fill: var(--color-font);
        opacity: 1;
      }
    }
  }
`;

const StyledItem: React.ComponentType<{}> = styled.li`
  padding: 0 0 0 0;
  margin: 0px;
  display: grid;
  /* grid-template-columns: repeat(auto-fill, minmax(var(--padding-lg), 1fr)); */
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
  padding: 0px var(--padding-md) var(--padding-sm) var(--padding-md);
  margin: 0px;
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
    margin: 0px var(--padding-sm) 0px var(--padding-sm);
  }

  div {
    display: inline;
    margin: 0px var(--padding-sm) 0px var(--padding-sm);

    &:first-of-type {
      margin-left: var(--padding-lg);
    }
  }
`;

const StyledFilter: React.ComponentType<{}> = styled(motion.div)`
  padding-left: var(--padding-md);
  padding-right: var(--padding-md);
  overflow: hidden;
  input {
    box-sizing: border-box;
    width: 100%;
    font-size: var(--font-size-sm);
    padding: var(--padding-xs);
    margin-top: 0;
    margin-bottom: var(--padding-sm);
    outline-style: none;
    box-shadow: none;
    border: 1px solid var(--hl-md);
    color: var(--color-font);
    background: transparent;

    ::placeholder {
      color: var(--color-font);
    }
  }
`;

const StyledPanel: React.ComponentType<{}> = styled(motion.div)`
  height: 0px;
`;

function Sidebar(props: Props) {
  // Section Expansion & Filtering
  const useToggle = (state, set) => React.useCallback(() => set(!state), [set, state]);

  // Info
  const [infoSec, setInfoSec] = useState(false);
  const toggleInfoSec = useToggle(infoSec, setInfoSec);

  // Servers
  const [serversSec, setServersSec] = useState(false);
  const toggleServersSec = useToggle(serversSec, setServersSec);
  const [serversFilter, setServersFilter] = useState(false);
  const toggleServersFilter = useToggle(serversFilter, setServersFilter);
  const [serverFilter, setServerFilter] = useState('');

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

  const [serversVisible, setServersVisible] = useState(true);
  const handleServersVisibleClick = e => {
    e.stopPropagation();
    setServersVisible(!serversVisible);
  };

  const [requestsVisible, setRequestsVisible] = useState(true);
  const handleRequestsVisibleClick = e => {
    e.stopPropagation();
    setRequestsVisible(!requestsVisible);
  };

  const [responsesVisible, setResponsesVisible] = useState(true);
  const handleResponsesVisibleClick = e => {
    e.stopPropagation();
    setResponsesVisible(!responsesVisible);
  };

  const [parametersVisible, setParametersVisible] = useState(true);
  const handleParametersVisibleClick = e => {
    e.stopPropagation();
    setParametersVisible(!parametersVisible);
  };

  const [headersVisible, setHeadersVisible] = useState(true);
  const handleHeadersVisibleClick = e => {
    e.stopPropagation();
    setHeadersVisible(!headersVisible);
  };

  const [schemasVisible, setSchemasVisible] = useState(true);
  const handleSchemasVisibleClick = e => {
    e.stopPropagation();
    setSchemasVisible(!schemasVisible);
  };

  const [securityVisible, setSecurityVisible] = useState(true);
  const handleSecurityVisibleClick = e => {
    e.stopPropagation();
    setSecurityVisible(!securityVisible);
  };

  // Sections
  if (props.jsonData === null) {
    return null;
  }
  const { requestBodies, responses, parameters, headers } = props.jsonData.components;
  const { servers } = props.jsonData;
  const paths = Object.entries(props.jsonData.paths);

  return (
    <StyledSidebar className="theme--sidebar">
      <StyledSection>
        <StyledHeader>
          <h6 onClick={toggleInfoSec}>INFO</h6>
          <div>
            <Dropdown renderButton={DropdownElipsis}>
              <DropdownDivider>VISIBILITY</DropdownDivider>
              <DropdownItem>
                <input
                  type="checkbox"
                  onClick={handleServersVisibleClick}
                  checked={serversVisible}
                />
                <label for="servers">Servers</label>
              </DropdownItem>
              <DropdownItem>
                <input type="checkbox" onClick={handlePathsVisibleClick} checked={pathsVisible} />
                <label for="paths">Paths</label>
              </DropdownItem>
              <DropdownItem>
                <input
                  type="checkbox"
                  onClick={handleRequestsVisibleClick}
                  checked={requestsVisible}
                />
                <label for="requests">Requests</label>
              </DropdownItem>
              <DropdownItem>
                <input
                  type="checkbox"
                  onClick={handleResponsesVisibleClick}
                  checked={responsesVisible}
                />
                <label for="responses">Responses</label>
              </DropdownItem>
              <DropdownItem>
                <input
                  type="checkbox"
                  onClick={handleParametersVisibleClick}
                  checked={parametersVisible}
                />
                <label for="parameters">Parameters</label>
              </DropdownItem>
              <DropdownItem>
                <input
                  type="checkbox"
                  onClick={handleHeadersVisibleClick}
                  checked={headersVisible}
                />
                <label for="headers">Headers</label>
              </DropdownItem>
              <DropdownItem>
                <input
                  type="checkbox"
                  onClick={handleSchemasVisibleClick}
                  checked={schemasVisible}
                />
                <label for="schemas">Schemas</label>
              </DropdownItem>
              <DropdownItem>
                <input
                  type="checkbox"
                  onClick={handleSecurityVisibleClick}
                  checked={securityVisible}
                />
                <label for="security">Security</label>
              </DropdownItem>
            </Dropdown>
          </div>
        </StyledHeader>
        <StyledPanel
          initial={{ height: infoSec ? '100%' : '0px' }}
          animate={{ height: infoSec ? '100%' : '0px' }}
          transition={{ duration: 0.2, ease: 'easeInOut', delay: 0 }}>
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
        </StyledPanel>
      </StyledSection>
      {serversVisible && servers && (
        <StyledSection>
          <StyledHeader>
            <h6 onClick={toggleServersSec}>SERVERS</h6>
            <div>
              <motion.span
                onClick={toggleServersFilter}
                initial={{ opacity: serversSec ? 0.6 : 0 }}
                animate={{ opacity: serversSec ? 0.6 : 0 }}
                transition={{ duration: 0.2, ease: 'easeInOut', delay: 0.15 }}>
                <SvgIcon icon={IconEnum.search} />
              </motion.span>
            </div>
          </StyledHeader>

          <StyledPanel
            initial={{ height: serversSec ? '100%' : '0px' }}
            animate={{ height: serversSec ? '100%' : '0px' }}
            transition={{ duration: 0.2, ease: 'easeInOut', delay: 0 }}>
            <StyledFilter
              initial={{ height: serversFilter ? '100%' : '0px' }}
              animate={{ height: serversFilter ? '100%' : '0px' }}
              transition={{ duration: 0.2, ease: 'easeInOut', delay: 0 }}>
              <input
                type="text"
                value={serverFilter}
                onChange={e => setServerFilter(e.target.value)}
                placeholder="Filter..."
              />
            </StyledFilter>
            {servers.map(server => (
              <React.Fragment key={server.url}>
                {server.url.includes(serverFilter) && (
                  <StyledItem>
                    <div></div>
                    <div>
                      <SvgIcon icon={IconEnum.indentation} />
                    </div>
                    <span>{server.url}</span>
                  </StyledItem>
                )}
              </React.Fragment>
            ))}
          </StyledPanel>
        </StyledSection>
      )}
      {pathsVisible && paths && (
        <StyledSection>
          <StyledHeader>
            <h6 onClick={togglePathsSec}>PATHS</h6>
            <div>
              <motion.span
                onClick={togglePathsFilter}
                initial={{ opacity: pathsSec ? 0.6 : 0 }}
                animate={{ opacity: pathsSec ? 0.6 : 0 }}
                transition={{ duration: 0.2, ease: 'easeInOut', delay: 0.15 }}>
                <SvgIcon icon={IconEnum.search} />
              </motion.span>
            </div>
          </StyledHeader>
          <StyledPanel
            initial={{ height: pathsSec ? '100%' : '0px' }}
            animate={{ height: pathsSec ? '100%' : '0px' }}
            transition={{ duration: 0.2, ease: 'easeInOut', delay: 0 }}>
            <StyledFilter
              initial={{ height: pathsFilter ? '100%' : '0px' }}
              animate={{ height: pathsFilter ? '100%' : '0px' }}
              transition={{ duration: 0.2, ease: 'easeInOut', delay: 0 }}>
              <input
                type="text"
                value={pathFilter}
                onChange={e => setPathFilter(e.target.value)}
                placeholder="Filter..."
              />
            </StyledFilter>
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
          </StyledPanel>
        </StyledSection>
      )}
      {requestsVisible && requestBodies && (
        <StyledSection>
          <StyledHeader>
            <h6 onClick={toggleRequestsSec}>REQUESTS</h6>
            <div>
              <motion.span
                onClick={toggleRequestsFilter}
                initial={{ opacity: requestsSec ? 0.6 : 0 }}
                animate={{ opacity: requestsSec ? 0.6 : 0 }}
                transition={{ duration: 0.2, ease: 'easeInOut', delay: 0.15 }}>
                <SvgIcon icon={IconEnum.search} />
              </motion.span>
            </div>
          </StyledHeader>
          <StyledPanel
            initial={{ height: requestsSec ? '100%' : '0px' }}
            animate={{ height: requestsSec ? '100%' : '0px' }}
            transition={{ duration: 0.2, ease: 'easeInOut', delay: 0 }}>
            <StyledFilter
              initial={{ height: requestsFilter ? '100%' : '0px' }}
              animate={{ height: requestsFilter ? '100%' : '0px' }}
              transition={{ duration: 0.2, ease: 'easeInOut', delay: 0 }}>
              <input
                type="text"
                value={requestFilter}
                onChange={e => setRequestFilter(e.target.value.toLowerCase())}
                placeholder="Filter..."
              />
            </StyledFilter>
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
          </StyledPanel>
        </StyledSection>
      )}
      {responsesVisible && responses && (
        <StyledSection>
          <StyledHeader>
            <h6 onClick={toggleResponsesSec}>RESPONSES</h6>
            <div>
              <motion.span
                onClick={toggleResponsesFilter}
                initial={{ opacity: responsesSec ? 0.6 : 0 }}
                animate={{ opacity: responsesSec ? 0.6 : 0 }}
                transition={{ duration: 0.2, ease: 'easeInOut', delay: 0.15 }}>
                <SvgIcon icon={IconEnum.search} />
              </motion.span>
            </div>
          </StyledHeader>

          <StyledPanel
            initial={{ height: responsesSec ? '100%' : '0px' }}
            animate={{ height: responsesSec ? '100%' : '0px' }}
            transition={{ duration: 0.2, ease: 'easeInOut', delay: 0 }}>
            <StyledFilter
              initial={{ height: responsesFilter ? '100%' : '0px' }}
              animate={{ height: responsesFilter ? '100%' : '0px' }}
              transition={{ duration: 0.2, ease: 'easeInOut', delay: 0 }}>
              <input
                type="text"
                value={responseFilter}
                onChange={e => setResponseFilter(e.target.value.toLowerCase())}
                placeholder="Filter..."
              />
            </StyledFilter>
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
          </StyledPanel>
        </StyledSection>
      )}
      {parametersVisible && parameters && (
        <StyledSection>
          <StyledHeader>
            <h6 onClick={toggleParametersSec}>PARAMETERS</h6>
            <div>
              <motion.span
                onClick={toggleParametersFilter}
                initial={{ opacity: parametersSec ? 0.6 : 0 }}
                animate={{ opacity: parametersSec ? 0.6 : 0 }}
                transition={{ duration: 0.2, ease: 'easeInOut', delay: 0.15 }}>
                <SvgIcon icon={IconEnum.search} />
              </motion.span>
            </div>
          </StyledHeader>

          <StyledPanel
            initial={{ height: parametersSec ? '100%' : '0px' }}
            animate={{ height: parametersSec ? '100%' : '0px' }}
            transition={{ duration: 0.2, ease: 'easeInOut', delay: 0 }}>
            <StyledFilter
              initial={{ height: parametersFilter ? '100%' : '0px' }}
              animate={{ height: parametersFilter ? '100%' : '0px' }}
              transition={{ duration: 0.2, ease: 'easeInOut', delay: 0 }}>
              <input
                type="text"
                value={parameterFilter}
                onChange={e => setParameterFilter(e.target.value.toLowerCase())}
                placeholder="Filter..."
              />
            </StyledFilter>

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
          </StyledPanel>
        </StyledSection>
      )}
      {headersVisible && headers && (
        <StyledSection>
          <StyledHeader>
            <h6 onClick={toggleHeadersSec}>HEADERS</h6>
            <div>
              <motion.span
                onClick={toggleHeadersFilter}
                initial={{ opacity: headersSec ? 0.6 : 0 }}
                animate={{ opacity: headersSec ? 0.6 : 0 }}
                transition={{ duration: 0.2, ease: 'easeInOut', delay: 0.15 }}>
                <SvgIcon icon={IconEnum.search} />
              </motion.span>
            </div>
          </StyledHeader>

          <StyledPanel
            initial={{ height: headersSec ? '100%' : '0px' }}
            animate={{ height: headersSec ? '100%' : '0px' }}
            transition={{ duration: 0.2, ease: 'easeInOut', delay: 0 }}>
            <StyledFilter
              initial={{ height: headersFilter ? '100%' : '0px' }}
              animate={{ height: headersFilter ? '100%' : '0px' }}
              transition={{ duration: 0.2, ease: 'easeInOut', delay: 0 }}>
              <input
                type="text"
                value={headerFilter}
                onChange={e => setHeaderFilter(e.target.value.toLowerCase())}
                placeholder="Filter..."
              />
            </StyledFilter>

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
          </StyledPanel>
        </StyledSection>
      )}
      {schemasVisible && props.jsonData.components.schemas && (
        <StyledSection>
          <StyledHeader>
            <h6 onClick={toggleSchemasSec}>SCHEMAS</h6>
            <div>
              <motion.span
                onClick={toggleSchemasFilter}
                initial={{ opacity: schemasSec ? 0.6 : 0 }}
                animate={{ opacity: schemasSec ? 0.6 : 0 }}
                transition={{ duration: 0.2, ease: 'easeInOut', delay: 0.15 }}>
                <SvgIcon icon={IconEnum.search} />
              </motion.span>
            </div>
          </StyledHeader>
          <StyledPanel
            initial={{ height: schemasSec ? '100%' : '0px' }}
            animate={{ height: schemasSec ? '100%' : '0px' }}
            transition={{ duration: 0.2, ease: 'easeInOut', delay: 0 }}>
            <StyledFilter
              initial={{ height: schemasFilter ? '100%' : '0px' }}
              animate={{ height: schemasFilter ? '100%' : '0px' }}
              transition={{ duration: 0.2, ease: 'easeInOut', delay: 0 }}>
              <input
                type="text"
                value={schemaFilter}
                onChange={e => setSchemaFilter(e.target.value.toLowerCase())}
                placeholder="Filter..."
              />
            </StyledFilter>
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
          </StyledPanel>
        </StyledSection>
      )}
      {securityVisible && props.jsonData.components.securitySchemes && (
        <StyledSection>
          <StyledHeader>
            <h6 onClick={toggleSecuritiesSec}>SECURITY</h6>
            <div>
              <motion.span
                onClick={toggleSecuritiesFilter}
                initial={{ opacity: securitiesSec ? 0.6 : 0 }}
                animate={{ opacity: securitiesSec ? 0.6 : 0 }}
                transition={{ duration: 0.2, ease: 'easeInOut', delay: 0.15 }}>
                <SvgIcon icon={IconEnum.search} />
              </motion.span>
            </div>
          </StyledHeader>
          <StyledPanel
            initial={{ height: securitiesSec ? '100%' : '0px' }}
            animate={{ height: securitiesSec ? '100%' : '0px' }}
            transition={{ duration: 0.2, ease: 'easeInOut', delay: 0 }}>
            <StyledFilter
              initial={{ height: securitiesFilter ? '100%' : '0px' }}
              animate={{ height: securitiesFilter ? '100%' : '0px' }}
              transition={{ duration: 0.2, ease: 'easeInOut', delay: 0 }}>
              <input
                type="text"
                value={securityFilter}
                onChange={e => setSecurityFilter(e.target.value.toLowerCase())}
                placeholder="Filter..."
              />
            </StyledFilter>
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
          </StyledPanel>
        </StyledSection>
      )}
    </StyledSidebar>
  );
}

export default Sidebar;
