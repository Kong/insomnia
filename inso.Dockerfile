# syntax=docker/dockerfile:1
FROM node:12-alpine

RUN apk update

COPY packages/insomnia-inso/src /src
COPY packages/insomnia-inso/webpack /webpack
COPY packages/insomnia-inso/bin /bin

COPY packages/insomnia-inso/.eslintignore .
COPY packages/insomnia-inso/.eslintrc.js .
COPY packages/insomnia-inso/jest.config.js .
COPY packages/insomnia-inso/package.json .
COPY packages/insomnia-inso/package-lock.json .
COPY packages/insomnia-inso/tsconfig.json .
COPY packages/insomnia-inso/tsconfig.build.json .
COPY tsconfig.base.json .

WORKDIR /

RUN npm install
RUN npm install typescript rimraf webpack webpack-cli -g
RUN npm link typescript

RUN npm run bootstrap

ENTRYPOINT ["/bin/inso"]
