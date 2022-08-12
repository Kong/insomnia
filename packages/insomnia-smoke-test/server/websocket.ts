import { Server } from 'http';
import { performance } from 'perf_hooks';
import { keys } from 'ramda';
import { unreachableCase } from 'ts-assert-unreachable';
import { WebSocket, WebSocketServer } from 'ws';

/**
 * Useful for stress testing.
 */
interface LoadTestCommand {
  command: 'loadTest';

  /**
   * @default 'start'
   */
  action?: 'start' | 'stop';

  /**
   * @warning technically the minimum value a browser can support is 4ms, but this node application can generally only send one message per millisecond (1000 per second).  Values exceeding greater than 1 message per millisecond are best-effort.
   *
   * see: https://developer.mozilla.org/en-US/docs/Web/API/setInterval#delay_restrictions
   */
  messagesPerSecond: number;

  /**
   * If you would like the server to respond with the same thing every time, you can set a `respondWith` value, which will be returned.
   *
   * @default `performance.now()`'s executed value
  */
  respondWith?: {
    preset: 'performance.now()' | 'Date.now()' | 'Math.random()';
  } | string | string[];

  /**
   * if you would like the value returned to be binary, set this flag to true.
   *
   * @default false
   */
  isBinary?: boolean;

  /**
   * set this value if you would like the load testing to stop after a certain number of items
   *
   * @default Infinity
   */
  stopAfter?: number;
}

/**
 * Instructs the server to send a Ping frame to the client
 *
 * see: https://www.rfc-editor.org/rfc/rfc6455#section-5.5.2
 */
interface PingCommand {
  command: 'ping';

  /**
   * @default 'start'
   */
  action?: 'start' | 'stop';

  pingsPerSecond?: number;

  /**
   * according to the spec, the payload "data" of the ping is arbitrary (i.e. not guaratneed to be either binary or valid UTF-8).
   *
   * The only stipulation is that a Pong frame sent in response to a Ping frame must have identical "Application data" as found in the message body of the Ping frame being replied to.
   *
   * see: https://www.rfc-editor.org/rfc/rfc6455#section-5.5.2
   */
  data?: string | Buffer;

  /**
   * specifies whether pong payload data should be masked
   */
   masked?: boolean;
}

/**
 * Useful in testing how the server will respond to Ping frames sent by the client (by the server sending Pong frames to the client)
 */
interface PongCommand {
  command: 'pong';

  /**
   * sending 'stop' will cause the server to send Pong frames in response to Ping frames as normal
   *
   * @default 'start'
   */
  action?: 'start' | 'stop';

  /**
   * Useful to simulate a break in the normal spec where any given ping
   */
  data?: string | Buffer;

  /**
   * specifies whether pong payload data should be masked.
   */
  masked?: boolean;
}

/**
 * Instructs the server to initiate a connection close by sending a close frame to the client.
 *
 * see for discussion on normal closing: https://www.rfc-editor.org/rfc/rfc6455#section-5.5.1
 *
 * see the `forceTerminateInMs` documentation for information regarding forced socket termination.
 */
interface CloseCommand {
  command: 'close';

  /**
   * see: https://www.rfc-editor.org/rfc/rfc6455#section-7.1.6
   */
  reason?: string;

  /**
   * @default 1000
   *
   * for discussion on close frames see: https://www.rfc-editor.org/rfc/rfc6455#section-7.1.5
   *
   * for a list of codes, see: https://www.rfc-editor.org/rfc/rfc6455#section-7.4.1
   */
  code?: number;

  /**
   * The number of milliseconds the server will wait until sending the close frame to the client.
   *
   * Can also be used in combination with `forceTermination`
   */
  delayMs?: number;

  /**
   * Will forcibly close the socket without sending a close frame (simulating a network drop) immedaitely
   * If set to a number, the server will wait that number of milliseconds and then close
   */
  forceTermination?: boolean;
}

interface Settings {
  /**
   * Useful if you want to test that your client closes the socket after receiving a close frame (as the RFC requires)
   */
  ignoreCloseFrames: boolean;

     /**
      * Turn off echoing (for messages that are not commands)
      * @default true
      */
  echo: boolean;

  maskTextFrames: boolean;
  maskBinaryFrames: boolean;
  maskPingFrames: boolean;
  maskPongFrames: boolean;

  /**
   * Instructs the server to ignore pings sent by the client and _not_ send a Pong.
   *
   * This is useful in testing a situation where the TCP socket has been left open but the server is not responsive.
   */
   ignorePings: boolean;
}

interface SettingsCommand extends Partial<Settings> {
  command: 'settings';
}

type Command =
  | CloseCommand
  | LoadTestCommand
  | SettingsCommand
  | PingCommand
  | PongCommand
  ;

const isJSON = (input: string) => {
  try {
    return JSON.parse(input);
  } catch (error) {}

  return false;
};

const isCommand = (input: unknown): input is Command => {
  if (!input) {
    return false;
  }

  if (typeof input !== 'object') {
    return false;
  }

  if (Array.isArray(input)) {
    return false;
  }

  if ('command' in input) {
    return true;
  }

  return false;
};
class WebSocketHandler {
  ignoreCloseFrames = false;
  echo = true;
  maskTextFrames = false;
  maskBinaryFrames = false;
  maskPingFrames = false;
  maskPongFrames = false;
  ignorePings = false;

  ws: WebSocket;

  constructor(ws: WebSocket) {
    this.ws = ws;

    ws.on('message', (message, isBinary) => {
      if (isBinary && this.echo) {
        ws.send(message);
        return;
      }

      const messageString = message.toString();
      const maybeJson = isJSON(messageString);
      if (isCommand(maybeJson)) {
        this.handleCommand(maybeJson);
        return;
      }

      if (this.echo) {
        ws.send(String(message));
      }
    });

    ws.on('ping', this.handlePing);
  }

  handlePing = (data: Buffer) => {
    if (this.ignorePings) {
      return;
    }

    this.ws.pong(data);
  };

  handleCommand = (command: Command) => {
    console.log('received command', command);

    switch (command.command) {
      case 'close':
        this.closeCommand(command);
        break;

      case 'loadTest':
        this.loadTestCommand(command);
        break;

      case 'settings':
        this.settingsCommand(command);
        break;

      case 'ping':
        this.pingCommand(command);
        break;

      case 'pong':
        this.pongCommand(command);
        break;

      default:
        try {
          unreachableCase(command);
        } catch (error) {
          // by design, sending an unrecognized command should not crash the server, so we don't exit the process here, however we do still want the exhaustiveness check.
        }
        this.sendError(`unknown command ${command}`);
    }
  };

  pongCommand = ({}: PongCommand) => {
    this.ws.pong();
  };

  pingCommand = ({}: PingCommand) => {
    this.ws.ping();
  };

  settingsCommand = (settings: SettingsCommand) => {
    keys(settings).forEach(setting => {
      switch (setting) {
        case 'echo':
          if (settings.echo !== undefined) {
            this.echo = settings.echo;
          }
          break;

        case 'ignoreCloseFrames':
          if (settings.ignoreCloseFrames !== undefined) {
            this.ignoreCloseFrames = settings.ignoreCloseFrames;
          }
          break;

        case 'maskTextFrames':
          if (settings.maskTextFrames !== undefined) {
            this.maskTextFrames = settings.maskTextFrames;
          }
          break;

        case 'maskBinaryFrames':
          if (settings.maskBinaryFrames !== undefined) {
            this.maskBinaryFrames = settings.maskBinaryFrames;
          }
          break;

        case 'maskPingFrames':
          if (settings.maskPingFrames !== undefined) {
            this.maskPingFrames = settings.maskPingFrames;
          }
          break;

        case 'maskPongFrames':
          if (settings.maskPongFrames !== undefined) {
            this.maskPongFrames = settings.maskPongFrames;
          }
          break;

        case 'ignorePings':
          if (settings.ignorePings !== undefined) {
            this.ignorePings = settings.ignorePings;
          }
          break;

        case 'command':
          break;

        default:
          try {
            unreachableCase(setting);
          } catch (error) {
            // by design, sending an unrecognized setting should not crash the server, so we don't exit the process here, however we do still want the exhaustiveness check.
          }
      }
    });
  };

  closeCommand = ({
    code = 1000,
    reason,
    delayMs = 0,
    forceTermination,
  }: CloseCommand) => {
    if (forceTermination) {
      setTimeout(() => {
        this.ws.terminate();
      }, delayMs);
      return;
    }

    try {
      this.ws.close(code, reason); // this can throw if an invalid code is detected
    } catch (error) {
      console.error(error);
      if (error instanceof TypeError) {
        this.ws.send(`unable to close: ${error.message}`);
      }
    }
  };

  loadIntervalTimeout: NodeJS.Timeout | null = null;
  loadTestItems: string[] = [];
  loadTestIndex = 0;
  loadTestCount = 1;
  loadTestCommand = ({ action, messagesPerSecond, respondWith, stopAfter }: LoadTestCommand) => {
    const stop = () => {
      if (!this.loadIntervalTimeout) {
        this.sendError('Timer never started');
        return;
      }
      clearInterval(this.loadIntervalTimeout);
      this.loadIntervalTimeout = null;
      this.loadTestItems = [];
      this.loadTestIndex = 0;
      this.loadTestCount = 1;
    };

    if (action === 'stop') {
      stop();
      return;
    }

    if (this.loadIntervalTimeout !== null) {
      this.sendError('already running a load test command');
      return;
    }

    const intervalMilliseconds = 1000 / messagesPerSecond;

    // the loop below, as a load testing tool, is an intentionally "hot" codepath, so we do these allocations outside of the loop to cut down on processing, as the setInterval's callback may be called thousands of times per second.
    const isArrayOfItems = Array.isArray(respondWith);
    if (isArrayOfItems) {
      this.loadTestItems = respondWith;
      this.loadTestIndex = 0;
    }

    this.loadIntervalTimeout = setInterval(() => {
      if (this.loadTestCount > (stopAfter || Infinity)) {
        stop();
        return;
      }
      this.loadTestCount += 1;

      if (!respondWith) {
        // default behavior is to send `performance.now()`
        this.ws.send(String(performance.now()));
        return;
      }

      if (typeof respondWith === 'string') {
        this.ws.send(respondWith);
        return;
      }

      if (isArrayOfItems) {
        if (this.loadTestIndex >= this.loadTestItems.length) {
          stop();
          return;
        }

        this.ws.send(this.loadTestItems[this.loadTestIndex]);
        this.loadTestIndex += 1;
        return;
      }

      if (respondWith.preset) {
        switch (respondWith.preset) {
          case 'Date.now()':
            this.ws.send(String(Date.now()));
            return;

          case 'performance.now()':
            this.ws.send(String(performance.now()));
            return;

          case 'Math.random()':
            this.ws.send(String(Math.random()));
            return;

          default:
            this.sendError(`unrecognized preset: ${respondWith.preset}`);
            stop();
            try {
              unreachableCase(respondWith.preset);
            } catch (error) {
              // by design, sending an unrecognized preset should not crash the server, so we don't exit the process here, however we do still want the exhaustiveness check.
            }
        }
      }
    }, intervalMilliseconds);
  };

  sendError = (message: string) => {
    this.ws.send(`[ERROR]: ${message}`);
  };
}

/**
 * Starts an echo WebSocket server that receives messages from a client and echoes them back.
 */
export function startWebsocketServer(server: Server) {
  const wsServer = new WebSocketServer({ server });

  wsServer.on('connection', (ws, req) => {
    console.log('WebSocket connection was opened');
    console.log('Upgrade headers:', req.headers);

    new WebSocketHandler(ws);

    ws.on('close', () => {
      console.log('WebSocket connection was closed');
    });
  });

  return wsServer;
}
