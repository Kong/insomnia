---
date: 2017-11-13
title: New Documentation Website
slug: new-documentation-website
tags: ["announcement"]
---

I'm happy to announce that there is a brand new 
[Documentation Website](https://support.insomnia.rest) for Insomnia!
The new site is built using [HelpScout](http://helpscout.com/) Knowledge Base, which was
chosen for two reasons. (1) Insomnia was already using HelpScout to manage support email, 
and (2) it solved three of the major shortcomings of the old documentation site with no extra
development effort.

<!--more-->

## Lower Maintenance Friction 📝

Creating and updating help docs on the old system was not easy. It required 
creating or editing markdown files in a text editor, syncing changes with Git, and deploying 
a new release. This meant simple things like fixing a typo could take upwards of ten minutes.
And don't even get me started on how hard it was to add screenshot images.

With the new system, all editing is done online. This makes creating, organizing, and managing 
help articles a breeze and should dramatically increase the quality of documentation in the 
future. Also, uploading screenshots is as simple as dragging or pasting an image into the editor.
  
## Better Discoverability 🔍

HelpScout's Knowledge Base tool is specifically designed for hosting documentation so it 
comes bundled with many features that help improve discoverability. The main one being search.

![Documentation Search](/images/blog/docs-search.png)

If you visit the main [insomnia.rest](https://insomnia.rest/) website, you will also notice a
help _beacon_ at the bottom-right of every page. This beacon gives the ability to quickly search 
and view help articles and provides the option to send an email if more assistance is required.

## Search Analytics 📊

With the old documentation site it was possible to tell what the most popular _existing_ 
articles were, but it was impossible to tell which help articles didn't exist yet that 
should be created. This is where search comes in. Search terms that yield no results can 
effectively be treated as a to-do list for documentation.

In fact, less than a day after launching the new documentation site, there were
many failed searches for _graphql_. So, I put together an article on
[Using GraphQL](support.insomnia.rest/article/61-graphql) in less than an hour and published it
that same day!

![Search Analytics](/images/blog/docs-analytics.png)

## Wrap-Up

It's been less than a week since the new [Documentation Website](https://support.insomnia.rest) 
has been live but it's already having a positive effect. The reduced editing friction has 
already improved the quality of articles and I already have a growing list of new articles 
that need creating. 

I hope you all enjoy the new and improved documentation site and please feel free to reach out
with any feedback or questions you may have!
