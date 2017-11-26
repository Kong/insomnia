---
date: 2016-12-09
title: Electron is a Web Developer's Dream
tags: ["electron", "software"]
---

[Electron](http://electron.atom.io/) is a framework for building cross-platform
desktop apps in Javascript, HTML, and CSS. The folks at GitHub somehow
managed to cram the [Node.js](https://nodejs.org) runtime into the
[Chromium](https://www.chromium.org/) web browser, letting developers combine 
the flexibility of HTML and CSS with the ever expanding ecosystem of 
over 380,000 Node modules. 

<!--more-->

What an amazing time to be alive! &#128588;

I've been using Electron for almost six months now, and am loving it. As an
independent developer with a background in web, Electron provides an extremely
productive environment to build and ship a cross-platform desktop app.

Let me explain...

## One Browser to Support

The most significant benefit of Electron, from a web developer's perspective, is 
that it provides a consistent and modern runtime. No more worrying if the new
HTML5 form validation features will work in Safari or IE. If it works in Chrome,
you can use it. 

_This is not really a feature of Electron, but more of a side-effect gained by
constraining yourself to it. You could easily write a website that only works in 
Chrome and get the same effect. With this in mind, let's move on to the more 
tangible advantages._

## Node.js Modules and ES6 Syntax

The Electron runtime includes the latest version of Node.js and Chromium.
This means you can use the fancy new ES6 features without being at the mercy of 
complex build tools like [Webpack](https://webpack.github.io/). 

Here's a basic cross-platform example of how to use Electron/Node/ES6 to write a file
to the user's desktop. I've also nested the JavaScript inside of an HTML page to 
demonstrate the combined Node and HTML environment.

```html
<html>
<head>
    <title>Electron File Demo</title>
</head>
<body>
<script>
    // Write a file using ES6 and NodeJs
    const fs = require('fs');
    const path = require('path');
    const electron = require('electron');
    
    const pathToDesktop = electron.remote.app.getPath('desktop');
    const fullPath = path.join(pathToDesktop, 'message.txt');
    const message = 'Hello World!';

    fs.writeFileSync(fullPath, message);
</script>
</body>
</html>
```

Try doing that in a web browser &#128539;

## CSS Grid and Variables

[CSS Grid](https://css-tricks.com/snippets/css/complete-guide-grid/) is a new 
grid-based layout system for CSS. It lets you define grid regions, specify constraints, 
and easily change the entire layout with a media query and a few lines of CSS. Grid is
designed to make single page app (SPA) layouts easier to manage, so it fits perfectly
with the desktop app use case of Electron.

Grid is still an experimental feature, but can be enabled in Electron by setting a
Chromium flag on launch. And, as soon as fully supported by Chromium, it will be 
fully supported by Electron.

```js
// Enable experimental features to get Grid
const {app} = require('electron');
app.commandLine.appendSwitch(
    'enable-experimental-web-platform-features'
);
```

_Note: Grid is still **very buggy**. However, for complex layouts, the extra work of
dealing with bugs far outweighs the endless pain of implementing the same layout with
existing CSS features (yes, even flexbox. I've tried)._

Once enabling the flag, you can make your first grid. Here is simplified example 
taken from Insomnia that uses both Grid and Variables.

```css
:root {
    --brand-color: #7568be;
}

.container{
  grid-template-columns: 12rem 0.5fr 0.5fr;
  grid-template-rows: 4rem 1fr;
  grid-template-areas: "sidebar header header"
                       "sidebar col1 col2"
}
.header { 
    background: var(--brand-color);
    grid-area: header; 
}
.col1 { grid-area: col1; }
.col2 { grid-area: col2; }
.sidebar { grid-area: sidebar; }
```

Even though the above example was simplified for demonstration, it doesn't take much
more to end up with a fully-responsive layout like the one you see here.

![Insomnia Grid](/images/blog/insomnia-grid.png)

## Desktop Features

There are a lot of awesome [Electron APIs](http://electron.atom.io/docs/api/) that
can be used to do things that aren't yet possible inside a web browser. Here are 
just a few examples:

- [Record the user's screen](http://electron.atom.io/docs/api/desktop-capturer/)
- [Define global keyboard shortcuts](http://electron.atom.io/docs/api/accelerator/)
- [Add an icon to the notification tray](http://electron.atom.io/docs/api/tray/)

You can also bundle native modules with Electron apps, so the possibilities are
endless. One of the most common pairings I've noticed is using Electron with
[SQLite](https://sqlite.org/).

## First-Class Testing Tools

Electron maintains two tools awesome tools that make it easier to write and maintain 
high quality apps.

**[Spectron](http://electron.atom.io/spectron/)** is a framework for running interactive
test suites, which is useful for automating user flows and interactions.

**[Devtron](http://electron.atom.io/devtron/)** is a DevTools extension that provides
useful insight about your app such ash displaying the _require_ graph, active event listeners,
and accessibility issues (amazing!).

![Electron Devtron Accessibility](/images/blog/devtron.png)

Many other tools have been built from the community as well. My favourite tool right now
is [electron-builder](https://github.com/electron-userland/electron-builder), which handles
the ugly process of building, packaging, signing, and deploying cross-platform apps.

## Closing Thoughts

This post has covered all of my favourite things about Electron, but those things come at
a high cost. Since every Electron app is essentially a Chromium web browser running your
JavaScript code, even the most basic applications have a **base size of 150MB 
(~60MB zipped) and consume 100MB of RAM**. 

<p class="text-xl">
You may want to think twice before choosing Electron to build that slick new weather widget
of yours &#128586;
</p>

**Think of Electron as a monster truck**. It's powerful, strong, and very durable,
but you wouldn't use it to take your daughter to violin lessons.

![Electron as a Monster Truck](https://media.giphy.com/media/Lv6v0fAcPDfnW/giphy.gif)

...or would you?
