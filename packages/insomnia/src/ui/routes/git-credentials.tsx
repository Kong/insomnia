import type { ActionFunction, LoaderFunction } from 'react-router';

import { gitCredentials } from '../../models';

export const initSignInToGitHub: ActionFunction = async () => {
  await window.main.git.initSignInToGitHub();

  return null;
};

export const completeSignInToGitHub: ActionFunction = async ({ request }) => {
  const { code, state } = (await request.json()) as { code: string; state: string; path: string };
  await window.main.git.completeSignInToGitHub({
    code,
    state,
  });

  return null;
};

export const signOutOfGitHub: ActionFunction = async () => {
  await window.main.git.signOutOfGitHub();

  return null;
};

export const loadGitLabCredentials: LoaderFunction = async () => {
  const credentials = await gitCredentials.getByProvider('gitlab');

  return credentials;
};

export const initSignInToGitLab: ActionFunction = async () => {
  await window.main.git.initSignInToGitLab();

  return null;
};

export const completeSignInToGitLab: ActionFunction = async ({ request }) => {
  const { code, state } = (await request.json()) as { code: string; state: string; path: string };
  await window.main.git.completeSignInToGitLab({
    code,
    state,
  });

  return null;
};

export const signOutOfGitLab: ActionFunction = async () => {
  await window.main.git.signOutOfGitLab();

  return null;
};

export const loadGitCredentials: LoaderFunction = async () => {
  const credentials = await gitCredentials.all();

  return credentials;
};

export const loadGitHubCredentials: LoaderFunction = async () => {
  const credentials = await gitCredentials.getByProvider('github');

  return credentials;
};
