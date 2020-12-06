const utf8 = t => Buffer.from(t, 'utf8').toString();
const iso88591 = t => Buffer.from(t, 'latin1').toString();

export const basicAuthCreds = {
  utf8: { user: utf8('user'), pass: utf8('pass') },
  iso88591: { user: iso88591('user-é'), pass: iso88591('pass-é') },
};
