import classNames from 'classnames';
import React, { type FC, useEffect, useState } from 'react';

import { database as db } from '../../common/database';
import * as models from '../../models';
import { PATH_PARAMETER_REGEX, type Request, type RequestAuthentication, type RequestParameter } from '../../models/request';
import { isRequestGroup, type RequestGroup } from '../../models/request-group';
import type { WebSocketRequest } from '../../models/websocket-request';
import { getAuthObjectOrNull, isAuthEnabled } from '../../network/authentication';
import { getOrInheritAuthentication } from '../../network/network';
import { buildQueryStringFromParams, joinUrlAndQueryString, smartEncodeUrl } from '../../utils/url/querystring';
import { useNunjucks } from '../context/nunjucks/use-nunjucks';
import { CopyButton } from './base/copy-button';

interface Props {
  request: Request | WebSocketRequest;
}

const defaultPreview = '...';

const addApiKeyToParams = (requestAuth: RequestAuthentication) => {
  const shouldAddAuthParamsToQuery = requestAuth.type === 'apikey' && requestAuth.addTo === 'queryParams';
  return shouldAddAuthParamsToQuery && requestAuth.key && requestAuth.value ?
    [{ name: requestAuth.key, value: requestAuth.value }] : [];
};

async function getQueryParamsFromAuth(request: Request | WebSocketRequest): Promise<RequestParameter[]> {
  const requestAuth = getAuthObjectOrNull(request.authentication);
  const hasAuthSetOnRequest = requestAuth !== null && isAuthEnabled(request.authentication);
  if (hasAuthSetOnRequest) {
    return addApiKeyToParams(requestAuth);
  }

  const ancestors = await db.withAncestors<Request | WebSocketRequest | RequestGroup>(request, [
    models.requestGroup.type,
  ]);
  const requestGroups = ancestors.filter(isRequestGroup);
  const auth = getOrInheritAuthentication({ request, requestGroups });
  const closestAuth = getAuthObjectOrNull(auth);
  if (!closestAuth) {
    return [];
  }
  return addApiKeyToParams(closestAuth);
}

export const RenderedQueryString: FC<Props> = ({ request }) => {
  const [previewString, setPreviewString] = useState(defaultPreview);
  const { handleRender } = useNunjucks();

  useEffect(() => {
    const fn = async () => {
      const enabledParameters = request.parameters.filter(({ disabled }) => !disabled);
      const authQueryParams = await getQueryParamsFromAuth(request);

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
        const qs = buildQueryStringFromParams(mergedParams, false, { encodeParams: request.settingEncodeUrl });
        const fullUrl = joinUrlAndQueryString(url, qs);
        const encoded = smartEncodeUrl(fullUrl, request.settingEncodeUrl, { strictNullHandling: true });
        setPreviewString(encoded === '' ? defaultPreview : encoded);
      } catch (error: unknown) {
        console.warn(error);
        setPreviewString(defaultPreview);
      }
    };
    fn();

  }, [request.parameters, request.url, request.pathParameters, request.settingEncodeUrl, handleRender, request.authentication, request]);

  const className = previewString === defaultPreview ? 'super-duper-faint' : 'selectable force-wrap';

  return (
    <div className="flex justify-between overflow-auto relative h-full gap-[var(--padding-sm)] w-full">
      <span className={classNames('my-auto', className)}>{previewString}</span>

      <CopyButton
        size="small"
        content={previewString}
        disabled={previewString === defaultPreview}
        title="Copy URL"
        confirmMessage=""
        className='self-start sticky top-0'
      >
        <i className="fa fa-copy" />
      </CopyButton>
    </div>
  );
};
