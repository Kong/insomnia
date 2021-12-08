# Experimenting with Playwright to test the Insomnia app

## Setup

Package the app 

```sh
# 📂 insomnia/
npm run app-build:smoke
```

Run the tests

```sh
# 📂 insomnia/
npm run test:playwright:build
```

Test Recorder

```sh
# 📂 insomnia/
PWDEBUG=1 npm run test:playwright:build 
```
