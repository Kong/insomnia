import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import express from 'express';
import { Server } from 'http';
import WebSocket, { WebSocketServer } from 'ws';

import { startWebsocketServer } from './websocket';

describe('websocket smoke test server', () => {
  let timeout: number;
  process.platform === 'win32' ? timeout = 60000 : timeout = 25000;
  jest.setTimeout(timeout); // allow for slow CI environments and slower Windows GH machines

  const app = express();
  let server: Server;
  let wsServer: WebSocketServer;
  beforeEach(done => {
    server = app.listen(1234);
    wsServer = startWebsocketServer(server);
    done();
  });

  afterEach(done => {
    wsServer.close();
    server.close();
    done();
  });

  describe('echo', () => {
    it('can return text sent', async () => {
      const { client, messages } = await createWebSocketClient('ws://localhost:1234');
      const sampleText = 'Fly you fools';
      client.send(sampleText);
      await waitForWebSocketState(client, client.CLOSED);
      const [message] = messages;
      expect(message).toEqual(sampleText);
    });

    it('can return json sent', async () => {
      const { client, messages } = await createWebSocketClient('ws://localhost:1234');
      const sampleJson = JSON.stringify({ hello: 'world' });
      client.send(sampleJson);
      await waitForWebSocketState(client, client.CLOSED);
      const [message] = messages;
      expect(message).toEqual(sampleJson);
    });

    it('can be disabled and enabled by settings', async () => {
      const { client, messages } = await createWebSocketClient('ws://localhost:1234', 1000);
      const echoExamples = [
        'All we have to decide is what to do with the time that is given us',
        'Fly you fools',
        '"Fool of a Took!" he growled.',
      ];
      const anotherEchoExample = 'Not idly do the leaves of Lorien fall';

      // Disable echo and try to echo messages afterwards
      const disableEcho = JSON.stringify({
        command: 'settings',
        echo: false,
      });
      client.send(disableEcho);
      echoExamples.forEach(echo => client.send(echo));

      // Enable echo and try to echo a message afterwards
      const enableEcho = JSON.stringify({
        command: 'settings',
        echo: true,
      });
      client.send(enableEcho);
      client.send(anotherEchoExample);
      client.close();
      await waitForWebSocketState(client, client.CLOSED);

      // We should only see the echo messages while echo is enabled
      expect(messages).toEqual([anotherEchoExample]);
    });
  });

  describe('loadTest', () => {
    it('can send a string and specify the number of times it sends', async () => {
      const stopAfter = 4;
      const { client, messages } = await createWebSocketClient('ws://localhost:1234', stopAfter);
      const payload = JSON.stringify({
        command: 'loadTest',
        messagesPerSecond: 10,
        stopAfter: stopAfter,
        respondWith: 'ZILTOID',
      });
      const expected = ['ZILTOID', 'ZILTOID', 'ZILTOID', 'ZILTOID'];
      client.send(payload);
      await waitForWebSocketState(client, client.CLOSED);
      expect(messages).toEqual(expected);
    });

    it('can send an array of strings at a specific rate', async () => {
      const exampleArray = [
        'Greetings humans',
        'I am Ziltoid...the omniscient.',
        'I have come from far across the omniverse.',
        'You shall fetch me your universes ultimate cup of coffee...',
        'Black!',
        'You have five Earth minutes,',
        'Make it perfect!',
      ];
      const { client, messages } = await createWebSocketClient('ws://localhost:1234', exampleArray.length);
      const payload = JSON.stringify({
        command: 'loadTest',
        messagesPerSecond: 2,
        respondWith: exampleArray,
      });
      client.send(payload);
      await waitForWebSocketState(client, client.CLOSED);
      expect(messages).toEqual(exampleArray);
    });

    it('can send multiple messages and stop after a given number', async () => {
      const messageLimit = 1000;
      const { client, messages } = await createWebSocketClient('ws://localhost:1234', messageLimit);
      const payload = JSON.stringify({
        command: 'loadTest',
        messagesPerSecond: messageLimit,
        stopAfter: messageLimit,
        respondWith: {
          preset: 'performance.now()',
        },
      });
      client.send(payload);
      await waitForWebSocketState(client, client.CLOSED);
      expect(messages.length).toEqual(messageLimit);
    });

    it('can keep sending messages until client closes connection', async () => {
      const logSpy = jest.spyOn(console, 'log');
      const messageLimit = 400;
      const { client, messages } = await createWebSocketClient('ws://localhost:1234', messageLimit);
      const payload = JSON.stringify({
        command: 'loadTest',
        messagesPerSecond: 200,
        respondWith: {
          preset: 'Date.now()',
        },
      });
      client.send(payload);
      await waitForWebSocketState(client, client.CLOSED);
      expect(messages.length).toEqual(messageLimit);
      expect(logSpy).toHaveBeenCalledWith('WebSocket connection was closed');
    });
  });

});

// adapted from https://thomason-isaiah.medium.com/writing-integration-tests-for-websocket-servers-using-jest-and-ws-8e5c61726b2a
async function createWebSocketClient(host: string, closeAfter = 1) {
  const client = new WebSocket(host);
  await waitForWebSocketState(client, client.OPEN);
  const messages: string[] = [];
  client.on('message', data => {
    messages.push(data.toString());
    if (messages.length === closeAfter) {
      client.close();
    }
  });
  return { client, messages };
}

// adapted from https://thomason-isaiah.medium.com/writing-integration-tests-for-websocket-servers-using-jest-and-ws-8e5c61726b2a
async function waitForWebSocketState(socket: WebSocket, state: unknown) {
  return new Promise<void>(function(resolve) {
    setTimeout(function() {
      if (socket.readyState === state) {
        resolve();
      } else {
        waitForWebSocketState(socket, state).then(resolve);
      }
    }, 5);
  });
}
