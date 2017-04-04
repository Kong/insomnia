FROM ubuntu:14.04

RUN mkdir -p /insomnia
WORKDIR /insomnia
COPY . /insomnia

RUN sudo apt-get update

RUN sudo apt-get install -y \
    curl libcurl4-openssl-dev build-essential \
    git-all icnsutils graphicsmagick xz-utils

RUN curl -sL https://deb.nodesource.com/setup_7.x | sudo -E bash - && sudo apt-get install -y nodejs
