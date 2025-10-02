export function getProcessorArchitecture() {
  if (process.platform === 'win32') {
    console.log('process.env[PROCESSOR_ARCHITECTURE]', process.env['PROCESSOR_ARCHITECTURE']);
    console.log('process.arch', process.arch);
    console.log('process.env[PROCESSOR_ARCHITEW6432]', process.env['PROCESSOR_ARCHITEW6432']);

    return process.arch;
  }
  return process.arch;
}
