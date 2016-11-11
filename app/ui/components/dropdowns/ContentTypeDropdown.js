import React, {PropTypes} from 'react';
import {Dropdown, DropdownButton, DropdownItem} from '../base/dropdown';
import {CONTENT_TYPES, getContentTypeName} from '../../../common/constants';

const ContentTypeDropdown = ({updateRequestContentType}) => {
  return (
    <Dropdown>
      <DropdownButton className="tall">
        <i className="fa fa-caret-down"></i>
      </DropdownButton>
      {CONTENT_TYPES.map(contentType => (
        <DropdownItem key={contentType} onClick={e => updateRequestContentType(contentType)}>
          {getContentTypeName(contentType)}
        </DropdownItem>
      ))}
    </Dropdown>
  )
};

ContentTypeDropdown.propTypes = {
  updateRequestContentType: PropTypes.func.isRequired
};

export default ContentTypeDropdown;
