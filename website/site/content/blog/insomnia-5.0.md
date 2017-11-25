---
date: 2017-04-05
title: Insomnia 5.0 – The Biggest Release Yet!
slug: insomnia-5-announcement
tags: ["update", "announcement"]
---

**TL;DR – This update brings contextual autocomplete, more authentication types, and 
better debugging!** &#128079;

It's been over a month since the last release but version 5.0 is finally here! 
So, find a chair, take a seat, and brace yourself for what's about to come.

<!--more-->

![Excited dog sitting](https://media.giphy.com/media/grjSZjbnxudq0/giphy.gif)

Now that you're prepared, let's dive into the new stuff.

## Autocomplete, Everywhere &#128640;

By far the biggest feature of 5.0 is the introduction of autocomplete. Now, just 
like your favourite code editor, Insomnia will suggest completions for common things 
like variable names, URLs, HTTP headers, and template tags. 

<img title="Insomnia Autocomplete" src="/images/blog/version-5/autocomplete.gif" class="small" />

## Rendering Errors and Debugging &#128680;

The new autocomplete system involved making some core changes to the rendering pipeline so, 
while that was happening, I spent some time improving the user experience around render 
errors.

The app now displays errors inline *before* the request is sent. That's right! No more 
wondering whether or not you typed in your variable name correctly. &#128526;

<img title="Better error reporting" src="/images/blog/version-5/render-errors.png" class="small" />
 
Besides better error reporting, the debug experience is also improved. Insomnia can now
render previews on hover, and also now provides and interactive variable editor for even
more control.

<img title="Insomnia Render Error" src="/images/blog/version-5/variable-error.gif" class="small" />

## New `libcurl` Network Backend and Timeline &#127959; 

[Curl](https://curl.haxx.se/) is one of the most popular and feature-rich HTTP clients in 
the world and its command-line interface is often used for debugging and testing of APIs – 
making it a perfect fit for powering Insomnia's network stack. 

Every network request made through Insomnia will now be sent using the `libcurl` C API.
Using Curl not only improves Insomnia's reliability, but it also makes it possible to 
implement more advanced features like network throttling and download progress in the future
(coming soon). 

Thanks to `libcurl`, there is a new _Timeline_ view that shows a debug log similar to the 
output when using Curl's `--verbose` flag. This is extremely valuable for debugging
network problems when it's not clear exactly what's going wrong.

<img title="Timeline Debugging View" src="/images/blog/version-5/curl.png" class="small" />

I would like to give a huge thanks to the maintainer of 
[`node-libcurl`](https://github.com/JCMais/node-libcurl/). Without this project, integrating
Curl into Insomnia would have taken a lot more work.

## OAuth 2.0, Digest, and NTLM Authentication &#128272;

OAuth 2.0 is an extremely popular authentication mechanism, meaning Insomnia can now 
easily interact with many popular APIs like GitHub, Dropbox, Facebook, and Google. Simply
fill out a few OAuth 2.0 parameters and Insomnia will take care of user authentication,
generation of the `Authorization` header, and renewing refresh tokens when needed.

_Insomnia supports all four OAuth 2.0 grant types so it should be able to handle anything
you throw at it._

![Insomnia OAuth 2.0 Demo](/images/blog/version-5/dropbox.gif)

Along with OAuth 2.0, Insomnia now supports both 
[Digest](https://en.wikipedia.org/wiki/Digest_access_authentication) and 
[NTLM (Windows)](https://msdn.microsoft.com/en-us/library/windows/desktop/aa378749(v=vs.85).aspx) 
authentication.

## Sortable Key-Value Editors &#9994;

If you like dragons, you'll love the new drag-n-drop sorting of Insomnia's key-value fields.
Satisfy your inner perfectionist and sort your headers, query parameters, and form data whatever 
way you want!

<img title="Insomnia Autocomplete" src="/images/blog/version-5/sort.gif" class="small" />

_Alright, this one isn't that exciting, but it was so heavily requested that it made sense 
to talk about it in this post._

## So Much More &#127813;&#127815;&#127817;&#127820;&#127827;

There is so much more that didn't make it into this post that I know you'll love.
If you're curious you can view the full [release notes](/changelog/5.0.1/), but here's
a summary of the most notable ones missed:

  - Environment variables and template tags now highlighted throughout the app
  - Added per-request settings for controlling cookies, rendering, and URL encoding
  - Digest and NTLM authentication now supported in proxy
  - Custom HTTP methods now supported
  - App panes now resizable when in vertical layout
  - Response view types have been reworked to behave more intuitively

## Thanks for the Support! &#127867;

Almost all of the changes in version 5 are a direct result of the 
hundreds of email conversations I've had with users over the past year so "**thank you!**"
and keep them email coming! &#128140;

Also, if you'd like to help support future development and get bonus features like 
cloud sync, check out [Insomnia Plus](/pricing).

<span class="text-lg">&#127939;&#128168;</span> Time to get started on the next big thing...

~ Gregory
