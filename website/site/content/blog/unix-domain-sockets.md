---
date: 2017-06-20
title: Introducing Unix Domain Socket Support
slug: unix-domain-sockets
tags: ["feature"]
---

One of the headlining features of [Insomnia 5.4.0](/changelog/5.4.0/) is support for
[UNIX Domain Sockets](https://en.wikipedia.org/wiki/Unix_domain_socket) – a mechanism
typically used for communication between processes running on the same host operating 
system. This post gives a brief introduction on connecting to a socket within Insomnia.

<!--more-->

In order for Insomnia to distinguish socket requests, a slightly different 
URL syntax is required. The following syntax was borrowed from the popular NodeJS 
[`request`](https://github.com/request/request#unix-domain-sockets) library.

```bash
# Syntax for UNIX domain sockets
http://unix:$SOCKET:$PATH
```

_Note: This feature provides same functionality as using the 
`--unix-socket FILE` flag with `curl`._

## Example Using Docker Engine API 

To demonstrate socket support, we'll issue a request to the `/images` endpoint that is exposed 
by the [Docker Engine's](https://docs.docker.com/engine/api/v1.24/) socket API.
Using the following URL in Insomnia will list the available Docker images on the host machine.

```bash
# Sample URL to communicate with Docker socket
http://unix:/var/run/docker.sock:/v1.24/images/json
```

This URL is specifying the path to the socket (`/var/run/docker.sock`) and the API 
endpoint path (`/v1.24/images/json`) using the previously mentioned URL syntax. Here's what
it looks like within Insomnia.

![Domain Sockets Example](/images/blog/unix-sockets.png)

Since the Docker socket communicates using HTTP and JSON, it looks indistinguishable from 
regular TCP/IP-based HTTP requests being made over the network.

And that's it! I can't wait to hear what you think!
