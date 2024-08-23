import React, { type FC } from 'react';
import { Button } from 'react-aria-components';

import { getPreviewModeName, PREVIEW_MODES, type PreviewMode } from '../../../common/constants';
import { Dropdown, DropdownItem, DropdownSection, ItemContent } from '../base/dropdown';

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
      aria-label="Websocket Preview Mode Dropdown"
      triggerButton={
        <Button className="tall">
          {getPreviewModeName(previewMode)}
          <i className="fa fa-caret-down space-left" />
        </Button>
      }
    >
      <DropdownSection
        aria-label="Preview Mode Section"
        title="Preview Mode"
      >
        {PREVIEW_MODES.map(mode =>
          <DropdownItem
            aria-label={getPreviewModeName(mode, true)}
            key={mode}
          >
            <ItemContent
              icon={previewMode === mode ? 'check' : 'empty'}
              label={getPreviewModeName(mode, true)}
              onClick={() => setPreviewMode(mode)}
            />
          </DropdownItem>
        )}
      </DropdownSection>
      <DropdownSection
        aria-label="Actions Section"
        title="Actions"
      >
        <DropdownItem aria-label='Copy raw response'>
          <ItemContent
            icon="copy"
            label="Copy raw response"
            onClick={copyToClipboard}
          />
        </DropdownItem>
        <DropdownItem aria-label='Export raw response'>
          <ItemContent
            icon="save"
            label="Export raw response"
            onClick={download}
          />
        </DropdownItem>
      </DropdownSection>
    </Dropdown>
  );
};
