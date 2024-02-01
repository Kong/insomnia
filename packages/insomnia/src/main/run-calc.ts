import { utilityProcess } from 'electron';
import { unlink, writeFile } from 'fs/promises';
import os from 'os';
// import { dedent } from 'ts-dedent';

// Handling for forking code written by ChatGPT for the smart calculator function

interface ChildMessage {
  result?: string;
  error?: string;
}
// await main.runCalculation`
//   const hash = crypto.createHash('sha256');
//   hash.update('Hello, world!');
//   const hashedValue = hash.digest('hex');
//   console.log('Hashed value:', hashedValue);
//   hashedValue
// `
export const runCalculation = async (code: string): Promise<string> => {
  // First, we need to wrap the code in the sandbox environment
  const wrappedCode = wrapCode(code);
  const tempFile = await createTempFile(wrappedCode);
  const child = utilityProcess.fork(tempFile, [], {
    env: {},
    // stdio: 'ignore',
    serviceName: 'tomato-calculator',
  });

  try {
    return await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        child.kill();
        reject(new Error('Timeout'));
      }, calculatorTimeout());

      child.on('message', (message: string) => {
        const parsedMessage: ChildMessage = JSON.parse(message);
        if (parsedMessage.result) {
          clearTimeout(timer);
          resolve(parsedMessage.result.toString());
        } else {
          clearTimeout(timer);
          reject(new Error(parsedMessage.error));
        }
      });
    });
  } finally {
    await cleanupTempFile(tempFile);
  }
};

const wrapCode = (code: string): string => {
  console.log('Running code');
  console.log(code);
  // We'll JSON encode the code so that we can safely embed it in the sandbox
  const encodedCode = JSON.stringify(code);
  // return dedent`
  return `
    const vm = require("vm");
    const crypto = require('crypto');
    const code = ${encodedCode};

    const sendMessageData = (obj) => {
      process.parentPort.postMessage(JSON.stringify(obj));
    }

    try {
      const context = {
        crypto: {
          createHash: crypto.createHash,
        },
        console,  // You may include other necessary objects from the global context
      };
      result = vm.runInNewContext(code,context);
      sendMessageData({ result });
    } catch (e) {
      sendMessageData({ error: e.message });
    }
  `;
};

const calculatorTimeout = (): number | undefined => {
  // TODO: Make this configurable
  return 5000;
};

const createTempFile = async (code: string): Promise<string> => {
  // Create a temporary file using the os temp directory
  const tmp = os.tmpdir();
  const tempFile = `${tmp}/tomato-calculator-${Date.now()}.js`;
  await writeFile(tempFile, code);
  return tempFile;
};

const cleanupTempFile = async (tempFile: string): Promise<void> => {
  // Delete the temporary file
  await unlink(tempFile);
};
