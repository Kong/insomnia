import * as cli from '../../cli';
import execa from 'execa-wrap';

const initInso = () => {
  return args => {
    const cliArgs = `node test ${args}`.split(' ');
    // console.log('calling cli.go with: %o', cliArgs);
    return cli.go(cliArgs);
  };
};

describe('handleGenerateConfig', () => {
  let inso = initInso();
  beforeEach(() => {
    inso = initInso();
  });

  it('should warn when --type option is not recognized', async () => {
    const result = await execa('./bin/inso');

    expect(result).toMatchSnapshot();
  });

  xit('should warn when --type option is not recognized', () => {
    inso('generate config -t test file.yaml');
  });
});
