FROM ubuntu:16.04

LABEL "name"="Insomnia-Ubuntu-16"
LABEL "maintainer"="Gregory Schier <gschier1990@gmail.com>"
LABEL "version"="1.0.0"

LABEL "com.github.actions.icon"="package"
LABEL "com.github.actions.color"="blue"
LABEL "com.github.actions.name"="Insomnia Ubuntu 16"
LABEL "com.github.actions.description"="Do the stuff"

COPY entrypoint.sh /scripts/entrypoint.sh
COPY install-dependencies.sh /scripts/install-dependencies.sh

RUN chmod +x /scripts/*
RUN /scripts/install-dependencies.sh \
    && apt-get install -y snapcraft \
    && sudo snap install snapcraft --classic

ENTRYPOINT ["/scripts/entrypoint.sh"]