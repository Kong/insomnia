// @flow
import * as React from 'react';
import { motion } from 'framer-motion';
import styled from 'styled-components';
import SidebarHeaderUnitTesting from './sidebar-header-unit-testing';
import SidebarPanel from './sidebar-panel';
import SidebarUnitTestSuiteItem from './sidebar-unit-test-suite-item';

type Props = {|
  unitTestSuites: Array<{
    _id: string,
    type: string,
    parentId: string,
    modified: number,
    created: number,
    name: string,
  }>,
  unitTests: Array<{
    _id: string,
    type: string,
    parentId: string,
    modified: number,
    created: number,
    name: string,
  }>,
  onAddSuiteClick: (e: SyntheticEvent<HTMLSpanElement>) => any,
  onTestSuiteClick: (
    e: SyntheticEvent<HTMLSpanElement>,
    suite: {
      _id: string,
      type: string,
      parentId: string,
      modified: number,
      created: number,
      name: string,
    },
  ) => any,
  onDeleteSuiteClick: (
    e: SyntheticEvent<HTMLSpanElement>,
    suite: {
      _id: string,
      type: string,
      parentId: string,
      modified: number,
      created: number,
      name: string,
    },
  ) => any,
  onExecuteSuiteClick: (
    e: SyntheticEvent<HTMLSpanElement>,
    suite: {
      _id: string,
      type: string,
      parentId: string,
      modified: number,
      created: number,
      name: string,
    },
  ) => any,
  onCreateTestClick: (e: SyntheticEvent<HTMLSpanElement>) => any,
  activeTestSuite: string,
  className?: string,
|};

const StyledSidebar: React.ComponentType<{}> = styled.div`
  width: 100%;
  height: 100%;
  background-color: var(--color-bg);
  border: none;
  color: var(--color-font);
  position: relative;
  padding-bottom: 50px;
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

const StyledSection: React.ComponentType<{}> = styled(motion.ul)`
  overflow: hidden;
  box-sizing: border-box;

  div {
    div {
      padding-left: var(--padding-md);
      padding-right: var(--padding-md);
    }
    input {
      box-sizing: border-box;
      width: 100%;
      font-size: var(--font-size-sm);
      padding: var(--padding-xs);
      margin-top: 0;
      margin-right: var(--padding-md);
      margin-bottom: var(--padding-sm);
      outline-style: none;
      box-shadow: none;
      border: 1px solid var(--hl-md);
      color: var(--color-font);
      background: transparent;

      :focus::placeholder {
        color: transparent;
      }

      ::placeholder {
        color: var(--color-font);
      }
    }
  }
`;

const SidebarUnitTesting = ({
  unitTestSuites,
  unitTests,
  onAddSuiteClick,
  onTestSuiteClick,
  onDeleteSuiteClick,
  onExecuteSuiteClick,
  onCreateTestClick,
  activeTestSuite,
  className,
}: Props) => {
  const [filter, setFilter] = React.useState(null);
  if (unitTestSuites === null) {
    return null;
  }

  const searchTests = event => {
    setFilter(event.target.value);
  };

  const filteredItems = unitTestSuites
    .filter(suite => {
      if (filter == null) return suite;
      else if (suite.name.toLowerCase().includes(filter.toLowerCase())) {
        return suite;
      }
    })
    .map(suite => (
      <SidebarUnitTestSuiteItem
        key={suite._id}
        unitTests={unitTests}
        name={suite.name}
        parentId={suite._id}
        onTestSuiteClick={event => onTestSuiteClick(event, suite)}
        onExecuteSuiteClick={event => onExecuteSuiteClick(event, suite)}
        onDeleteSuiteClick={event => onDeleteSuiteClick(event, suite)}
        onCreateTestClick={onCreateTestClick}
        activeTestSuite={activeTestSuite}
        className={activeTestSuite === suite._id ? 'itemActive' : ''}
      />
    ));

  return (
    <div>
      <StyledSidebar className="theme--sidebar">
        <StyledSection>
          <SidebarHeaderUnitTesting headerTitle="TESTS" onAddSuiteClick={onAddSuiteClick} />
          <div>
            <div>
              <input type="text" placeholder="Filter..." onChange={e => searchTests(e)} />
            </div>
          </div>
        </StyledSection>
        <SidebarPanel childrenVisible={true}>{filteredItems}</SidebarPanel>
      </StyledSidebar>
    </div>
  );
};

export default SidebarUnitTesting;
