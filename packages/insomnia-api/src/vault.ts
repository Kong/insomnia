import { fetch } from './fetch';

// GET /v1/user/vault
export const getVault = ({ sessionId }: { sessionId: string }) => {
  return fetch<{ salt?: string }>({
    method: 'GET',
    path: '/v1/user/vault',
    sessionId,
  });
};

// POST /v1/user/vault
export const createVault = ({ sessionId, salt, verifier }: { sessionId: string; salt: string; verifier: string }) => {
  return fetch({
    method: 'POST',
    path: '/v1/user/vault',
    data: { salt, verifier },
    sessionId,
  });
};

// POST /v1/user/vault/reset
export const resetVault = ({ sessionId, salt, verifier }: { sessionId: string; salt: string; verifier: string }) => {
  return fetch({
    method: 'POST',
    path: '/v1/user/vault/reset',
    data: { salt, verifier },
    sessionId,
  });
};

// POST /v1/user/vault-verify-a
export const verifyVaultA = ({ sessionId, srpA }: { sessionId: string; srpA: string }) => {
  return fetch<{ sessionStarterId: string; srpB: string }>({
    method: 'POST',
    path: '/v1/user/vault-verify-a',
    data: { srpA },
    sessionId,
  });
};

// POST /v1/user/vault-verify-m1
export const verifyVaultM1 = ({
  sessionId,
  srpM1,
  sessionStarterId,
}: {
  sessionId: string;
  srpM1: string;
  sessionStarterId: string;
}) => {
  return fetch<{ srpM2: string }>({
    method: 'POST',
    path: '/v1/user/vault-verify-m1',
    data: { srpM1, sessionStarterId },
    sessionId,
  });
};
