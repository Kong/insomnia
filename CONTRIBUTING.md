# Contributing to Restless

Contributions are welcome. They should target this fork, not [Kong/insomnia](https://github.com/Kong/insomnia).
Please follow the [Kind Communication Guidelines](CODE_OF_CONDUCT.md).

## Using the issue tracker

Use [GitHub Issues](https://github.com/outmanos/restless/issues) for bugs and feature requests. Search existing
and closed issues first. Do not report bugs in this fork to Kong, or bugs in Kong's Insomnia here.

Report security problems privately, as described in the [security policy](SECURITY.md).

## Bug reports

Check that the bug still happens on the latest `develop` branch, then include:

- Steps to reproduce it
- What you expected and what happened
- Your Restless version and operating system

## Feature requests

Check the [roadmap](ROADMAP.md) first. Explain the problem you want solved, not only the solution.

Requests must fit the project's rules:

- Every core feature works offline, with no account.
- Nothing contacts a service unless the user asked for it.
- Sign-ins, AI and other outside services stay off until the user enables them.
- Plain files and standard Git stay the source of truth.

## Pull requests

Open an issue first for anything large. Keep each pull request to one change.

Before submitting, follow [Develop Restless](README.md#develop-restless) to set up, then run:

```bash
npm run lint
```

```bash
npm run type-check
```

```bash
npm test
```

Keep changes brief and match the surrounding code. Add tests for new behavior.

AI-assisted contributions are welcome if they are made in good faith and you have reviewed every change carefully by
hand. You are responsible for what you submit and must be able to explain it.

Code taken from other projects must keep its license notice. Do not use Kong's or Bruno's names or logos as branding.

By submitting a pull request, you agree to license your work under the [Apache-2.0 license](LICENSE).
