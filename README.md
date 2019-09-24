# Kong Studio

[![Travis](https://api.travis-ci.org/kong/studio.svg)](https://travis-ci.org/kong/studio)
[![license](https://img.shields.io/github/license/mashape/apistatus.svg)](https://github.com/kong/studio/master/LICENSE)

Studio is a spec-first API development app built in top of [Insomnia](https://github.com/getinsomnia/insomnia).

![Kong Studio Screenshot](https://user-images.githubusercontent.com/587576/62305922-dbd30800-b44e-11e9-8de6-ea8bdcb8d93b.png)

## Development

```shell
npm run bootstrap
npm run app-start
```

## Creating Releases

1. Bump version number in `packages/insomnia-app/package.json` `app.version` property.
2. Commit changes into Git
3. Create git tag to match version `git tag v1.0.0`
4. Push tags `git push --tags`
5. GitHub action will automatically on tags and test/build/package the app into a
   [GitHub Release](https://github.com/kong/studio/releases/)
