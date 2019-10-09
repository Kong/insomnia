FROM ubuntu:14.04

LABEL "name"="Insomnia-Linux"
LABEL "maintainer"="Gregory Schier <gschier1990@gmail.com>"
LABEL "version"="1.0.0"

LABEL "com.github.actions.icon"="package"
LABEL "com.github.actions.color"="blue"
LABEL "com.github.actions.name"="Insomnia Linux"
LABEL "com.github.actions.description"="Do the stuff"

COPY entrypoint.sh /entrypoint.sh

ADD install-dependencies.sh /scripts/install-dependencies.sh
RUN /scripts/install-dependencies.sh

ADD bootstrap.sh /scripts/bootstrap.sh
RUN /scripts/bootstrap.sh

ENTRYPOINT ["/entrypoint.sh"]