import { PluginTemplateFilter } from '../extensions';

enum DigitType {
    dec = 10,
    bin = 2,
    hex = 16,
    oct = 8,
}
enum Process {
    none,
    updown,
    round,
    ceil,
    floor,
    abs,
}

enum UpdownMethod {
    Plus = '+',
    Subtract = '-',
    Multiply = '*',
    Divide = '/',
}

const processNumberFilter: PluginTemplateFilter = {
  name: 'processNumber',
  displayName: 'Number processing',
  description: 'Generate random things',
  args: [
    {
      displayName: 'Number type',
      type: 'enum',
      options: [
        { displayName: 'Decimal', value: DigitType[DigitType.dec] },
        { displayName: 'Binary', value: DigitType[DigitType.bin] },
        { displayName: 'Hexadecimal', value: DigitType[DigitType.hex] },
        { displayName: 'Octal', value: DigitType[DigitType.oct] },
      ],
      defaultValue: DigitType[DigitType.dec],
    },
    {
      displayName: 'Processing type',
      type: 'enum',
      options: [
        { displayName: 'None', value: Process[Process.none] },
        { displayName: 'Self increase/descrease', value: Process[Process.updown] },
        { displayName: 'Round', value: Process[Process.round] },
        { displayName: 'Ceil', value: Process[Process.ceil] },
        { displayName: 'Floor', value: Process[Process.floor] },
        { displayName: 'Abs', value: Process[Process.abs] },
      ],
      defaultValue: Process[Process.none],
    },
    {
      displayName: 'Transform output',
      type: 'boolean',
      defaultValue: false,
    },
    {
      displayName: 'Increase/Descrease method',
      type: 'enum',
      options: [
        { displayName: 'Plus', value: UpdownMethod.Plus },
        { displayName: 'Subtract', value: UpdownMethod.Subtract },
        { displayName: 'Multiply', value: UpdownMethod.Multiply },
        { displayName: 'Divide', value: UpdownMethod.Divide },
      ],
      hide: (args: any[]) => args[1].value !== 'updown',
      defaultValue: UpdownMethod.Plus,
    },
    {
      displayName: 'Increase/Descrease by',
      type: 'number',
      defaultValue: 1,
      hide: (args: any[]) => args[1].value !== 'updown',
    },
    {
      displayName: 'Transform to type',
      type: 'enum',
      options: [
        { displayName: 'Decimal', value: DigitType[DigitType.dec] },
        { displayName: 'Binary', value: DigitType[DigitType.bin] },
        { displayName: 'Hexadecimal', value: DigitType[DigitType.hex] },
        { displayName: 'Octal', value: DigitType[DigitType.oct] },
      ],
      hide: (args: any[]) => args[2].value === 'false' || !args[2].value,
      defaultValue: DigitType[DigitType.dec],
    },
    {
      displayName: 'Default value',
      type: 'string',
      placeholder: 'Default number value',
      defaultValue: '',
    },
  ],
  async run(
    _context: any,
    input: string,
    type: string,
    process: string,
    isTransformOutput: string,
    updownMethod: string,
    updownBy: string | number,
    transformType: string,
    defaultNumber: string,
  ) {
    let inputValue = 0;
    let outputValue = 0;
    let updownByValue = 0;
    if (typeof updownBy === 'string') {
      updownByValue = parseInt(updownBy);
    } else {
      updownByValue = updownBy;
    }
    if (input === '' || input === 'NaN') {
      input = defaultNumber;
    }
    switch (type) {
      case DigitType[DigitType.dec]: inputValue = parseInt(input); break;
      case DigitType[DigitType.bin]: inputValue = parseInt(input, 2); break;
      case DigitType[DigitType.hex]: inputValue = parseInt(input, 16); break;
      case DigitType[DigitType.oct]: inputValue = parseInt(input, 8); break;
      default: break;
    }
    if (isNaN(inputValue)) {
      return Number.NaN;
    }
    if (process === Process[Process.updown]) {
      switch (updownMethod) {
        case UpdownMethod.Plus: outputValue = inputValue + updownByValue; break;
        case UpdownMethod.Subtract: outputValue = inputValue - updownByValue; break;
        case UpdownMethod.Multiply: outputValue = inputValue * updownByValue; break;
        case UpdownMethod.Divide: outputValue = inputValue / updownByValue; break;
        default: break;
      }
    } else {
      switch (process) {
        case Process[Process.round]: outputValue = Math.round(inputValue); break;
        case Process[Process.ceil]: outputValue = Math.ceil(inputValue); break;
        case Process[Process.floor]: outputValue = Math.floor(inputValue); break;
        case Process[Process.abs]: outputValue = Math.abs(inputValue); break;
        case Process[Process.none]:
        default:
          outputValue = inputValue;
          break;
      }
    }
    if (isTransformOutput !== 'false') {
      switch (transformType) {
        case DigitType[DigitType.dec]: return outputValue.toString(10);
        case DigitType[DigitType.bin]: return outputValue.toString(2);
        case DigitType[DigitType.hex]: return outputValue.toString(16);
        case DigitType[DigitType.oct]: return outputValue.toString(8);
        default: break;
      }
    }
    return outputValue;
  },
};

export default processNumberFilter;
