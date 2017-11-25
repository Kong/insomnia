---
date: 2016-11-16T17:04:48-08:00
title: "Secure Remote Passwords for Go"
tags: ["golang", "open source"]
---

Insomnia's cloud sync feature makes use of the
[Secure Remote Passwords](https://en.wikipedia.org/wiki/Secure_Remote_Password_protocol)
protocol to help protect the user's credentials during authentication. The folks at
Mozilla maintain a great library called 
[`node-srp`](https://github.com/mozilla/node-srp) but nothing as good existed for Go. So,
I spent a few hours to port it. 

<p style="text-align:center">
<a class="button" href="https://github.com/getinsomnia/go-srp">View go-srp on GitHub</a>
</p>
