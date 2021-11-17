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
4. (Optional) Create an alias for the containerised version of `inso`, e.g. `alias inso-docker="docker run -it --rm insomnia-inso:latest"`.
5. (Optional) Try to run an `inso` command, e.g. `inso-docker help`

In order to run Insomnia specs in a container, you'll need to mount the specs folder on your most machine to a given folder on the container. Examples:

- Mounting an Insomnia git sync repository folder to a folder on the container:

```shell
cd <your-git-sync-repo-folder>

docker run -it --rm -v $(pwd):/var/temp insomnia-inso:latest run test -w /var/temp
```

- Mounting the Insomnia Application Data folder:

```shell
# On macOS:

docker run -v $HOME/Library/Application\ Support/Insomnia:/var/temp -it --rm insomnia-inso:latest run test --src /var/temp

# On Linux:
docker run -v $HOME/.config/Insomnia:/var/temp -it --rm insomnia-inso:latest run test --src /var/temp

# On Windows (using Docker for Windows and WSL):
docker run -v /mnt/c/Users/<your_username>/AppData/Roaming/Insomnia:/var/temp -it --rm insomnia-inso:latest run test --src /var/temp
```

- Mounting the folder where you keep an Insomnia v4 export:

```shell
cd <some-folder>

docker run -it --rm -v $(pwd):/var/temp insomnia-inso:latest run test -w /var/temp/Insomnia_YYYY-MM-DD.json
```
