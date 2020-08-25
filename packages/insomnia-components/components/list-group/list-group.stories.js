// @flow
import React from 'react';
import ListGroupItem from './list-group-item';
import ListGroup from './list-group';
import {
  UnitTestResultItem,
  StyledFailedBadge,
  StyledPassedBadge,
  StyledTimestamp,
  SvgIcon,
} from './unit-test-result-item';

export default { title: 'Lists | List Group' };

export const _default = () => (
  <div style={{ width: '350px' }}>
    <ListGroup>
      <ListGroupItem>List</ListGroupItem>
      <ListGroupItem>of</ListGroupItem>
      <ListGroupItem>things...</ListGroupItem>
    </ListGroup>
  </div>
);

export const _unitTestResults = () => (
  <div style={{ width: '350px' }}>
    <ListGroup>
      <UnitTestResultItem>
        <div>
          <StyledFailedBadge>Failed</StyledFailedBadge>
          <p>Unit test title...</p>
          <StyledTimestamp>
            <SvgIcon icon="clock" />
            <span>208 ms</span>
          </StyledTimestamp>
        </div>
        <code>Some dastardly error...</code>
      </UnitTestResultItem>
      <UnitTestResultItem>
        <div>
          <StyledPassedBadge>Passed</StyledPassedBadge>
          <p>Another Unit test title...</p>
          <StyledTimestamp>
            <SvgIcon icon="clock" />
            <span>331 ms</span>
          </StyledTimestamp>
        </div>
      </UnitTestResultItem>
      <UnitTestResultItem>
        <div>
          <StyledFailedBadge>Failed</StyledFailedBadge>
          <p>Unit test title...</p>
          <StyledTimestamp>
            <SvgIcon icon="clock" />
            <span>208 ms</span>
          </StyledTimestamp>
        </div>
        <code>Some dastardly error...</code>
      </UnitTestResultItem>
      <UnitTestResultItem>
        <div>
          <StyledFailedBadge>Failed</StyledFailedBadge>
          <p>Unit test title...</p>
          <StyledTimestamp>
            <SvgIcon icon="clock" />
            <span>208 ms</span>
          </StyledTimestamp>
        </div>
        <code>Some dastardly error...</code>
      </UnitTestResultItem>
    </ListGroup>
  </div>
);
