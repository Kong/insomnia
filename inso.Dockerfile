# syntax=docker/dockerfile:1
FROM node:12-alpine

RUN apk update

COPY packages/insomnia-inso /packages/insomnia-inso
COPY tsconfig.base.json .
COPY tsconfig.eslint.json .
COPY jest-preset.js .
COPY .eslintignore .
COPY .eslintrc.js .
COPY lerna.json .

WORKDIR /packages/insomnia-inso/

RUN npm install
RUN npm install typescript@4.2.3 rimraf webpack webpack-cli -g
# FIXME: typescript pinned @4.2.3 due to tslint TS2345 failures
RUN npm link typescript

RUN npm run bootstrap

ENTRYPOINT ["./bin/inso"]
