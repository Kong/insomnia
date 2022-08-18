# Insomnia Smoke Tests Express server

## Quick start

To run the example Express server manually, you can run:

```shell
npm run smoke:serve

# or
npm run serve --prefix packages/insomnia-smoke-test
```

You should see afterwards the following:

```shell
npm run serve --prefix packages/insomnia-smoke-test

> insomnia-smoke-test@3.4.0 serve
> ts-node server/index.ts

## (...)
Listening at grpc://localhost:50051
Listening at http://localhost:4010
Listening at ws://localhost:4010
```

## HTTP

TODO: to be documented

## gRPC

TODO: to be documented

## WebSockets

The server supports basic WebSockets echo and load testing functionality.

You can connect and send messages to `ws://localhost:4010`.

### Echo

#### echo text

You can echo text.

```plaintext
echo
```

#### echo JSON

You can echo JSON.

```json
{
    "json": true
}
```

### Load Testing

#### loadTest: string

You can send a regular string and specify the number of times it sends.  This will send `ZILTOID` 4 times.

```json
{
    "command": "loadTest",
    "messagesPerSecond": 10,
    "stopAfter": 4,
    "respondWith": "ZILTOID"
}
```

#### loadTest: string array

You can also provide an array of strings.  This will send each item in the array as a separate message at the rate of 2 per second.

```json
{
    "command": "loadTest",
    "messagesPerSecond": 2,
    "respondWith": [
        "Greetings humans",
        "I am Ziltoid...the omniscient.",
        "I have come from far across the omniverse.",
        "You shall fetch me your universes ultimate cup of coffee...",
        "Black!",
        "You have five Earth minutes,",
        "Make it perfect!"
    ]
}
```

#### loadTest: `performance.now()`

This example will send 1000 messages in 1 second (1 per millisecond) and stop after the 1000th message.

```json
{
    "command": "loadTest",
    "messagesPerSecond": 1000,
    "stopAfter": 1000,
    "respondWith": {
        "preset": "performance.now()"
    }
}
```

#### loadTest: `Date.now()`

This will send `Date.now()`

```json
{
    "command": "loadTest",
    "messagesPerSecond": 1000,
    "respondWith": {
        "preset": "Date.now()"
    }
}
```

#### loadTest: `Math.random()`

This will send a random number per the spec of `Math.random()`

```json
{
    "command": "loadTest",
    "messagesPerSecond": 1000,
    "respondWith": {
        "preset": "Math.random()"
    }
}
```

### Settings

#### settings: `echo === false`

This setting will turn off echoing.

```json
{
    "command": "settings",
    "echo": false
}
```

#### settings: `echo === true`

This setting will turn on echoing (it's on by default, but maybe after you turned it off).

```json
{
    "command": "settings",
    "echo": true
}
```
