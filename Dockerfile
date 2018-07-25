FROM ubuntu:16.04

# Install core deps
RUN apt-get update && apt-get upgrade -y
RUN apt-get install -y \
    build-essential \
    autoconf \
    libtool \
    pkg-config \
    snapcraft \
    wget

# Install Node and app-related dependencies
RUN wget -O- https://deb.nodesource.com/setup_8.x | bash - \
    && apt-get install -y nodejs graphicsmagick icnsutils

# Build zlib from source (for Curl)
RUN wget -q https://github.com/madler/zlib/archive/v1.2.11.tar.gz -O ./zlib.tar.gz \
    && mkdir -p /src/zlib /build/zlib \
    && tar -xvf zlib.tar.gz -C /src/zlib --strip 1 \
    && cd /src/zlib \
    && ./configure --prefix=/build/zlib \
    && make \
    && make install \
    && ldconfig

# Build OpenSSL from source (for Curl)
RUN wget -q https://github.com/openssl/openssl/archive/OpenSSL_1_1_0h.tar.gz -O ./openssl.tar.gz \
    && mkdir -p /src/openssl /build/openssl \
    && tar -xvf openssl.tar.gz -C /src/openssl --strip 1 \
    && cd /src/openssl \
    && ./config no-shared --static --prefix=/build/openssl --openssldir=/build/openssl \
    && make \
    && make install \
    && ldconfig

# Build nghttp2 from source (for Curl)
RUN wget -q https://github.com/nghttp2/nghttp2/releases/download/v1.31.1/nghttp2-1.31.1.tar.gz -O ./nghttp2.tar.gz \
    && mkdir -p /src/nghttp2 /build/nghttp2 \
    && tar -xvf nghttp2.tar.gz -C /src/nghttp2 --strip 1 \
    && cd /src/nghttp2 \
    && CFLAGS="-fPIC" ./configure --enable-lib-only --disable-shared --prefix=/build/nghttp2 \
    && make \
    && make install \
    && ldconfig

# Build Curl from source
RUN wget -q https://github.com/curl/curl/releases/download/curl-7_59_0/curl-7.59.0.tar.gz -O ./curl.tar.gz \
    && mkdir -p /src/curl \
    && tar -xvf curl.tar.gz -C /src/curl --strip 1 \
    && cd /src/curl \
    && ./buildconf \
    && LIBS="-ldl" CPPFLAGS="-I/build/openssl/include" LDFLAGS="-L/build/openssl/lib" \
        ./configure \
            --disable-shared \
            --enable-static \
            --with-ssl=/build/openssl \
            --with-nghttp2=/build/nghttp2 \
            --with-zlib=/build/zlib \
            --enable-ipv6 \
            --enable-unix-sockets \
    && make \
    && make install \
    && ldconfig \
    && curl --version

# Setup dirs
ADD . /src/insomnia
WORKDIR /src/insomnia
VOLUME /src/insomnia/packages/insomnia-app/dist
ENV NODELIBCURL_BUILD_STATIC=yes

# Install root project dependencies
RUN npm run bootstrap \
    && npm install --no-save 7zip-bin-linux app-builder-bin-linux

# Define build command
CMD npm run app-package