FROM ubuntu:14.04

ADD docker/install-dependencies.sh /scripts/install-dependencies.sh
RUN /scripts/install-dependencies.sh

# Setup dirs
ADD . /src/insomnia
WORKDIR /src/insomnia
VOLUME /src/insomnia/packages/insomnia-app/dist

ADD docker/bootstrap.sh /scripts/bootstrap.sh
RUN /scripts/bootstrap.sh

# Define build command
CMD npm run app-package
