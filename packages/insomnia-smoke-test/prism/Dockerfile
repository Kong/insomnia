FROM node

COPY petstore.oas3.yaml /petstore.oas3.yaml

ADD https://github.com/stoplightio/prism/releases/download/v3.3.6/prism-cli-linux prism
RUN chmod +x prism

EXPOSE 4010

CMD ["./prism", "mock", "--host", "0.0.0.0", "/petstore.oas3.yaml"]
