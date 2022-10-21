# syntax=docker/dockerfile:1

FROM docker.io/fedora:36 AS builder

RUN dnf upgrade -y
RUN dnf install libcurl-devel make automake gcc gcc-c++ libxcrypt-compat rpm-build cups -y

# Add files
COPY . ./insomnia

# Install nvm with node and npm
SHELL ["/bin/bash", "--login", "-c"]
RUN curl https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash

# Build and Package the app
WORKDIR /insomnia

RUN nvm install
RUN npm run bootstrap
RUN NODE_OPTIONS="--max-old-space-size=6144" BUILD_TARGETS="rpm" BUILD_DEPS_FROM_SOURCE="true" BUILD_TARGET_LABEL="fedora" npm run app-package

ENTRYPOINT [ "bash" ]
