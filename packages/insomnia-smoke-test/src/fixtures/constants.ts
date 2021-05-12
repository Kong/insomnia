const getCreds = (user: string, pass: string, encoding: BufferEncoding) => ({
  raw: { user, pass },
  encoded: {
    user: Buffer.from(user, encoding).toString(),
    pass: Buffer.from(pass, encoding).toString(),
  },
  combined: Buffer.from(`${user}:${pass}`, encoding).toString('base64'),
});

export const basicAuthCreds = {
  utf8: getCreds('user', 'pass', 'utf8'),
  latin1: getCreds('user-é', 'pass-é', 'latin1'),
};
