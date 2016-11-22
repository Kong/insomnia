import React, {PropTypes} from 'react';
import {Dropdown, DropdownButton, DropdownItem} from '../base/dropdown';
import {contentTypesMap} from '../../../common/constants';

const ContentTypeDropdown = ({updateRequestMimeType}) => {
  return (
    <Dropdown>
      <DropdownButton className="tall">
        <i className="fa fa-caret-down"></i>
      </DropdownButton>
      {Object.keys(contentTypesMap).map(mimeType => (
        <DropdownItem key={mimeType} onClick={e => updateRequestMimeType(mimeType)}>
          {contentTypesMap[mimeType]}
        </DropdownItem>
      ))}
    </Dropdown>
  )
};

ContentTypeDropdown.propTypes = {
  updateRequestMimeType: PropTypes.func.isRequired
};

export default ContentTypeDropdown;
