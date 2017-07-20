import * as templating from '../../index';
import {globalBeforeEach} from '../../../__jest__/before-each';

function assertTemplate (txt, expected) {
  return async function () {
    const result = await templating.render(txt);
    expect(result).toMatch(expected);
  };
}

const millisRe = /^\d{13}$/;

describe('TimestampExtension', () => {
  beforeEach(globalBeforeEach);
  it('renders basic', assertTemplate('{% timestamp %}', millisRe));
});
