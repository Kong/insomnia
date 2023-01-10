import React, { FC } from 'react';

import { getPreviewModeName, PREVIEW_MODES, PreviewMode } from '../../../common/constants';
import { Button } from '../base/dropdown-aria/button';
import { Dropdown, DropdownItem, DropdownSection, ItemContent } from '../base/dropdown-aria/dropdown';

interface Props {
  download: () => void;
  copyToClipboard: () => void;
  previewMode: PreviewMode;
  setPreviewMode: (mode: PreviewMode) => void;
}

export const WebSocketPreviewModeDropdown: FC<Props> = ({
  download,
  copyToClipboard,
  previewMode,
  setPreviewMode,
}) => {
  return (
    <Dropdown
      triggerButton={
        <Button className="tall">
          {getPreviewModeName(previewMode)}
          <i className="fa fa-caret-down space-left" />
        </Button>
      }
    >
      <DropdownSection title="Preview Mode">
        {PREVIEW_MODES.map(mode =>
          <DropdownItem key={mode}>
            <ItemContent
              icon={previewMode === mode ? 'check' : 'empty'}
              label={getPreviewModeName(mode, true)}
              onClick={() => setPreviewMode(mode)}
            />
          </DropdownItem>
        )}
      </DropdownSection>
      <DropdownSection title="Actions">
        <DropdownItem>
          <ItemContent icon="copy" label="Copy raw response" onClick={copyToClipboard} />
        </DropdownItem>
        <DropdownItem>
          <ItemContent icon="save" label="Export raw response" onClick={download} />
        </DropdownItem>
      </DropdownSection>
    </Dropdown>
  );
};
