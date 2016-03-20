// import {expect, unmock, it, describe} from 'jest';

jest.unmock('../components/Sidebar');

import React from 'react';
import ReactDOM from 'react-dom';
import TestUtils from 'react-addons-test-utils';
import Sidebar from '../components/Sidebar';

describe('Sidebar', () => {
  it('changes the text after click', () => {
    // Render a checkbox with label in the document
    const sidebar = TestUtils.renderIntoDocument(
      <div><Sidebar /></div>
    );

    const sidebarNode = ReactDOM.findDOMNode(sidebar);

    // Verify that it's Off by default
    expect(sidebarNode.textContent).toEqual('Off');
  });
});
