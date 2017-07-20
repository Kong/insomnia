import * as templating from '../../index';

function assertTemplate (txt, expected) {
  return async function () {
    const result = await templating.render(txt);
    expect(result).toMatch(expected);
  };
}

const millisRe = /^\d{13}$/;

describe('TimestampExtension', () => {
  beforeEach(global.insomniaBeforeEach);
  it('renders basic', assertTemplate('{% timestamp %}', millisRe));
});
