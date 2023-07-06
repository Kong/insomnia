import * as electron from 'electron';

export function clickLink(href: string) {
  const { protocol } = new URL(href);
  if (protocol === 'http:' || protocol === 'https:') {
    // eslint-disable-next-line no-restricted-properties -- this is, other than tests, what _should be_ the one and only place in this project where this is called.
    electron.shell.openExternal(href);
  }
}
