FROM centos:6

# Copy source files
RUN mkdir -p /insomnia
WORKDIR /insomnia
COPY . /insomnia

# Setup build volumes
VOLUME ["/insomnia/build", "/insomnia/dist"]

# Install Node.js and Git (for node deps)
RUN curl --silent --location https://rpm.nodesource.com/setup_7.x | bash - \
    && yum -y install nodejs git-all libcurl-devel

# Install deps
RUN npm install
