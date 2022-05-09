# syntax=docker/dockerfile:1

# This Dockerfile is intended for CI use only
# It assumes inso-linux-VERSION.tar.xz exists in /packages/insomnia-inso/artifacts
# You can run `npm run inso-package:artifacts` on a linux host OR
# `curl -LO "https://github.com/Kong/insomnia/releases/download/lib%40<version>/inso-linux-<version>.tar.xz"`

FROM docker.io/alpine:3.15.4 AS fetch

COPY ./artifacts/inso-linux-*.tar.xz /tmp/inso.tar.xz
RUN tar -C /usr/bin -xvf /tmp/inso.tar.xz

FROM docker.io/alpine:3.15.4 AS binary
COPY --chmod=+x --from=fetch /usr/bin/inso /usr/bin/inso
RUN apk add --no-cache gcompat libstdc++

ENTRYPOINT ["/usr/bin/inso"]
