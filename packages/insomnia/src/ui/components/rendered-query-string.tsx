import classNames from 'classnames';
import { type FC, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-aria-components';

import type {
  Request,
  RequestAuthentication,
  RequestGroup,
  RequestParameter,
  SocketIORequest,
  WebSocketRequest,
} from '~/insomnia-data';
import { models } from '~/insomnia-data';
import { SegmentEvent } from '~/ui/analytics';
import { showSettingsModal } from '~/ui/components/modals/settings-modal';

import { database as db } from '../../common/database';
import { SECURITY_SETTINGS_PATH_LABEL } from '../../common/misc';
import { getAuthObjectOrNull, isAuthEnabled } from '../../network/authentication';
import { getOrInheritAuthentication } from '../../network/network';
import { RenderError } from '../../templating/render-error';
import { buildQueryStringFromParams, joinUrlAndQueryString, smartEncodeUrl } from '../../utils/url/querystring';
import { useNunjucks } from '../context/nunjucks/use-nunjucks';
import { CopyButton } from './base/copy-button';

const { isRequestGroup } = models.requestGroup;

interface Props {
  request: Request | WebSocketRequest | SocketIORequest;
}

const defaultPreview = '...';

const addApiKeyToParams = (requestAuth: RequestAuthentication) => {
  const shouldAddAuthParamsToQuery = requestAuth.type === 'apikey' && requestAuth.addTo === 'queryParams';
  return shouldAddAuthParamsToQuery && requestAuth.key && requestAuth.value
    ? [{ name: requestAuth.key, value: requestAuth.value }]
    : [];
};

async function getQueryParamsFromAuth(
  request: Request | WebSocketRequest | SocketIORequest,
): Promise<RequestParameter[]> {
  const requestAuth = getAuthObjectOrNull(request.authentication);
  const hasAuthSetOnRequest = requestAuth !== null && isAuthEnabled(request.authentication);
  if (hasAuthSetOnRequest) {
    return addApiKeyToParams(requestAuth);
  }

  const ancestors = await db.withAncestors<Request | WebSocketRequest | SocketIORequest | RequestGroup>(request, [
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

const MAX_URL_LENGTH = 10 * 1024;

export const RenderedQueryString: FC<Props> = ({ request }) => {
  const [previewString, setPreviewString] = useState(defaultPreview);
  const [tooLong, setTooLong] = useState(false);
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
          setTooLong(false);
          return;
        }

        const { parameters, pathParameters, authQueryParams: renderedAuthQueryParams } = result;
        let { url } = result;

        if (pathParameters) {
          // Replace path parameters in URL with their rendered values
          // Path parameters are path segments that start with a colon, e.g. :id
          url = url.replace(models.request.PATH_PARAMETER_REGEX, match => {
            const pathParam = match.replace('/:', '');
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
        let fullUrl = joinUrlAndQueryString(url, qs);
        if (fullUrl.length > MAX_URL_LENGTH) {
          setTooLong(true);
          fullUrl = fullUrl.slice(0, MAX_URL_LENGTH);
        } else {
          setTooLong(false);
        }
        const encoded = smartEncodeUrl(fullUrl, request.settingEncodeUrl, { strictNullHandling: true });
        setPreviewString(encoded === '' ? defaultPreview : encoded);
      } catch (error: unknown) {
        console.warn(error);
        setTooLong(false);
        if (typeof error === 'object' && error instanceof RenderError) {
          setPreviewString(error.message);
        } else {
          setPreviewString(defaultPreview);
        }
      }
    };
    fn();
  }, [
    request.parameters,
    request.url,
    request.pathParameters,
    request.settingEncodeUrl,
    handleRender,
    request.authentication,
    request,
  ]);

  const showTooLongWarning = useCallback(async () => {
    if (tooLong) {
      window.showAlert({
        title: 'URL Too Long',
        message: `Your URL is quite long, so only the first ${MAX_URL_LENGTH} characters were copied.`,
      });
    } else {
      window.main.trackSegmentEvent({
        event: SegmentEvent.requestUrlCopied,
      });
    }
  }, [tooLong]);

  const className = previewString === defaultPreview ? 'super-duper-faint' : 'selectable force-wrap';

  // detects a string to replace with a link to settings
  const linkText = SECURITY_SETTINGS_PATH_LABEL;
  const hasLink = previewString.endsWith(linkText);
  const modifiedString = hasLink ? previewString.slice(0, previewString.length - linkText.length) : previewString;

  return (
    <div className="relative flex h-full w-full justify-between gap-(--padding-sm) overflow-auto">
      <span className={classNames('my-auto', className)}>
        {modifiedString}
        {hasLink && (
          <Link
            className="cursor-pointer text-(--color-surprise)"
            onPress={() => showSettingsModal({ tab: 'general' })}
          >
            {linkText}
          </Link>
        )}
      </span>

      <CopyButton
        size="small"
        content={previewString}
        disabled={previewString === defaultPreview}
        title="Copy URL"
        confirmMessage=""
        onClick={showTooLongWarning}
        className="sticky top-0 self-start"
      >
        <i className="fa fa-copy" />
      </CopyButton>
    </div>
  );
};
