import * as templating from '../../index';

function assertTemplate (txt, expected) {
  return async function () {
    const result = await templating.render(txt);
    expect(result).toMatch(expected);
  }
}

const isoRe = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/;
const secondsRe = /^\d{10}$/;
const millisRe = /^\d{13}$/;

describe('NowExtension', () => {
  it('renders default ISO', assertTemplate('{% now %}', isoRe));
  it('renders ISO-8601', assertTemplate('{% now "ISO-8601" %}', isoRe));
  it('renders seconds', assertTemplate('{% now "seconds" %}', secondsRe));
  it('renders s', assertTemplate('{% now "s" %}', secondsRe));
  it('renders unix', assertTemplate('{% now "unix" %}', secondsRe));
  it('renders millis', assertTemplate('{% now "millis" %}', millisRe));
  it('renders ms', assertTemplate('{% now "ms" %}', millisRe));
  it('renders default fallback', assertTemplate('{% now "foo" %}', isoRe));
});
