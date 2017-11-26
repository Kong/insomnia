---
date: 2016-12-06
title: Month 5 Recap – First Revenue
slug: progress-report-2
series: ["transparency"]
tags: ["company", "progress"]
---

Welcome to the recap of my **fifth month** working on Insomnia full time. In this blog series, 
I analyse interesting growth metrics and reflect on valuable lessons learned while trying to take 
Insomnia from a part-time hobby to a full-time business. My motivation for writing these posts 
is to help hold myself accountable, and also share my experience with readers 
who may be trying to do something similar.

Since publishing the first recap ([First Four Months](/blog/progress-report-1/)) I've had a
month to reflect on it, and have decided to apply a slightly different format this time.
Stats can be interesting, but they are not very useful or descriptive on their own. So, this
update will try to adhere to a more expository style. Let's get right into it then, shall we?

<!--more-->

## Growth Paralysis

Insomnia is growing, but at a snail's pace. Only **1200 new users per week** are launching the
app for the first time, and that number is not improving. Here is the same active users chart
that was shown last month with Novembers numbers added on.

![Insomnia Daily Active Users](/images/blog/dau-5.png)

I must say, looking at these analytics can be a downer at times. However, this stagnation
means that there should be at least a few key things that can be improved. Keep reading to
find out what those were.

## Loyal and Enthusiastic Users

Apart from the rather unfortunate user growth, there _are_ some positive things that can
be gleaned from the analytics data. Insomnia is sticky, and users love it. &#128522;

Insomnia has a **bounce rate of only 10%**, with **over 90% of usage coming from return 
visitors**. That's really good (I think)! 

A Low bounce rate is not the only thing to get excited about though. **Over 80 users reached
out via email in November** (more than any previous month), pushing the total conversation 
count to over 400. Feedback from these conversations has been overwhelmingly positive and 
supportive, making it one of the largest contributors to my motivation to keep going. If 
you were one of those people who has reached out, then thank you for being so kind, generous, 
and (when needed) forgiving.

Just for fun, here are a few Tweets that have caught my attention over the last week or two.

<blockquote class="twitter-tweet" data-cards="hidden"><p lang="en" dir="ltr"><a href="https://t.co/SOHeNG6N0w">https://t.co/SOHeNG6N0w</a> <br><br>Weird URL but 😍😍🙌🏻</p>&mdash; Psychedelic (@Is_Adrian_) <a href="https://twitter.com/Is_Adrian_/status/799308129984987136">November 17, 2016</a></blockquote>

<blockquote class="twitter-tweet" data-lang="en"><p lang="en" dir="ltr">Finally switched over to <a href="https://twitter.com/GetInsomnia">@GetInsomnia</a> from Postman and lovin&#39; it!</p>&mdash; Steven Follis (@steven_follis) <a href="https://twitter.com/steven_follis/status/806287609156681728">December 7, 2016</a></blockquote>

## Revenue at Last

One of the future goals from the last recap was to launch Insomnia Plus and team features. 
Unfortunately the team features did not make it into last month's release, so the 
launch was strictly announcing a $5 per month subscription that provides cloud backup and 
multi-device sync (honestly not something that most people need). But, in the spirit of 
being lean, I launched early with low expectations with hopes of getting feedback. 

On November 15th, I published a [blog post](/blog/introducing-insomnia-plus/) 
and pushed an in-app notification announcing the Plus launch.
Fast forward two weeks later to today, and Insomnia is at **$30 monthly recurring revenue** 
(MRR). It's a start, but not cause for celebration. I had reasonably low expectations 
before launch, but the result somehow undercut those by less than half. Time to try 
something else.

## Out of Beta with Version 4.0

As mentioned previously, over **400 users have now reached out** via email. These conversations
have provided me with an extraordinary amount of context, and led me to a sudden decision
part way through November. All of a sudden, I had the urge to take all the 
blockers that prevented certain groups of users from using the app, and address all of them in
one big release. I also took this opportunity to stop calling Insomnia _beta_, and
increment the version number from 3 to 4.

You can read the [announcement of 4.0](/blog/insomnia-4-announcement/) if you're curious, but
the main things that were missing for users were the inability to send
`multipart/form-data`, lack of client certificate authentication, and the manual effort required
to migrate from existing apps like Postman. Version 4.0 was an attempt to open the app to 
a larger market, so look forward to next month's recap to see what sort of impact that had.

## Lessons learned

Now for the hard earned (and partly embarrassing) lessons I've learned this month.

**People would rather donate then pay for something they don't need.**<br>
In November, more than one person reached out to say that they didn't need the sync feature, 
but still wanted to provide monetary support. I had naively expected users interested
in donating to sign up for Plus and just not use it, but apparently is some sort of
mental blocker that makes a user want to give money nothing in return, rather than pay 
for something that won't be used. 

**Too much time spent heads-down.**<br>
This is something I'm often guilty of as a software developer. It's really easy to focus on
the fun stuff like writing code and forget about the important things that actually matter, 
like growing the user base or making an income. The naive developer would say 
that a great app is easy to sell, but they would be wrong. The stats revealed at the start of
this recap directly disprove correlation between building something useful and attracting
new users. I've learnt this lesson the hard way several times in my life already, but that
doesn't seem to prevent me from falling into the same trap over and over again.

**Too many critical bugs shipped.**<br>
In the last week, I have introduced and fixed more critical bugs than ever before (sorry about that). All 
of these bugs were caused by changes in the 4.0 release, and were simply due to moving
too quickly without enough thought. Don't take this the wrong way. I am _not_ going 
to stop moving quickly, but I _am_ going to try to be more mindful during future releases. 
There's nothing worse than getting an email from someone saying that they can no longer use 
the app because an update caused it to stop working for them.

## Next Month Goals

One of the best parts about writing these recap posts is that they act as a
retrospective, which is something I don't usually get as a result of working alone.
All of the lessons I learned in November help to provide the following
well-defined goals for the December.

**Publish content once a week (at least).**<br>
In an effort to try to bump up new user growth, I'm going to put more time into releasing
high quality content. What your reading now is my first attempt at that (so let me know
your feedback). Currently, the plan is to update documentation for the added 4.0 features,
and write a few blog posts about the technology and tools that have helped
my small one-person team make such an impact.

**Launch team sync and reach $100 MRR.**<br>
Since 90% of the infrastructure for team sync already exists, this goal should be
easy (knock on wood). However, I would like to start playing the role of startup founder
a bit better and proactively reach out to users before building too much. This will add 
a considerable amount of effort.

**Start reacting to more actionable metrics**<br>
Before now, most of the metrics that I have been monitoring can be classified as
[Vanity Metrics](https://techcrunch.com/2011/07/30/vanity-metrics/). These are metrics
that look impressive, but are not really useful for decision making or planning because
they are too vague. Last month I transitioned from using Mixpanel to Google Analytics
for tracking, which provides much more powerful ways for segmenting and understanding
users. 

## Wrap Up

November was a jam-packed month, full of excitement, joy, and depression. Even though most
of the content of this recap was full of negativity and full of failure, I learnt enough to
convince me that what I'm trying to do is still an achievable goal. I have around 9 months
of runway left, so figuring out a sustainable revenue stream will need to happen soon.

If you enjoyed this post let me know, and if you want to get updated you can subscribe to
this blog series via RSS or follow [@GetInsomnia](https://twitter.com/GetInsomnia) on Twitter.
Thanks again for reading, and I hope you learned something today.
