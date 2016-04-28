import React, {Component, PropTypes} from 'react'

import Dropdown from '../components/base/Dropdown'
import * as contentTypes from '../lib/contentTypes'

class ContentTypeDropdown extends Component {
  render () {
    const {updateRequestContentType} = this.props;
    
    return (
      <Dropdown>
        <button><i className="fa fa-caret-down"></i></button>
        <ul>
          {contentTypes.CONTENT_TYPES.map(contentType => (
            <li key={contentType}>
              <button onClick={e => updateRequestContentType(contentType)}>
                {contentTypes.getContentTypeName(contentType)}
              </button>
            </li>
          ))}
        </ul>
      </Dropdown>
    )
  }
}

ContentTypeDropdown.propTypes = {
  updateRequestContentType: PropTypes.func.isRequired
};

export default ContentTypeDropdown;
