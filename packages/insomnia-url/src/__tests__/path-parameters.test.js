const { insertPathParameters } = require('../path-parameters');

describe('insertPathParameters()', () => {
  it('correctly inserts path parameter', () => {
    const url = insertPathParameters('https://mail.google.com/mail/u/:authuser', [
      { name: 'authuser', value: '0' },
    ]);
    expect(url).toBe('https://mail.google.com/mail/u/0');
  });

  it('correctly inserts multiple path parameters', () => {
    const url = insertPathParameters('https://www.reddit.com/r/:subreddit/comments/:postId.json', [
      { name: 'subreddit', value: 'pics' },
      { name: 'postId', value: 'haucpf' },
    ]);
    expect(url).toBe('https://www.reddit.com/r/pics/comments/haucpf.json');
  });
});
