FROM ubuntu:16.04

ADD docker/install-dependencies.sh /scripts/install-dependencies.sh
RUN /scripts/install-dependencies.sh && apt-get install -y snapcraft

# Setup dirs
ADD . /src/insomnia
WORKDIR /src/insomnia
VOLUME /src/insomnia/packages/insomnia-app/dist

ADD docker/bootstrap.sh /scripts/bootstrap.sh
RUN /scripts/bootstrap.sh

# Define build command
CMD npm run app-package
