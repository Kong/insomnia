// @flow
import { lintSpecification } from '../lint-specification';

describe('lint specification', () => {
  it('should work', async () => {
    await lintSpecification('spc_46c5a4a40e83445a9bd9d9758b86c16c', {
      workingDir: 'src/db/__fixtures__/git-repo',
    });
  });
});
