import React, {PropTypes} from 'react';

import Dropdown from '../components/base/Dropdown';
import {CONTENT_TYPES, getContentTypeName} from '../lib/contentTypes';
import {trackEvent} from '../lib/analytics';

const ContentTypeDropdown = ({updateRequestContentType}) => {
  return (
    <Dropdown>
      <button className="tall">
        <i className="fa fa-caret-down"></i>
      </button>
      <ul>
        {CONTENT_TYPES.map(contentType => (
          <li key={contentType}>
            <button onClick={e => {
              trackEvent('Changed Content-Type', {contentType});
              updateRequestContentType(contentType)
            }}>{getContentTypeName(contentType)}</button>
          </li>
        ))}
      </ul>
    </Dropdown>
  )
};

ContentTypeDropdown.propTypes = {
  updateRequestContentType: PropTypes.func.isRequired
};

export default ContentTypeDropdown;
