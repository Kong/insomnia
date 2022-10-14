# syntax=docker/dockerfile:1

FROM docker.io/fedora:36 AS builder

RUN dnf install libcurl-devel make automake gcc gcc-c++ libxcrypt-compat rpm-build -y

# Add files
COPY . ./insomnia

# Install nvm with node and npm
SHELL ["/bin/bash", "--login", "-c"]
RUN curl https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash

# Build and Package the app
# Build and Package the app
RUN cd insomnia && \
    nvm install && \
    npm run bootstrap && \
    npm run app-package-fedora
