const __constructorMock = jest.fn();

let returnValue = 'test';

module.exports = {
  __constructorMock,
  __mockPromptRun: (value: string) => {
    returnValue = value;
  },
  AutoComplete: class {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- missing types from enquirer
    constructor(options: any) {
      __constructorMock(options);
    }

    run() {
      return returnValue;
    }
  },
};
