import { buildQueryStringFromParams, joinUrlAndQueryString, smartEncodeUrl } from 'insomnia-url';
import React, { FC, useState } from 'react';
import { useAsync } from 'react-use';
import styled from 'styled-components';

import { HandleRender } from '../../common/render';
import { Request } from '../../models/request';
import { CopyButton as _CopyButton } from './base/copy-button';

const Wrapper = styled.div({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  overflow: 'auto',
  position: 'relative',
  width: '100%',
});

const CopyButton = styled(_CopyButton)({
  alignSelf: 'start',
});

interface Props {
  request: Request;
  handleRender: HandleRender;
}

const defaultPreview = '...';

export const RenderedQueryString: FC<Props> = ({ request, handleRender }) => {
  const [previewString, setPreviewString] = useState(defaultPreview);

  useAsync(async () => {
    const enabledParameters = request.parameters.filter(parameter => !parameter.disabled);

    try {
      const result = await handleRender({
        url: request.url,
        parameters: enabledParameters,
      });
      if (!result) {
        return;
      }

      const { url, parameters } = result;
      const qs = buildQueryStringFromParams(parameters);
      const fullUrl = joinUrlAndQueryString(url, qs);
      const encoded = smartEncodeUrl(fullUrl, request.settingEncodeUrl);
      setPreviewString(encoded === '' ? defaultPreview : encoded);
    } catch (error: unknown) {
      console.error(error);
      setPreviewString(defaultPreview);
    }
  }, [request, handleRender]);

  const className = previewString === defaultPreview ? 'super-duper-faint' : 'selectable force-wrap';

  return (
    <Wrapper>
      <span className={className}>{previewString}</span>

      <CopyButton
        size="small"
        content={previewString}
        disabled={previewString === defaultPreview}
        title="Copy URL"
        confirmMessage=""
      >
        <i className="fa fa-copy" />
      </CopyButton>
    </Wrapper>
  );
};
