---
date: 2016-09-13T11:41:49-07:00
title: "Hacker News, JSONPath, And More!"
slug: "3.4.0-changelog"
tags: ["update"]
---

Exactly one week ago Insomnia reached #1 on HackerNews, generating around
`50,000` website visits, `10,000` new users, and `200` email conversations. I
spent the week going through these conversations and implementing common
complaints, suggestions and feedback. There are a lot of exciting new features 
in this release so pay grab some popcorn and take a seat.

<!--more-->


## More Powerful JSON and XML Features 

One of the most common requests was to support XML responses. Not only does
Insomnia format XML automatically now, but you can also filter responses using
XPath and JSONPath notation.

![XPath filtering](/images/blog/xpath.png)

The editor also now has a _Beautify_ button that will automatically format the
request body for you.


## Better Keyboard Support 

Having to use the mouse is never fun, and this release allows you to use it 
even less! 

- You can now toggle the sidebar with `ctrl+\` (`cmd+\` for Mac)
- Workspaces now appear up in the _Quick Switcher_ `ctrl+p` (`cmd+p` for Mac)

![Fast workspace switching](/images/blog/switch-workspace.png)


## Advanced Templating

You can now use Nunjucks templating inside environments. This can save a lot
of repetition if used correctly. Here is a very basic example of what it could
be used for.

```json
{
  "url": "{{ base_url }}/{{ resource_type }}/{{ user_id }}",
  "base_url": "https://mysite.com",
  "resource_type": "users",
  "user_id": "user_123"
}
```

In this case, `{{ url }}` acts as a template, combining three environment
variables into a single string. With this, you can reference `{{ url }}` inside
each request instead of `{{ base_url }}/{{ resource_type }}/{{ user_id }}`. 

Complementing this, you can now generate UUIDs with the new `{% uuid %}` tag.
_(more of these generators coming soon...)_


## A Lot More

To keep this post short, here is a list of some of the more minor things that
made it into the release.

- Add button to duplicate folder
- Add confirmation step before deleting things
- _Cancel Request_ button
- Improved "Raw" response view performance
- Comments in editor are now more visible
- Reduced update check frequency from 30 minutes to 3 hours
- Renamed "Params" tab to "Query" to avoid confusion


## Fixes

Thank you to everyone who reported bugs! Here are the fixes that made it into
this release.

- Querystring is now added to generated code (oops)
- Can now re-open window via doc icon if closed (Mac)
- HTTPS proxy now works again
- Fixed minor bug with Curl import
- Global shortcuts (like sending request) are now prevented when dialogs are open
- Dragging sidebar dropdowns no longer triggers drag-n-drop


## Thanks!

Once again, thanks to everyone who reached out via email, Twitter, or other
means. I hope you enjoy the update!
