# Insomnia REST Client [![Build Status](https://travis-ci.com/getinsomnia/app.svg?branch=master)](https://travis-ci.com/getinsomnia/app)

An elegant and simple REST API client.

![Insomnia REST Client](https://insomnia.rest/images/docs/promo.png)

## Setup

```bash
# Install and use correct Node version
nvm install 

# Install dependencies
npm install
```

## Run Development

When you run the development environment, it will start both a dev server and an Electron
instance. The dev server is part of Webpack and is used to control hot module replacement
of UI components. This means that, if you change a component file, you will not need to
refresh the app to see the change. It will inject the new component immediately.

```bash
npm run dev
```

## Build for Production

Build all assets into `./build/`

```bash
npm run build
```

## Build and Package Installers

Build binary files for each platform into `./dist/`

```bash
npm run package
```
