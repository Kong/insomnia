import React, { FC } from 'react';

import { CONTENT_TYPE_JSON, CONTENT_TYPE_PLAINTEXT } from '../../../common/constants';
import { Dropdown } from '../base/dropdown/dropdown';
import { DropdownButton } from '../base/dropdown/dropdown-button';
import { DropdownItem } from '../base/dropdown/dropdown-item';
interface Props {
  previewMode: string;
  onClick: (previewMode: string) => void;
}
export const WebSocketPreviewModeDropdown: FC<Props> = ({ previewMode, onClick }) => {
  return (
    <Dropdown>
      <DropdownButton className="tall">
        {{
          [CONTENT_TYPE_JSON]: 'JSON',
          [CONTENT_TYPE_PLAINTEXT]: 'Raw',
        }[previewMode]}
        <i className="fa fa-caret-down space-left" />
      </DropdownButton>
      <DropdownItem onClick={() => onClick(CONTENT_TYPE_JSON)} >
        JSON
      </DropdownItem>
      <DropdownItem onClick={() => onClick(CONTENT_TYPE_PLAINTEXT)} >
        Raw
      </DropdownItem>
    </Dropdown>
  );
};
