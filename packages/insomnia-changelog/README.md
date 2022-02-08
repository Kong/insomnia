# Generating A Changelog

- [Generating A Changelog](#generating-a-changelog)
  - [General Principles](#general-principles)
    - [A good changelog is not a laundry-list of assorted changes](#a-good-changelog-is-not-a-laundry-list-of-assorted-changes)
    - [The script looks between two arbitrary commits](#the-script-looks-between-two-arbitrary-commits)
    - [The changelog is written when the topic is freshest](#the-changelog-is-written-when-the-topic-is-freshest)
    - [The data is sourced from GitHub PR descriptions (not titles!)](#the-data-is-sourced-from-github-pr-descriptions-not-titles)
    - [The changelog is not the responsibility of open source contributors](#the-changelog-is-not-the-responsibility-of-open-source-contributors)
    - [The changelog is a great place to show gratitude for open source contributions](#the-changelog-is-a-great-place-to-show-gratitude-for-open-source-contributions)
    - [Employees are people, too](#employees-are-people-too)
    - [The script only prints out a string](#the-script-only-prints-out-a-string)
    - [100% test coverage](#100-test-coverage)
  - [Example Usage](#example-usage)
    - [Generating a changelog](#generating-a-changelog-1)
    - [Double checking commits without changelogs](#double-checking-commits-without-changelogs)
  - [Other approaches](#other-approaches)
    - [Why not use a CHANGELOG.md?](#why-not-use-a-changelogmd)
    - [Why not write it by hand before every release?](#why-not-write-it-by-hand-before-every-release)
  - [FAQ](#faq)
    - [Help! I'm getting rate limited by GitHub!](#help-im-getting-rate-limited-by-github)

## General Principles

There are lots of ways to "do" changelogs.  The sections that follow outline some of the motivations for the way this script does it.

### A good changelog is not a laundry-list of assorted changes

A good changelog is about clear and effective communication about _changes that the changelog's audience will care about_.  To break that down:

- `changes` does not map directly to PRs or commits.  It's sometimes more, and sometimes less than one PR or one commit that constitutes a single change.  If we couple one to the other, then we miss important nuiance about what makes for a good changelog.
- `the changelog's audience` is not identical to "people developing the project" for almost any changelog.  In this way, it makes sense to keep concerns separated.
- What a reader will `care about` is variable, but we _can_ say generally that a general open source contributor is **not** well prepared to answer this question.

### The script looks between two arbitrary commits

You use the script by passing it two git refs.  This can be a branch name, a tag, a commit hash, `HEAD` etc.

This ensures that you can generate the changelog at any moment.

### The changelog is written when the topic is freshest

The individual changelog line for an individual piece of work is written at the moment it's freshest in a committer's or reviewer's mind: during the PR review process.

### The data is sourced from GitHub PR descriptions (not titles!)

This script generates a changelog for a range of commits.

The main idea behind this script is that it sources information _from the pull request_.

> **Q**: But what about when there _was_ no pull request, such as an emergency hotfix or something of that sort?
>
> **A**: There's support for exactly the same functionality as in pull requests if you add your changelog entry to a commit message (in a new line).*
>
> *Note: This is not special-cased for commits without a PR, in fact all commits messages will be searched for a changelog entry.  For a given commit, if there is a PR attached and that PR that _also_ has a commit message, the PR will win and the message from the commit will be discarded.

The data is sourced from the PR _description_ because it can be changed later.  This is a huge benefit because it means that any contributor will be able to change the changelog entry at any time, including after the PR has merged.  This is because contributors on a repo have the ability to update PR descriptions (and, only the descriptions) of all PRs.

If you have a series of 3 PRs that should make just one changelog entry, no problem, just add the changelog to the last one (i.e. the one that completes the project which you want to announce to users in the changelog).

### The changelog is not the responsibility of open source contributors

As established above, the changelog is a communication tool between the producers/maintainers of a product and that product's end-users.  Open source contributors should not have the responsibility of knowing how the maintainers of a project want to phrase communication with end-users.  The contributor's focus should be allowed to stay on the PR.  We should not be forcing users to learn our changelog conventions _in addition_ to everything else needed to make their PR.

### The changelog is a great place to show gratitude for open source contributions

Simple as that: having a script makes it super easy to add lines like

```text
A big thanks to the 10 contributors who made this release possible. Here are some highlights ✨:
```

and

```text
All contributors of this release in alphabetical order: @develohpanda, @dimitropoulos, @falondarville, @gatzjames, @jackkav, @JasonCubic, @johnwchadwick, @ttyS0e, @vincendep, @Wils
```

to the changelogs without any burden of keeping this information "in sync" as the changelog is being written (i.e. forgetting to add up correctly or forgetting to add/thank people).

### Employees are people, too

Some projects do not include employees in "thank you" lists of the sort shown above.  One way of looking at it is that doing so would take away from the focus on open source contributors.  This script doesn't work this way: it shows gratitude for all contributions equally, regardless of place of employment.

### The script only prints out a string

Aside from API calls (such as, to GitHub) to gather information, this script will not push anything anywhere or publish anything.  It has the responsibility of generating the changelog and _nothing_ more.  If there's more work to do (such as publishing to a website) then do not extend this script, write another script that has that responsibility and call this one as a dependency.

### 100% test coverage

If you have specific questions about the functionality, you should be able to read the tests and view all intended behaviors of the software.

Wanna know if it's case sensitive?  Look at the tests.

Wanna see what it would do in a certain scenario?  Write a new test.

## Example Usage

### Generating a changelog

1. Tell the script about your GitHub token with the standard `GITHUB_TOKEN` environment variable, or via the `--githubToken` command line argument.  The token can be generated in your [GitHub Token Settings](https://github.com/settings/tokens), and needs `public_repo` permissions.
1. Run the script (from this package):

    ```console
    npm run start -- --base="core@2021.7.2" --head="core@2022.1.0" --releaseName="core@2022.1.0"
    ```

- `--base` is the oldest git ref you'd like the tool to search from, inclusively.
- `--head` is the newest git ref you'd like the tool to search to, inclusively.
- `--releaseName` will be used in the header as the name of the release.

### Double checking commits without changelogs

Do you have this sinking feeling that there's some PR that was simply missed at some stage during review and doesn't have a changelog?  Don't worry, this script's _got you covered_.

Run the same thing as above, but just add `--onlyShowMissing`, e.g.:

```console
npm run start -- --base core@2021.7.2 --head core@2022.1.0 --releaseName core@2022.1.0 --onlyShowMissing
```

Adding that flag will look at the same commits as before, but will instead show you all the commits that do _not_ have a changelog entry.  That way, you can click through the PRs and just verify that nothing important was missed.

If you find a PR that was missed, you simply edit the PR description to include a changelog line (like normal) and run the script again.  Presto-changeo!  All fixed.

## Other approaches

### Why not use a CHANGELOG.md?

This forces a few undesirable things.  Say, for example you have a PR that merges with some change

Anyone that has worked on a codebase that does this can probably tell you what a nightmare it can be to hit "Merge" on a PR only to, seconds later, realize there's a typo in the changelog entry that you didn't see until after merging.  Then, you'd have to submit a new PR and go through the entire CI/CD process to get that typo fix changed.

Is that more strict?  Yes.  If you like that kind of approach, this tool is not for you.

This tool tries to find the _path of least resistance_ for generating quality changelogs.  Even if you see a problem in the changelog entry in a PR _before_ it merges, you'd still often have to wait through the whole CI process to get that typo changed: even though you know the code hasn't changed.

### Why not write it by hand before every release?

1. Not possible if we're going to meet the goal of releasing a changelog at any arbitrary point in time (i.e. if doing continuous development).
1. No ability to review the current state of the changelog.  With this script, a member of the team focused on documentation (or someone focused on marketing, or someone product focused, perhaps) can run the script every morning, for example, and stay aware of which changes appeared in the changelog over the last day.
1. There's no review process for doing such a thing.  If we build it into our PR review process, then it's done right there in the review process when the information is freshest in the reviewer's mind.

## FAQ

### Help! I'm getting rate limited by GitHub!

Just wait a minute or two and try again, it has been our experience that if you quickly run the script in quick succession this can happen, but otherwise it can run once just fine.  File a GitHub issue if you still have trouble after waiting.
