const promptRun = require('prompt-run');

promptRun({
  command: 'npm run start:dev',
  options: {},
  questions: {
    env: [
      {
        type: 'list',
        name: 'APP_ID',
        message: 'Select app to start',
        choices: ['com.insomnia.app', 'com.insomnia.designer'],
      },
    ],
  },
}).then(childProcess => {});
