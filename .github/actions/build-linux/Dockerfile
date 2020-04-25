FROM ubuntu:14.04

LABEL "name"="Insomnia-Ubuntu-14"
LABEL "maintainer"="Gregory Schier <greg.schier@konghq.com>"
LABEL "version"="1.0.0"

LABEL "com.github.actions.icon"="package"
LABEL "com.github.actions.color"="blue"
LABEL "com.github.actions.name"="Insomnia Ubuntu 14"
LABEL "com.github.actions.description"="Build and package on Ubuntu 14"

RUN apt-get update \
    && apt-get upgrade -y \
    && apt-get install -y \
        build-essential \
        autoconf \
        libtool \
        pkg-config \
        libfontconfig1-dev \
        rpm \
        wget \
        graphicsmagick \
        icnsutils

# Install NodeJS
ENV NODE_VERSION 10.14.0
ENV PATH "/node-v${NODE_VERSION}-linux-x64/bin:${PATH}"
RUN wget -q https://nodejs.org/download/release/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.gz \
    && tar xzf node-v${NODE_VERSION}-linux-x64.tar.gz \
    && node --version \
    && npm --version

# Install curl-related of dependencies
COPY entrypoint.sh /scripts/entrypoint.sh
COPY install-dependencies.sh /scripts/install-dependencies.sh
RUN chmod +x /scripts/* \
    && /scripts/install-dependencies.sh

ENTRYPOINT ["/scripts/entrypoint.sh"]