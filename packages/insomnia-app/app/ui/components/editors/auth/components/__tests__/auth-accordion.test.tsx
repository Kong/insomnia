import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { FC } from 'react';

import { globalBeforeEach } from '../../../../../../__jest__/before-each';
import { createMockStoreWithRequest } from '../../../../../../__jest__/create-mock-store-with-active-request';
import { withReduxStore } from '../../../../../../__jest__/with-redux-store';
import * as models from '../../../../../../models';
import { AuthAccordion } from '../auth-accordion';

const Table: FC = ({ children }) => <table><tbody>{children}</tbody></table>;

const childTestId = 'child-component';
const child = <tr data-testid={childTestId} />;

describe('<AuthAccordion />', () => {
  beforeEach(globalBeforeEach);

  it('should render as collapsed because no keys', async () => {
    // Arrange
    const { store } = await createMockStoreWithRequest({ requestMetaPatch: { expandedAccordionKeys: {} } });

    // Render
    const { queryByTestId } = render(
      <AuthAccordion label="label">{child}</AuthAccordion>,
      { wrapper: withReduxStore(store, Table) }
    );

    // Assert
    expect(queryByTestId(childTestId)).not.toBeInTheDocument();
  });

  it('should render as collapsed because expected key not found', async () => {
    // Arrange
    const { store } = await createMockStoreWithRequest({ requestMetaPatch: { expandedAccordionKeys: { 'not-found': false } } });

    // Render
    const { queryByTestId } = render(
      <AuthAccordion label="label">{child}</AuthAccordion>,
      { wrapper: withReduxStore(store, Table) }
    );

    // Assert
    expect(queryByTestId(childTestId)).not.toBeInTheDocument();
  });

  it('should render as collapsed', async () => {
    // Arrange
    const { store } = await createMockStoreWithRequest({ requestMetaPatch: { expandedAccordionKeys: { label: false } } });

    // Render
    const { queryByTestId } = render(
      <AuthAccordion label="label">{child}</AuthAccordion>,
      { wrapper: withReduxStore(store, Table) }
    );

    // Assert
    expect(queryByTestId(childTestId)).not.toBeInTheDocument();
  });

  it('should render as expanded', async () => {
    // Arrange
    const { store } = await createMockStoreWithRequest({ requestMetaPatch: { expandedAccordionKeys: { label: true } } });

    // Render
    const { queryByTestId } = render(
      <AuthAccordion label="label">{child}</AuthAccordion>,
      { wrapper: withReduxStore(store, Table) }
    );

    // Assert
    expect(queryByTestId(childTestId)).toBeInTheDocument();
  });

  it('should expanded on click', async () => {
    // Arrange
    const initialExpandedAccordionKeys = {
      foo: true,
      bar: false,
    };

    const { store, requestId } = await createMockStoreWithRequest({ requestMetaPatch: { expandedAccordionKeys: initialExpandedAccordionKeys } });

    // Render
    const { findByRole, queryByTestId } = render(
      <AuthAccordion label="label">{child}</AuthAccordion>,
      { wrapper: withReduxStore(store, Table) }
    );

    // Assert
    expect(queryByTestId(childTestId)).not.toBeInTheDocument();

    // Act - expand
    await userEvent.click(await findByRole('button'));

    // Wait for db change to propagate
    await new Promise(resolve => setTimeout(resolve, 100));

    // Assert
    expect((await models.requestMeta.getByParentId(requestId))?.expandedAccordionKeys).toEqual({
      ...initialExpandedAccordionKeys,
      label: true,
    });
  });

  it('should collapse on click', async () => {
    // Arrange
    const initialExpandedAccordionKeys = {
      foo: true,
      bar: false,
      label: true,
    };

    const { store, requestId } = await createMockStoreWithRequest({ requestMetaPatch: { expandedAccordionKeys: initialExpandedAccordionKeys } });

    // Render
    const { findByRole, queryByTestId } = render(
      <AuthAccordion label="label">{child}</AuthAccordion>,
      { wrapper: withReduxStore(store, Table) }
    );

    // Assert
    expect(queryByTestId(childTestId)).toBeInTheDocument();

    // Act - collapse
    await userEvent.click(await findByRole('button'));

    // Wait for db change to propagate
    await new Promise(resolve => setTimeout(resolve, 100));

    // Assert
    expect((await models.requestMeta.getByParentId(requestId))?.expandedAccordionKeys).toEqual({
      ...initialExpandedAccordionKeys,
      label: false,
    });
  });
});
