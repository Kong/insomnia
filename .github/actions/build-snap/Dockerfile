FROM snapcore/snapcraft:stable

LABEL "name"="Insomnia-Ubuntu-16"
LABEL "maintainer"="Gregory Schier <gschier1990@gmail.com>"
LABEL "version"="1.0.0"

LABEL "com.github.actions.icon"="package"
LABEL "com.github.actions.color"="blue"
LABEL "com.github.actions.name"="Insomnia Ubuntu 16"
LABEL "com.github.actions.description"="Build and package on Ubuntu 16"

COPY entrypoint.sh /scripts/entrypoint.sh
COPY install-dependencies.sh /scripts/install-dependencies.sh

RUN chmod +x /scripts/*
RUN /scripts/install-dependencies.sh

ENTRYPOINT ["/scripts/entrypoint.sh"]