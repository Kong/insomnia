import { type ActionFunction } from 'react-router';

export const defaultBrowserOAuthRedirect: ActionFunction = async ({ request }) => {
  const { redirectUrl } = (await request.json()) as { redirectUrl: string };
  await window.main.onDefaultBrowserOAuthRedirect({
    url: redirectUrl,
  });

  return null;
};
