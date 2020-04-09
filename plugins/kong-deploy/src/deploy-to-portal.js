// @flow
import React, { useState } from 'react';
import { Button } from 'insomnia-components';

type Props = {
  specs: Array<{
    content: Object,
    format: string,
    formatVersion: string,
  }>
};

function DeployToPortal(props: Props) {
  const [rbacToken, setRbacToken] = useState();
  const [workspace, setWorkspace] = useState();
  const [apiUrl, setApiUrl] = useState();

  return (
    <div className="pad">
      <p className="no-pad no-margin-top">Let's connect to the Kong API:</p>
      <div className="form-control form-control--outlined pad-top-sm">
        <label>
          Kong API URL
          <input
            type="url"
            placeholder="Eg. https://kong-api.domain.com"
            defaultValue={apiUrl}
            onChange={e => setApiUrl(e.currentTarget.value)}
          />
        </label>
      </div>
      <div className="form-control form-control--outlined pad-top-sm">
        <label>
          Kong Workspace Name
          <input
            type="text"
            placeholder="Eg. my-workspace-name"
            defaultValue={workspace}
            onChange={e => setWorkspace(e.currentTarget.value)}
          />
        </label>
      </div>
      <div className="form-control form-control--outlined pad-top-sm">
        <label>
          Kong RBAC Token
          <input
            type="password"
            placeholder="Optional"
            defaultValue={rbacToken}
            onChange={e => setRbacToken(e.currentTarget.value)}
          />
        </label>
      </div>

      <div className="row pad-top">
        <Button bg="surprise">Connect to Kong</Button>
        &nbsp;
        <Button data-close-modal="true">Cancel</Button>
      </div>
    </div>
  );
}

export default DeployToPortal;
