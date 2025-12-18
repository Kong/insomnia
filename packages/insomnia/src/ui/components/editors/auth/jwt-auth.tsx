import React, { type FC } from 'react';

import { getAuthObjectOrNull } from '~/network/authentication';
import {
  type RequestLoaderData,
  useRequestLoaderData,
} from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId';
import {
  type RequestGroupLoaderData,
  useRequestGroupLoaderData,
} from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request-group.$requestGroupId';

import { AuthCodeRow } from './components/auth-code-row';
import { AuthInputRow } from './components/auth-input-row';
import { AuthPrivateKeyRow } from './components/auth-private-key-row';
import { AuthSelectRow } from './components/auth-select-row';
import { AuthTableBody } from './components/auth-table-body';
import { AuthToggleRow } from './components/auth-toggle-row';

const algorithmOptions = [
  { name: 'HS256', value: 'HS256' },
  { name: 'HS384', value: 'HS384' },
  { name: 'HS512', value: 'HS512' },
  { name: 'RS256', value: 'RS256' },
  { name: 'RS384', value: 'RS384' },
  { name: 'RS512', value: 'RS512' },
  { name: 'ES256', value: 'ES256' },
  { name: 'ES384', value: 'ES384' },
  { name: 'ES512', value: 'ES512' },
  { name: 'PS256', value: 'PS256' },
  { name: 'PS384', value: 'PS384' },
  { name: 'PS512', value: 'PS512' },
];

export const JwtAuth: FC<{ disabled?: boolean }> = ({ disabled = false }) => {
  const reqData = useRequestLoaderData() as RequestLoaderData;
  const groupData = useRequestGroupLoaderData() as RequestGroupLoaderData;
  const { authentication } = reqData?.activeRequest || groupData?.activeRequestGroup || {};
  const authOrNull = getAuthObjectOrNull(authentication);
  const jwtAuth = authOrNull?.type === 'jwt' ? authOrNull : null;

  const addTokenTo = jwtAuth?.addTokenTo || 'header';
  const algorithm = jwtAuth?.algorithm || 'HS256';
  const needsSecret = algorithm.startsWith('HS');

  return (
    <AuthTableBody>
      <AuthToggleRow label="Enabled" property="disabled" invert disabled={disabled} />
      <AuthSelectRow
        label="Add token to"
        property="addTokenTo"
        disabled={disabled}
        options={[
          { name: 'Request Header', value: 'header' },
          { name: 'Query Param', value: 'queryParams' },
        ]}
        help="Choose where Insomnia should add the generated JWT."
      />
      {addTokenTo === 'queryParams' ? (
        <AuthInputRow
          label="Query Param Key"
          property="queryParamKey"
          disabled={disabled}
          help="Key used when adding the JWT as a query parameter."
        />
      ) : (
        <AuthInputRow
          label="Request header prefix"
          property="headerPrefix"
          disabled={disabled}
          help='Prefix used in the Authorization header (default: "Bearer"). Use "NO_PREFIX" to send only the raw JWT.'
        />
      )}
      <AuthSelectRow label="Algorithm" property="algorithm" disabled={disabled} options={algorithmOptions} />
      {needsSecret ? (
        <>
          <AuthInputRow label="Secret" property="secret" mask disabled={disabled} />
          <AuthToggleRow
            label="Secret Base64 encoded"
            property="isSecretBase64Encoded"
            disabled={disabled}
            help="Decode the secret from Base64 before signing (HS* algorithms only)."
          />
        </>
      ) : (
        <AuthPrivateKeyRow
          label="Private Key"
          property="privateKey"
          disabled={disabled}
          help="Private key for RS*, PS* and ES* algorithms (PEM). Supports single-line data-uri format."
        />
      )}
      <AuthCodeRow
        label="JWT Headers"
        property="header"
        disabled={disabled}
        placeholder="{}"
        mode="application/json"
        help="Optional custom JWT headers (JSON object). The selected algorithm is always applied as the alg header."
      />
      <AuthCodeRow
        label="Payload"
        property="payload"
        disabled={disabled}
        placeholder="{}"
        mode="application/json"
        help="JWT claims set (JSON object)."
      />
    </AuthTableBody>
  );
};
