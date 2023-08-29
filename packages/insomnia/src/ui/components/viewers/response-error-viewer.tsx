import React, { FC, memo } from 'react';

import { docsBase } from '../../../common/documentation';
import { useRootLoaderData } from '../../routes/root';
import { Link } from '../base/link';
import { showModal } from '../modals/index';
import { SettingsModal } from '../modals/settings-modal';
interface Props {
  error: string;
  url: string;
}
export const ResponseErrorViewer: FC<Props> = memo(({ error }) => {
  let msg: React.ReactNode = null;
  const {
    settings,
  } = useRootLoaderData();
  const { editorFontSize } = settings;

  if (error?.toLowerCase().indexOf('certificate') !== -1) {
    msg = (
      <button className="btn btn--clicky" onClick={() => showModal(SettingsModal)}>
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
      <Link button className="btn btn--clicky" href={docsBase}>
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
      <div className="text-center pad">
        <p className="faint pad-left pad-right">Here are some additional things that may help.</p>
        {msg}
          &nbsp;&nbsp;
        <Link
          button
          className="btn btn--clicky margin-top-sm"
          href="https://insomnia.rest/support"
        >
          Contact Support
        </Link>
      </div>
    </div>
  );
});

ResponseErrorViewer.displayName = 'ResponseError';
