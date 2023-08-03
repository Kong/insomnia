import React, { FC, ReactNode, useCallback } from 'react';
import { useRouteLoaderData } from 'react-router-dom';

import { toKebabCase } from '../../../../../common/misc';
import { useNunjucks } from '../../../../context/nunjucks/use-nunjucks';
import { useRequestPatcher } from '../../../../hooks/use-request';
import { RequestLoaderData } from '../../../../routes/request';
import { showModal } from '../../../modals';
import { CodePromptModal } from '../../../modals/code-prompt-modal';
import { AuthRow } from './auth-row';

const PRIVATE_KEY_PLACEHOLDER = `
-----BEGIN RSA PRIVATE KEY-----
MIIEpQIBAAKCAQEA39k9udklHnmkU0GtTLpnYtKk1l5txYmUD/cGI0bFd3HHOOLG
mI0av55vMFEhxL7yrFrcL8pRKp0+pnOVStMDmbwsPE/pu9pf3uxD+m9/Flv89bUk
mml+R3E8PwAYzkX0cr4yQTPN9PSSqy+d2+KrZ9QZmpc3tqltTbMVV93cxKCxfBrf
jbiMIAVh7silDVY5+V46SJu8zY2kXOBBtlrE7/JoMiTURCkRjNIA8/sgSmRxBTdM
313lKJM7NgxaGnREbP75U7ErfBvReJsf5p6h5+XXFirG7F2ntcqjUoR3M+opngp0
CgffdGcsK7MmUUgAG7r05b0mljhI35t/0Y57MwIDAQABAoIBAQCH1rLohudJmROp
Gl/qAewfQiiZlfATQavCDGuDGL1YAIme8a8GgApNYf2jWnidhiqJgRHBRor+yzFr
cJV+wRTs/Szp6LXAgMmTkKMJ+9XXErUIUgwbl27Y3Rv/9ox1p5VRg+A=
-----END RSA PRIVATE KEY-----
`.trim();

interface Props {
  label: string;
  property: string;
  help?: ReactNode;
}

export const AuthPrivateKeyRow: FC<Props> = ({ label, property, help }) => {
  const { activeRequest: { authentication, _id: requestId } } = useRouteLoaderData('request/:requestId') as RequestLoaderData;
  const patchRequest = useRequestPatcher();
  const { handleGetRenderContext, handleRender } = useNunjucks();

  const privateKey = authentication[property];
  const onChange = useCallback((value: string) => patchRequest(requestId, { authentication: { ...authentication, [property]: value } }), [authentication, patchRequest, property, requestId]);

  const editPrivateKey = () => {
    showModal(CodePromptModal, {
      submitName: 'Done',
      title: 'Edit Private Key',
      defaultValue: privateKey,
      onChange,
      enableRender: Boolean(handleRender || handleGetRenderContext),
      placeholder: PRIVATE_KEY_PLACEHOLDER,
      mode: 'text/plain',
      hideMode: true,
    });
  };

  const id = toKebabCase(label);

  return (
    <AuthRow labelFor={id} label={label} help={help}>
      <button id={id} className="btn btn--clicky wide" onClick={editPrivateKey}>
        <i className="fa fa-edit space-right" />
        {privateKey ? 'Click to Edit' : 'Click to Add'}
      </button>
    </AuthRow>
  );
};
