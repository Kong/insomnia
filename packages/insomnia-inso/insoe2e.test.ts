import { expect } from 'chai';
import { exec } from 'child_process';

describe.skip('Command exit code test', () => {
  // List of commands to test
  const commands = [
    '$PWD/packages/insomnia-inso/bin/inso run test "Echo Test Suite" --src $PWD/packages/insomnia-smoke-test/fixtures/inso-nedb --env Dev --verbose',
    '$PWD/packages/insomnia-inso/bin/inso lint spec $PWD/packages/insomnia-smoke-test/fixtures/swagger2.yaml',
    '$PWD/packages/insomnia-inso/bin/inso export spec "Smoke Test API server 1.0.0" --src $PWD/packages/insomnia-smoke-test/fixtures/inso-nedb',
  ];

  commands.forEach(command => {
    it(`should return exit code 0 for command: ${command}`, done => {
      exec(command, (error, _, stderr) => {
        if (error) {
          console.error(`Error executing command: ${command}`);
          console.error(stderr);
        }
        expect(error).to.be.null; // ensures no error occurred (exit code 0)
        done();
      });
    });
  });
});
