import React, { FC } from 'react';

import { CONTENT_TYPE_JSON, CONTENT_TYPE_PLAINTEXT } from '../../../common/constants';
import { Dropdown, DropdownButton, DropdownItem, ItemContent } from '../base/dropdown/dropdown';

interface Props {
  previewMode: string;
  onClick: (previewMode: string) => void;
}
export const WebSocketPreviewModeDropdown: FC<Props> = ({ previewMode, onClick }) => {
  return (
    <Dropdown
      triggerButton={
        <DropdownButton className="tall">
          {{
            [CONTENT_TYPE_JSON]: 'JSON',
            [CONTENT_TYPE_PLAINTEXT]: 'Raw',
          }[previewMode]}
          <i className="fa fa-caret-down space-left" />
        </DropdownButton>
      }
    >
      <DropdownItem>
        <ItemContent label="JSON" onClick={() => onClick(CONTENT_TYPE_JSON)} />
      </DropdownItem>
      <DropdownItem>
        <ItemContent label="Raw" onClick={() => onClick(CONTENT_TYPE_PLAINTEXT)} />
      </DropdownItem>
    </Dropdown>
  );
};
