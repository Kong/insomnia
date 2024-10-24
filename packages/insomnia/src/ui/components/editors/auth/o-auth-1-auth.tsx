import React, { type FC } from 'react';
import { useRouteLoaderData } from 'react-router-dom';

import type { AuthTypeOAuth1 } from '../../../../models/request';
import {
  type OAuth1SignatureMethod,
  SIGNATURE_METHOD_HMAC_SHA1,
  SIGNATURE_METHOD_HMAC_SHA256,
  SIGNATURE_METHOD_PLAINTEXT,
  SIGNATURE_METHOD_RSA_SHA1,
} from '../../../../network/o-auth-1/constants';
import type { RequestLoaderData } from '../../../routes/request';
import type { RequestGroupLoaderData } from '../../../routes/request-group';
import { AuthInputRow } from './components/auth-input-row';
import { AuthPrivateKeyRow } from './components/auth-private-key-row';
import { AuthSelectRow } from './components/auth-select-row';
import { AuthTableBody } from './components/auth-table-body';
import { AuthToggleRow } from './components/auth-toggle-row';

const blankForDefault = 'Leave blank for default';
export const signatureMethodOptions: { name: OAuth1SignatureMethod; value: OAuth1SignatureMethod }[] = [{
  name: 'HMAC-SHA1',
  value: SIGNATURE_METHOD_HMAC_SHA1,
},
{
  name: 'HMAC-SHA256',
  value: SIGNATURE_METHOD_HMAC_SHA256,
},
{
  name: 'RSA-SHA1',
  value: SIGNATURE_METHOD_RSA_SHA1,
},
{
  name: 'PLAINTEXT',
  value: SIGNATURE_METHOD_PLAINTEXT,
}];

export const OAuth1Auth: FC = () => {
  const reqData = useRouteLoaderData('request/:requestId') as RequestLoaderData;
  const groupData = useRouteLoaderData('request-group/:requestGroupId') as RequestGroupLoaderData;
  const authentication = (reqData?.activeRequest || groupData.activeRequestGroup).authentication as AuthTypeOAuth1;

  const { signatureMethod } = authentication;
  return (
    <AuthTableBody>
      <AuthToggleRow label="Enabled" property="disabled" invert />
      <AuthInputRow label='Consumer Key' property='consumerKey' />
      <AuthInputRow label='Consumer Secret' property='consumerSecret' mask />
      <AuthInputRow label='Token Key' property='tokenKey' />
      <AuthInputRow label='Token Secret' property='tokenSecret' mask />
      <AuthSelectRow label='Signature Method' property='signatureMethod' options={signatureMethodOptions} />
      {signatureMethod === SIGNATURE_METHOD_RSA_SHA1 && <AuthPrivateKeyRow label='Private Key' property='privateKey' />}
      <AuthInputRow label='Callback URL' property='callback' />
      <AuthInputRow label='Version' property='version' />
      <AuthInputRow label='Timestamp' property='timestamp' help={blankForDefault} />
      <AuthInputRow label='Realm' property='realm' help={blankForDefault} />
      <AuthInputRow label='Nonce' property='nonce' help={blankForDefault} />
      <AuthInputRow label='Verifier' property='verifier' help={blankForDefault} />
      <AuthToggleRow
        label='Hash Body'
        property='includeBodyHash'
        help='If a application/x-www-form-urlencoded body is present, also generate a oauth_body_hash property'
      />
    </AuthTableBody>
  );
};
