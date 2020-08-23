FROM stoplight/prism

COPY petstore.oas3.yaml /petstore.oas3.yaml

EXPOSE 4010

CMD ["prism", "mock", "/petstore.oas3.yaml"]