import type { HTTPSnippetClient, HTTPSnippetTarget } from 'httpsnippet';
import { generateStainlessSdkSnippet, getStainlessSdkByEndpoint, type StainlessSdk } from 'insomnia-api';
import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { Button } from 'react-aria-components';

import { SegmentEvent } from '~/ui/analytics';
import { CodeEditor, type CodeEditorHandle } from '~/ui/components/.client/codemirror/code-editor';
import stainlessLogo from '~/ui/images/stainless-logo.png';

import { exportHarWithRequest, type HarRequest } from '../../../common/har';
import { tryParseJson } from '../../../common/misc';
import type { Request } from '../../../models/request';
import { CopyButton } from '../base/copy-button';
import { Dropdown, DropdownItem, ItemContent } from '../base/dropdown';
import { Link } from '../base/link';
import { Modal, type ModalHandle, type ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalFooter } from '../base/modal-footer';
import { ModalHeader } from '../base/modal-header';

// Maps language/target keys to CodeMirror modes where the name differs
const LANGUAGE_MODE_MAP: Record<string, string> = {
  c: 'clike',
  java: 'clike',
  csharp: 'clike',
  node: 'javascript',
  objc: 'clike',
  ocaml: 'mllike',
  typescript: 'javascript',
  kotlin: 'clike',
};

const TO_ADD_CONTENT_LENGTH: Record<string, string[]> = {
  node: ['native'],
};

type Props = ModalProps & {
  environmentId: string;
};
export interface GenerateCodeModalOptions {
  request?: Request;
}
export interface State {
  request?: Request;
  target?: HTTPSnippetTarget;
  client?: HTTPSnippetClient;
  targets: HTTPSnippetTarget[];
  snippet: string;
  mode: 'httpsnippet' | 'stainless-sdk';
  loading: boolean;
  sdk?: StainlessSdk;
  sdkLanguage?: string;
  sdkError?: string;
  sdkBodyWarning?: string;
  sdkBaseUrl?: string;
}
export interface GenerateCodeModalHandle {
  show: (options: GenerateCodeModalOptions) => void;
  hide: () => void;
}

export function harToSdkParams(sdk: StainlessSdk, language: string, har: HarRequest) {
  let body: Record<string, unknown> | undefined;
  let bodyWarning: string | undefined;

  if (har.postData) {
    if (har.postData.params) {
      body = Object.fromEntries(har.postData.params.map(({ name, value }) => [name, value ?? '']));
    } else if (har.postData.text) {
      body = tryParseJson(har.postData.text);
      if (body === undefined) {
        bodyWarning = 'Request body could not be represented as a JSON object and was omitted from the snippet generation request.';
      }
    }
  }

  return {
    id: sdk.id,
    language,
    method: har.method,
    path: new URL(har.url).pathname,
    parameters: [
      ...har.queryString.map(({ name, value }) => ({ in: 'query' as const, name, value })),
      ...har.headers.map(({ name, value }) => ({ in: 'header' as const, name, value })),
      ...har.cookies.map(({ name, value }) => ({ in: 'cookie' as const, name, value })),
    ],
    body,
    bodyWarning,
  };
}

export const GenerateCodeModal = forwardRef<GenerateCodeModalHandle, Props>((props, ref) => {
  const modalRef = useRef<ModalHandle>(null);
  const editorRef = useRef<CodeEditorHandle>(null);

  const [state, setState] = useState<State>(() => {
    let storedTarget: HTTPSnippetTarget | undefined;
    let storedClient: HTTPSnippetClient | undefined;
    try {
      storedTarget = JSON.parse(window.localStorage.getItem('insomnia::generateCode::target') || '') as HTTPSnippetTarget;
    } catch {}
    try {
      storedClient = JSON.parse(window.localStorage.getItem('insomnia::generateCode::client') || '') as HTTPSnippetClient;
    } catch {}
    return {
      request: undefined,
      target: storedTarget,
      client: storedClient,
      targets: [],
      snippet: '',
      mode: 'httpsnippet',
      loading: false,
    };
  });

  const generateCode = useCallback(
    async (request: Request, target?: HTTPSnippetTarget, client?: HTTPSnippetClient) => {
      const HTTPSnippet = (await import('httpsnippet')).default;

      const targets = HTTPSnippet.availableTargets();
      const targetOrFallback = target || (targets.find(t => t.key === 'shell') as HTTPSnippetTarget);
      const clientOrFallback = client || (targetOrFallback.clients.find(t => t.key === 'curl') as HTTPSnippetClient);

      // Save client/target for next time
      window.localStorage.setItem('insomnia::generateCode::client', JSON.stringify(clientOrFallback));
      window.localStorage.setItem('insomnia::generateCode::target', JSON.stringify(targetOrFallback));

      // Some clients need a content-length for the request to succeed
      const addContentLength = Boolean(
        (TO_ADD_CONTENT_LENGTH[targetOrFallback.key] || []).find(c => c === clientOrFallback.key),
      );
      const har = await exportHarWithRequest(request, props.environmentId, addContentLength);

      let cmd = '';
      if (har) {
        const snippet = new HTTPSnippet(har);
        cmd = snippet.convert(targetOrFallback.key, clientOrFallback.key) || '';
      }

      setState(prev => ({
        ...prev,
        request,
        mode: 'httpsnippet',
        loading: false,
        client: clientOrFallback,
        target: targetOrFallback,
        targets,
        snippet: cmd,
      }));

      window.main.trackSegmentEvent({
        event: SegmentEvent.generateCodeLanguageChanged,
        properties: { language: target?.title },
      });
    },
    [props.environmentId],
  );

  const initModal = useCallback(
    async (request: Request) => {
      setState(prev => ({ ...prev, request, loading: true, sdkError: undefined, sdkBodyWarning: undefined, snippet: '' }));

      let har: HarRequest | undefined;
      try {
        har = await exportHarWithRequest(request, props.environmentId) ?? undefined;
      } catch {
        // HAR export failed — fall back to httpsnippet
      }

      if (!har) {
        await generateCode(request);
        return;
      }

      // Check if an SDK is available for this endpoint
      let sdk: StainlessSdk | null = null;
      try {
        sdk = await getStainlessSdkByEndpoint({ endpoint: har.url });
      } catch {
        // SDK lookup failed — fall back to httpsnippet
      }

      if (!sdk) {
        await generateCode(request);
        return;
      }

      const storedSdkLanguage = window.localStorage.getItem('insomnia::generateCode::sdkLanguage');
      const selectedLanguage =
        storedSdkLanguage && sdk.languages.includes(storedSdkLanguage) ? storedSdkLanguage : sdk.languages[0];

      const { hostname } = new URL(har.url);
      setState(prev => ({
        ...prev,
        mode: 'stainless-sdk',
        sdk,
        sdkLanguage: selectedLanguage,
        loading: true,
        sdkBaseUrl: hostname,
      }));

      try {
        const { bodyWarning, ...params } = harToSdkParams(sdk, selectedLanguage, har);
        const result = await generateStainlessSdkSnippet(params);
        setState(prev => ({ ...prev, snippet: result.code, loading: false, sdkBodyWarning: bodyWarning }));
        window.localStorage.setItem('insomnia::generateCode::sdkLanguage', selectedLanguage);
      } catch (err) {
        console.error('[generate-code-modal] Failed to generate SDK snippet', err);
        setState(prev => ({ ...prev, sdkError: 'Failed to generate SDK snippet', loading: false }));
      }
    },
    [props.environmentId, generateCode],
  );

  const onSdkLanguageChange = useCallback(
    async (language: string) => {
      setState(prev => ({ ...prev, sdkLanguage: language, loading: true, sdkError: undefined, sdkBodyWarning: undefined, snippet: '' }));
      try {
        if (!state.sdk) return;

        const har = state.request ? await exportHarWithRequest(state.request, props.environmentId) : null;
        if (!har) return;

        const { bodyWarning, ...params } = harToSdkParams(state.sdk, language, har);
        const result = await generateStainlessSdkSnippet(params);
        setState(prev => ({ ...prev, snippet: result.code, loading: false, sdkBodyWarning: bodyWarning }));
        window.localStorage.setItem('insomnia::generateCode::sdkLanguage', language);
        window.main.trackSegmentEvent({
          event: SegmentEvent.generateCodeLanguageChanged,
          properties: { language },
        });
      } catch (err) {
        console.error('[generate-code-modal] Failed to generate SDK snippet', err);
        setState(prev => ({ ...prev, sdkError: 'Failed to generate SDK snippet', loading: false }));
      }
    },
    [props.environmentId, state.sdk, state.request],
  );

  useImperativeHandle(
    ref,
    () => ({
      hide: () => {
        modalRef.current?.hide();
      },
      show: options => {
        if (!options.request) {
          return;
        }
        initModal(options.request);
        modalRef.current?.show();
      },
    }),
    [initModal],
  );

  const { target, targets, client, request, snippet, mode, loading, sdk, sdkLanguage, sdkError, sdkBodyWarning, sdkBaseUrl } = state;
  // NOTE: Just some extra precautions in case the target is messed up
  const clients: HTTPSnippetClient[] = target && Array.isArray(target.clients) ? target.clients : [];

  const editorMode =
    mode === 'stainless-sdk' && sdkLanguage
      ? LANGUAGE_MODE_MAP[sdkLanguage] || sdkLanguage
      : target
        ? LANGUAGE_MODE_MAP[target.key] || target.key
        : 'text';

  const editorValue = sdkError ? `// Error: ${sdkError}` : snippet;

  const editorKey = mode === 'stainless-sdk'
    ? `sdk-${sdkLanguage || 'unknown'}-${snippet.length}${sdkError ? '-error' : ''}`
    : `http-${target?.key || 'none'}-${client?.key || 'none'}-${snippet.length}`;

  return (
    <Modal ref={modalRef} tall {...props}>
      <ModalHeader>Generate Client Code</ModalHeader>
      <ModalBody
        noScroll
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr)',
          gridTemplateRows: mode === 'stainless-sdk' ? 'auto auto minmax(0, 1fr)' : 'auto minmax(0, 1fr)',
        }}
      >
        {mode === 'stainless-sdk' && (
          <div className="flex flex-col border-b border-solid border-(--hl-md)">
            <div className="flex items-center justify-center gap-4 bg-(--hl-sm) px-(--padding-md) py-(--padding-sm)">
              <img src={stainlessLogo} alt="Stainless" className="h-6 w-auto" />
              <span className="text-sm text-(--color-font)">
                Code snippets for <strong>{sdkBaseUrl}</strong> powered by our partner{' '}
                <Link href="https://www.stainless.com/" className="underline" noTheme>Stainless</Link>.
              </span>
            </div>
            {sdkBodyWarning && (
              <div className="flex items-center gap-2 bg-[rgba(var(--color-warning-rgb),0.1)] px-(--padding-md) py-(--padding-sm) text-sm text-(--color-font-warning)">
                <i className="fa fa-exclamation-triangle" />
                {sdkBodyWarning}
              </div>
            )}
          </div>
        )}
        <div className="pad flex items-center justify-between">
          <div className="flex items-center gap-2">
            {loading && !sdk ? null : mode === 'stainless-sdk' && sdk ? (
              <Dropdown
                aria-label="Select a language"
                isDisabled={loading}
                placement="bottom start"
                triggerButton={
                  <Button className="h-(--line-height-xs) rounded-md border border-solid border-(--hl-lg) px-(--padding-md) hover:bg-(--hl-xs)">
                    <span className="capitalize">{sdkLanguage ?? 'n/a'}</span>
                    <i className="fa fa-caret-down" />
                  </Button>
                }
              >
                {sdk.languages.map(lang => (
                  <DropdownItem key={lang} aria-label={lang}>
                    <ItemContent
                      label={<span className="capitalize">{lang}</span>}
                      onClick={() => onSdkLanguageChange(lang)}
                    />
                  </DropdownItem>
                ))}
              </Dropdown>
            ) : mode === 'httpsnippet' ? (
              <>
                <Dropdown
                  aria-label="Select a target"
                  placement="bottom start"
                  triggerButton={
                    <Button className="h-(--line-height-xs) rounded-md border border-solid border-(--hl-lg) px-(--padding-md) hover:bg-(--hl-xs)">
                      {target ? target.title : 'n/a'}
                      <i className="fa fa-caret-down" />
                    </Button>
                  }
                >
                  {targets.map(target => (
                    <DropdownItem key={target.key} aria-label={target.title}>
                      <ItemContent
                        label={target.title}
                        onClick={() => {
                          const client = target.clients.find(c => c.key === target.default);
                          if (request && client) {
                            generateCode(request, target, client);
                          }
                        }}
                      />
                    </DropdownItem>
                  ))}
                </Dropdown>
                <Dropdown
                  aria-label="Select a client"
                  placement="bottom start"
                  triggerButton={
                    <Button className="h-(--line-height-xs) rounded-md border border-solid border-(--hl-lg) px-(--padding-md) hover:bg-(--hl-xs)">
                      {client ? client.title : 'n/a'}
                      <i className="fa fa-caret-down" />
                    </Button>
                  }
                >
                  {clients.map(client => (
                    <DropdownItem key={client.key} aria-label={client.title}>
                      <ItemContent
                        label={client.title}
                        onClick={() => request && generateCode(request, state.target, client)}
                      />
                    </DropdownItem>
                  ))}
                </Dropdown>
              </>
            ) : null}
          </div>
          <CopyButton content={editorValue} />
        </div>
        {loading && !sdk ? (
          <div className="text-center pad">Loading...</div>
        ) : (mode === 'stainless-sdk' || target) ? (
          <CodeEditor
            id="generate-code-modal-content"
            placeholder={loading ? 'Loading SDK snippet...' : 'Generating code snippet...'}
            className="border-top"
            key={editorKey}
            mode={editorMode}
            ref={editorRef}
            defaultValue={editorValue}
          />
        ) : null}
      </ModalBody>
      <ModalFooter>
        <div className="margin-left txt-sm italic">
          {mode === 'httpsnippet' ? (
            <>
              * Code snippets generated by&nbsp;
              <Link href="https://github.com/Kong/httpsnippet">httpsnippet</Link>
            </>
          ) : null}
        </div>
        <button className="btn" onClick={() => modalRef.current?.hide()}>
          Done
        </button>
      </ModalFooter>
    </Modal>
  );
});
GenerateCodeModal.displayName = 'GenerateCodeModal';
