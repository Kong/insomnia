# Git Repo Fixtures

In order to emulate a remote git repository for testing purposes, we use the [git-http-mock-server](https://github.com/isomorphic-git/git-http-mock-server) package.

To create a new example repository in the current directory, run:

```sh
git init --bare my-git-repo.git
```

This creates a bare repository without a working directory.
