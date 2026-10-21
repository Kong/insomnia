import classNames from 'classnames';
import type {
  Request,
  RequestAuthentication,
  RequestGroup,
  RequestParameter,
  SocketIORequest,
  WebSocketRequest,
} from 'insomnia-data';
import { models } from 'insomnia-data';
import { type FC, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-aria-components';

import { CONFIDENTIAL_MASK_VALUE } from '~/common/templating/confidential-value-policy';
import { RenderError } from '~/common/templating/render-error';
import { buildQueryStringFromParams, joinUrlAndQueryString, smartEncodeUrl } from '~/common/utils/url/querystring';
import { AnalyticsEvent } from '~/ui/analytics';
import { showSettingsModal } from '~/ui/components/modals/settings-modal';

import { database as db } from '../../common/database';
import { SECURITY_SETTINGS_PATH_LABEL } from '../../common/misc';
import { getAuthObjectOrNull, isAuthEnabled } from '../../network/authentication';
import { getOrInheritAuthentication } from '../../network/network';
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

const PREVIEW_NUNJUCKS_OPTIONS = { renderContext: { purpose: 'preview' as const } };

// The confidential mask (••••••) is non-ASCII, so URL encoding would mangle it: punycode in the
// host (xn--nvgaaaaa) and percent-encoding elsewhere. Swap it for a lowercase ASCII placeholder
// (hostnames get lowercased) before building/encoding the URL, and restore it afterwards.
// The random suffix keeps restoreMask from turning user text that happens to match into bullets.
const MASK_PLACEHOLDER = `confidentialmask${crypto.randomUUID().replaceAll('-', '')}`;
const protectMask = (value: string) => value.replaceAll(CONFIDENTIAL_MASK_VALUE, MASK_PLACEHOLDER);
const restoreMask = (value: string) => value.replaceAll(MASK_PLACEHOLDER, CONFIDENTIAL_MASK_VALUE);
const protectParamsMask = <T extends { name: string; value: string }>(params: T[]) =>
  params.map(param => ({ ...param, name: protectMask(param.name), value: protectMask(param.value) }));

// When the URL starts with the mask, the confidential value may already carry its own scheme
// (e.g. a `{{ _.baseUrl }}` of `https://api.example.com`). smartEncodeUrl would then see no scheme
// and prepend `http://`, showing `http://••••••` for a URL that is really `https://...`. Encode with
// a temporary scheme and drop it again, so the preview shows just the mask.
const TEMPORARY_SCHEME = 'http://';
const encodeMaskedUrl = (url: string, encode: boolean | undefined, options: { strictNullHandling: boolean }) => {
  if (!url.startsWith(MASK_PLACEHOLDER)) {
    return smartEncodeUrl(url, encode, options);
  }
  const encoded = smartEncodeUrl(`${TEMPORARY_SCHEME}${url}`, encode, options);
  return encoded.startsWith(TEMPORARY_SCHEME) ? encoded.slice(TEMPORARY_SCHEME.length) : encoded;
};

export const RenderedQueryString: FC<Props> = ({ request }) => {
  const [previewString, setPreviewString] = useState(defaultPreview);
  const [tooLong, setTooLong] = useState(false);
  const { handleRender } = useNunjucks(PREVIEW_NUNJUCKS_OPTIONS);

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
        const url = models.request.applyPathParametersToUrl(
          protectMask(result.url),
          pathParameters && protectParamsMask(pathParameters),
        );

        const mergedParams = protectParamsMask([...parameters, ...renderedAuthQueryParams]);
        const qs = buildQueryStringFromParams(mergedParams, false, { encodeParams: request.settingEncodeUrl });
        const fullUrl = joinUrlAndQueryString(url, qs);
        // Truncate only after restoreMask, so the cut can't leave a partial placeholder behind.
        const encoded = restoreMask(encodeMaskedUrl(fullUrl, request.settingEncodeUrl, { strictNullHandling: true }));
        if (encoded.length > MAX_URL_LENGTH) {
          setTooLong(true);
          setPreviewString(encoded.slice(0, MAX_URL_LENGTH));
          return;
        }
        setTooLong(false);
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
      window.main.trackAnalyticsEvent({
        event: AnalyticsEvent.requestUrlCopied,
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
