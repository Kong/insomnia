FROM ubuntu:14.04

# Install core deps
RUN apt-get update && apt-get upgrade -y
RUN apt-get install -y \
    build-essential \
    autoconf \
    libtool \
    wget

# Build nghttp2 from source (for Curl)
RUN wget -q https://github.com/nghttp2/nghttp2/releases/download/v1.31.1/nghttp2-1.31.1.tar.gz -O ./nghttp2.tar.gz \
    && mkdir -p /src/nghttp2 \
    && tar -xvf nghttp2.tar.gz -C /src/nghttp2 --strip 1 \
    && cd /src/nghttp2 \
    && ./configure \
    && make \
    && make install \
    && ldconfig

# Build OpenSSL from source (for Curl)
RUN wget -q https://github.com/openssl/openssl/archive/OpenSSL_1_1_0h.tar.gz -O ./openssl.tar.gz \
    && mkdir -p /src/openssl /build/openssl \
    && tar -xvf openssl.tar.gz -C /src/openssl --strip 1 \
    && cd /src/openssl \
    && ./config no-shared --prefix=/build/openssl --openssldir=/build/openssl \
    && make \
    && make install \
    && ldconfig

# Build Curl from source
RUN wget -q https://github.com/curl/curl/releases/download/curl-7_59_0/curl-7.59.0.tar.gz -O ./curl.tar.gz \
    && mkdir -p /src/curl \
    && tar -xvf curl.tar.gz -C /src/curl --strip 1 \
    && cd /src/curl \
    && ./buildconf \
    && LIBS="-ldl -lpthread" CPPFLAGS="-I/build/openssl/ -I/build/openssl/include" LDFLAGS="-L/build/openssl/lib" ./configure \
        --disable-shared \
        --enable-static \
        --with-ssl \
        --with-zlib \
        --with-nghttp2 \
        --enable-ipv6 \
        --enable-unix-sockets \
    && make \
    && make install \
    && ldconfig

# Install Node
RUN wget -O- https://deb.nodesource.com/setup_8.x | bash - \
    && apt-get install -y nodejs graphicsmagick icnsutils \
    && npm install --no-save 7zip-bin-linux app-builder-bin-linux

# Setup dirs
ADD . /src/insomnia
WORKDIR /src/insomnia
VOLUME /src/insomnia/packages/insomnia-app/dist

# Install root project dependencies
RUN npm run bootstrap

# Define build command
CMD npm run app-package