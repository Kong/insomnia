---
date: 2017-08-09
title: Introducing GraphQL Support!
slug: introducing-graphql
tags: ["feature"]
---

Starting in version [5.7.0](/changelog/5.7.0/), you can now interact with a
[GraphQL](http://graphql.org/) server just the same as any other HTTP request inside
Insomnia 🤗!

[![GraphQL Screenshot](/images/blog/graphql.png)](/images/blog/graphql.png)

Along with defining and sending queries, the GraphQL integration also provides the 
following benefits:

- Autocomplete for field names, variables, and types
  - _Schema is fetched automatically by sending an introspection query to the same URL_
- Linting with friendly error messages
- Vertical split view for editing GraphQL variables
- Integration with all existing Insomnia features
  
**Special Thanks: 🍻**<br>
I'd like to give a huge thanks to the brilliant folks responsible for developing the
[Codemirror GraphQL plugin](https://github.com/graphql/codemirror-graphql), which powers
linting, error messages, autocomplete, and syntax highlighting. Without it, this feature 
would have taken A LOT more work.

