# Sleepless

Sleepless is my personal implementation of the insomnia Rest client that supports sync via standard files that you can add to git. (Renamed so you can still have insomnia alongside this version)

## How it works

Sleepless works exactly like Insomnia. You can read the official [documentation here](Insomnia.md).

The only difference you'll see is that you'll see this new dropdown at the top. This will let you select in which folder you want to save the Sleepless database files. Normally you'll want to add those file to a git repository so that you can commit them and share them with your team!

![Sleepless screenshot](https://i.ibb.co/s2ypQjv/Screen-Shot-2019-12-23-at-11-30-37-AM.png)

Everything works the same as before but keep in mind that everything is now specific to a directory, which means different directories can observe different settings and etc.

## .gitignore

I suggest adding this to your gitignore

```
# Sleepless files that are personal to everyone
/sleepless/sleepless.CookieJar.db
/sleepless/sleepless.Settings.db
/sleepless/sleepless.RequestGroupMeta.db
/sleepless/sleepless.RequestMeta.db
/sleepless/sleepless.WorkspaceMeta.db
```
