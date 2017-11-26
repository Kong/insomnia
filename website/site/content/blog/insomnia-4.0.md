---
date: 2016-12-01
title: "Insomnia 4.0 – Out of Beta at Last!"
slug: insomnia-4-announcement
tags: ["update", "announcement"]
---

**Version 4 brings multipart support, response history, performance, and more!**

The number 3 just wasn't big enough to contain all the awesome stuff in this
release, so it's been bumped to **4.0**! This version fills in all of the major
usability gaps that I've noticed from talking to over 400 users since the initial
beta launch over four months ago. Keep reading to see what's new.

<!--more-->

![Puppy Surprise](https://media.giphy.com/media/t0TNY68t8wq2Y/giphy.gif)

## Multipart Form Data and Binary File Support

The ability to send multipart form data with requests has been the
most requested feature since launch (by far). You can now
change the body type to `Form Data` or to start using it.

<img alt="Insomnia Multipart Form Data" src="/images/blog/multipart.png" class="small" />

You can also now send raw files with requests. This can be useful for images
and attachments, but it's also helpful for sending large JSON or XML bodies
instead of pasting them into the body editor.

<img alt="Insomnia Binary Files" src="/images/blog/binaryfile.png" class="small" />

## History Viewer

Every request now keeps track of it's past responses so you can go back later and
see exactly what happened.

<img alt="Insomnia Response History" src="/images/blog/history.png" class="small" />

## Client Certificates

Client certificates can now be used to authenticate requests. Import your own `PFX`, 
`PKCS12`, or `PEM` certificates into the workspace settings screen and Insomnia
will automatically send these for the specified host.

![Insomnia Client Certificates](/images/blog/certificates.png)

## More Import Formats

Getting data into Insomnia has been a pain point for a lot of users, and has
prevented some from from even trying the app.

To help alleviate this pain, Insomnia 4 now supports **Postman (v2)**, **HTTP Archive (HAR)**, 
and **Curl command** import formats. And, if your format still isn't supported, you can help add your own 
importer by contributing to the 
[importers project on GitHub](https://github.com/getinsomnia/importers).

HAR support means that you can now **export requests from the Chrome developer tools** right
into Insomnia.

<img alt="Insomnia HAR Export" src="/images/blog/har.png" class="small" />


## Advanced Sending Options

Holding down `Ctrl` (`Cmd` on Mac), will now reveal extra sending options, including 
the ability to send a request after a delay or on a set interval.

<img alt="Insomnia Advanced Sending" src="/images/blog/advanced-send.png" class="small" />

## Toggleable Everything!

Query parameters, headers, form data, authentication, and client certificates can now 
be toggled on or off. _Toggling something off will behave the same as if it was deleted
entirely_.

## Performance Improvements

This release includes performance improvements to the interface. Everything you do in
the app should now be noticeably faster, especially if you have a lot of requests. Enjoy!

![F-Zero](https://media.giphy.com/media/h41bl4ZNk276w/giphy.gif)

## Thanks for The Support!

I've said it before, but I'll say it again. It's been amazing to be able to interact
with so many of you, and I hope we can keep this going. Each conversation 
provides more context to help make Insomnia a better tool for everyone, so thanks! 

~ Gregory
