const usernames = {
  utf8: 'user',
  latin1: 'user-é',
};

const passwords = {
  utf8: 'pass',
  latin1: 'pass-é',
};

export const basicAuthCreds = {
  utf8: {
    raw: {
      user: usernames.utf8,
      pass: passwords.utf8,
    },
    encoded: {
      user: usernames.utf8,
      pass: passwords.utf8,
      combined: Buffer.from(`${usernames.utf8}:${passwords.utf8}`).toString('base64'),
    },
  },
  latin1: {
    raw: {
      user: usernames.latin1,
      pass: passwords.latin1,
    },
    encoded: {
      user: Buffer.from(usernames.latin1, 'latin1').toString(),
      pass: Buffer.from(passwords.latin1, 'latin1').toString(),
      combined: Buffer.from(`${usernames.latin1}:${passwords.latin1}`, 'latin1').toString('base64'),
    },
  },
};
