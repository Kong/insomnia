---
date: 2017-03-07
title: February Recap – 192% MRR Growth
slug: progress-report-5
series: ["transparency"]
tags: ["company", "progress"]
---

February was an exciting month for Insomnia with **monthly recurring revenue growing 
192%** and **monthly active users growing 14%**. Considering how little time (none) was put into
marketing and promotion, that's really exciting. 

<!--more-->

Since most of February was spent on feature development, there wasn't much to reflect on for 
this post. So, on top of the usual stats, I'll be doing a deep-dive on some things
I did to help understand where exactly the growth is coming from.

Spoiler alert: It's interesting!

_If you like this post, be sure to check out [the other recaps](/series/transparency/). 
There's one every month!_

## February Metrics Overview

Since February is a short month, metrics were slightly lower than usual, but still great.

| Metric                    | Value This Month | Change  | Reaction   |
| ------------------------- | ---------------- | ------- | ---------- |
| Active App Users          | 18,422           | +14%    | &#x1f60a;  |        
| New App Users             | 7,872            | +4%     | &#x1f60a;  |
| Monthly Recurring Revenue | $322             | +192%   | &#x1f601;  |
| Recognized Revenue        | $614             | +57%    | &#x1f601;  |
| New Trial Customers       | 224              | +53%    | &#x1f600;  |
| New Paying Customers      | 20               | +81%    | &#x1f600;  |
| Churned Customers         | 0                | 0%      | &#x1f60a;  |
| Trial Conversion Rate     | 9%               | +12%    | &#x1f60a;  |

I'm really happy with where things are at. It's satisfying to have active users
continue to grow, while also maintaining an increasing conversion rate. 

The following chart does a better job showcasing recent growth.

![Insomnia Daily Active Users February 2017](/images/blog/dau-8.png)

And the same thing for revenue.

![Insomnia Monthly Recurring Revenue February 2017](/images/blog/mrr-8.png)

MRR grew a lot in February – **jumping from $110 to $322** – with a large portion coming
from new team subscriptions. The number of team subscription is still in the single digits, but
it's exciting considering the feature's lack of visibility. (Definitely something to
focus on in the future.)

### Where is The Money Coming From?

A few weeks ago, I decided to figure out whether subscriptions were coming from existing users
or new users. This question had been on my mind for a while and knowing the answer is 
critical for calculating long-term revenue forecasts.

For example, if only new users are upgrading, the conversion rate is effectively
`subscriptions / ~15,000 new users`. If the opposite is true, the conversion rate decreases
dramatically due to the much larger pool and becomes `subscriptions / ~40,000 total new users`. 

The best-case scenario is that only new users have upgraded and existing users don't even know the
paid plans exist. This scenario would put the conversion rate at 0.3% and also present the 
opportunity to increase it by targeting existing users. 

If the opposite is true, the conversion rate drops to 0.1% with no opportunities to
improve. Luckily (thanks to some foresight early on) I was able to collect enough data 
to answer this question. 

Every ten minutes, the app pings the server for notifications and sends the following information:

- App version and platform
- **Number of launches, first launch**, and last launch
- Number of entities (workspaces, environments, folders, and requests)
- Current session (if logged in)

I wrote some code to start storing this information on the user object and looked at the data 
couple weeks later. Here are the most interesting things I found:

- **50% of paid customers started using the app in the last two months**
- paid customers have launched the app 24 times on average
- All team customers have launched the app fewer than 20 times
- Paid customers consist of 43% Mac, 37% Windows, 20% Linux

This data shows a large portion of the customer base coming from new users, putting the
effective conversion rate around 0.2%. Extrapolating average monthly customer revenue ($8.29), 
Insomnia would need 125,000 new users to reach $2,000 MRR (sustainability) and
600,000 new users to reach $10,000 MRR (goal). Assuming the current growth rate of 20% 
remains constant, it should take **7 months to reach sustainability** and 14 months to reach 
goal MRR. 

Last month I attempted a similar revenue forecast using a different set of data, but came to a
similar conclusion. The fact that both calculations produced similar results drastically 
increases my confidence of success, which is extremely motivating.

## No More Goals!

**I've had enough with goals**, so I'm not doing them anymore! Every month I come up 
with 3-5 high level goals and fail to meet almost all of them. 

I _will_, however, say that something big is coming. I can't give an exact release date yet, 
but I hope to do a version 5.0 launch within the next month. The goal of version 5.0 is to
add a couple major features that have prevented certain major use cases, as well as sand 
off some of the rough edges I've noticed from talking to users.

## Wrap Up

Well, another great month has come and gone. I'm super excited about how things are going, and can't
wait to get this new release into users' hands. Next month should be awesome!

As always, let me know if you have any feedback or thoughts, and enjoy the app!
