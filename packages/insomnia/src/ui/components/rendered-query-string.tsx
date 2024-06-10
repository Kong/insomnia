import classNames from 'classnames';
import React, { FC, useState } from 'react';
import { useAsync } from 'react-use';
import styled from 'styled-components';

import { PATH_PARAMETER_REGEX, Request, RequestAuthentication, RequestParameter } from '../../models/request';
import { WebSocketRequest } from '../../models/websocket-request';
import { buildQueryStringFromParams, joinUrlAndQueryString, smartEncodeUrl } from '../../utils/url/querystring';
import { useNunjucks } from '../context/nunjucks/use-nunjucks';
import { CopyButton as _CopyButton } from './base/copy-button';

const Wrapper = styled.div({
  display: 'flex',
  justifyContent: 'space-between',
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

function getQueryParamsFromAuth(auth: RequestAuthentication | {}): RequestParameter[] {
  if (!('type' in auth)) {
    return [];
  }

  const shouldAddAuthParamsToQuery = auth.type === 'apikey' && auth.addTo === 'queryParams';
  return shouldAddAuthParamsToQuery && auth.key && auth.value ?
    [{ name: auth.key, value: auth.value }] :
    [];
}

export const RenderedQueryString: FC<Props> = ({ request }) => {
  const [previewString, setPreviewString] = useState(defaultPreview);
  const { handleRender } = useNunjucks();

  useAsync(async () => {
    const enabledParameters = request.parameters.filter(({ disabled }) => !disabled);
    const authQueryParams = getQueryParamsFromAuth(request.authentication);

    try {
      const result = await handleRender({
        url: request.url,
        parameters: enabledParameters,
        pathParameters: request.pathParameters,
        authQueryParams,
      });

      if (!result) {
        return;
      }

      const { parameters, pathParameters, authQueryParams: renderedAuthQueryParams } = result;
      let { url } = result;

      if (pathParameters) {
        // Replace path parameters in URL with their rendered values
        // Path parameters are path segments that start with a colon, e.g. :id
        url = url.replace(PATH_PARAMETER_REGEX, match => {
          const pathParam = match.replace('\/:', '');
          const param = pathParameters?.find(p => p.name === pathParam);

          if (param && param.value) {
            return `/${encodeURIComponent(param.value)}`;
          }
          // The parameter should also be URL encoded
          return match;
        });
      }

      const mergedParams = [...parameters, ...renderedAuthQueryParams];
      const qs = buildQueryStringFromParams(mergedParams);
      const fullUrl = joinUrlAndQueryString(url, qs);
      const encoded = smartEncodeUrl(fullUrl, request.settingEncodeUrl);
      setPreviewString(encoded === '' ? defaultPreview : encoded);
    } catch (error: unknown) {
      console.error(error);
      setPreviewString(defaultPreview);
    }
  }, [request.parameters, request.url, request.pathParameters, request.settingEncodeUrl, handleRender, request.authentication]);

  const className = previewString === defaultPreview ? 'super-duper-faint' : 'selectable force-wrap';

  return (
    <Wrapper>
      <span className={classNames('my-auto', className)}>{previewString}</span>

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
