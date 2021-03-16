const __constructorMock = jest.fn();
let returnValue = 'test';

class Prompt {
  constructor(options) {
    __constructorMock(options);
  }

  run() {
    return returnValue;
  }
}

module.exports = {
  __constructorMock,
  __mockPromptRun: v => {
    returnValue = v;
  },
  AutoComplete: Prompt,
};
