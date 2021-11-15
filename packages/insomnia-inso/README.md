<!-- markdownlint-disable heading-style first-line-h1 -->
<!-- markdownlint-disable no-inline-html  -->
<div align="center">
  <br />
  <br />
  <img src="https://raw.githubusercontent.com/Kong/insomnia/develop/packages/insomnia-inso/assets/logo.svg" alt=""/>
  <h1>
    Inso CLI
    <br />
    <br />
  </h1>
  <h3>A CLI for <a href="https://insomnia.rest">Insomnia</a></h3>
  <pre>npm install --global <a href="https://www.npmjs.com/package/insomnia-inso">insomnia-inso</a></pre>
  <img src="https://raw.githubusercontent.com/Kong/insomnia/develop/packages/insomnia-inso/assets/demo.gif" alt=""/>
  <br />
</div>
<br />
<!-- markdownlint-enable no-inline-html  -->

## Documentation

See the [open-source Inso CLI documentation](https://docs.insomnia.rest/inso-cli/introduction).

## Development

- Bootstrap: `npm run bootstrap`
- Start the compiler in watch mode: `npm run start`
- Run: `./bin/inso -v`

## Run with Docker

> Note: this feature is still experimental / in active development.

1. Clone the repository.
2. Install [Docker](https://docs.docker.com/get-docker/).
3. Run `docker build -t insomnia-inso:latest -f inso.Dockerfile .`.
4. Create an alias for the containerised version of `inso`, e.g. `alias inso-docker="docker run -it --rm insomnia-inso:latest`.
5. Try to run an `inso` command, e.g. `inso-docker help`
