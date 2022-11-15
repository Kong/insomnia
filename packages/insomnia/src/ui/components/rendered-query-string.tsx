import React, { FC, useState } from 'react';
import { useAsync } from 'react-use';
import styled from 'styled-components';

import { Request } from '../../models/request';
import { WebSocketRequest } from '../../models/websocket-request';
import { buildQueryStringFromParams, joinUrlAndQueryString, smartEncodeUrl } from '../../utils/url/querystring';
import { useNunjucks } from '../context/nunjucks/use-nunjucks';
import { CopyButton as _CopyButton } from './base/copy-button';

const Wrapper = styled.div({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  overflow: 'auto',
  position: 'relative',
  height: '100%',
  gap: 'var(--padding-sm)',
  width: '100%',
});

const CopyButton = styled(_CopyButton)({
  '&&': {
    alignSelf: 'start',
    position: 'sticky',
    top: 0,
  },
});

interface Props {
  request: Request | WebSocketRequest;
}

const defaultPreview = '...';

export const RenderedQueryString: FC<Props> = ({ request }) => {
  const [previewString, setPreviewString] = useState(defaultPreview);
  const { handleRender } = useNunjucks();

  useAsync(async () => {
    const enabledParameters = request.parameters.filter(({ disabled }) => !disabled);
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
  }, [request.url, request.parameters, request.settingEncodeUrl, handleRender]);

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
