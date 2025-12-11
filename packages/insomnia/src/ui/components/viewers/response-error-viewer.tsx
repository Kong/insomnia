import React, { type FC, memo, useState } from 'react';

import { useRootLoaderData } from '~/root';

import { docsBase } from '../../../common/documentation';
import { Link } from '../base/link';
import { showModal } from '../modals/index';
import { MCPCertificatesModal } from '../modals/mcp-certificates-modal';
import { SettingsModal } from '../modals/settings-modal';

interface Props {
  error: string;
  url: string;
  docsLink?: string;
  isMcpResponse?: boolean;
}
export const ResponseErrorViewer: FC<Props> = memo(({ error, docsLink, isMcpResponse }) => {
  const [isCertificatesModalOpen, setCertificatesModalOpen] = useState(false);
  let msg: React.ReactNode = null;
  const { settings } = useRootLoaderData()!;
  const { editorFontSize } = settings;

  if (error?.toLowerCase().indexOf('certificate') !== -1) {
    msg = (
      <button
        className="btn btn--clicky"
        onClick={() => {
          if (isMcpResponse) {
            // for mcp request, open manage certificates modal
            setCertificatesModalOpen(true);
          } else {
            showModal(SettingsModal);
          }
        }}
      >
        Disable SSL Validation
      </button>
    );
  } else if (error?.toLowerCase().indexOf('getaddrinfo') !== -1) {
    msg = (
      <button className="btn btn--clicky" onClick={() => showModal(SettingsModal)}>
        Setup Network Proxy
      </button>
    );
  } else {
    msg = (
      <Link button className="btn btn--clicky" href={docsLink || docsBase}>
        Documentation
      </Link>
    );
  }

  return (
    <div>
      <pre
        className="selectable pad force-pre-wrap"
        style={{
          fontSize: `${editorFontSize}px`,
        }}
      >
        {error}
      </pre>
      <hr />
      <div className="pad text-center">
        <p className="faint pad-left pad-right">Here are some additional things that may help.</p>
        {msg}
        &nbsp;&nbsp;
        <Link button className="btn btn--clicky margin-top-sm" href="https://insomnia.rest/support">
          Contact Support
        </Link>
      </div>
      {isCertificatesModalOpen && <MCPCertificatesModal onClose={() => setCertificatesModalOpen(false)} />}
    </div>
  );
});

ResponseErrorViewer.displayName = 'ResponseError';
