---
date: 2017-06-23
title: GitHub API Authentication using OAuth 2.0
slug: oauth2-github-api
tags: []
series: ["tutorial"]
---

OAuth 2.0 has been a supported authentication scheme in Insomnia for some time now but – if
you are new to OAuth – can still be quite complicated.
This post walks through an example using OAuth 2.0 to authenticate and create a 
repository on GitHub using the [GitHub API](https://developer.github.com/v3/).

<p class="notice info">
If you don't already have a GitHub OAuth application registered for your account, you can
create a one from <a href="https://github.com/settings/developers">Developer Settings</a>
Note, "Callback URL" can be whatever you want for this tutorial.
</p>

## Gathering OAuth Credentials 

The GitHub API uses the OAuth _Authorization Code_ grant type, which requires five things
from you. Note that you don't need to know what a _grant type_ is to follow along.

**Client ID**, **Client Secret**, and **Callback URL**:
: These are specific to the GitHub OAuth application and can be found on its 
  [details page](https://github.com/settings/developers). The **Callback URL** is often
  optional but we're going to specify it anyway in the name of completeness.

**Authorization URL** and **Access Token URL**:
: These are static values, listed on the [GitHub API Docs](https://developer.github.com/apps/building-integrations/setting-up-and-registering-oauth-apps/about-authorization-options-for-oauth-apps/).
  As a convenience, Insomnia will autocomplete these while you type them and I will also include
  them here: <br>
  `http://github.com/login/oauth/authorize` <br>
  `https://github.com/login/oauth/access_token`

This following step is optional, but I recommend specifying the application-specific values 
as [Environment Variables](/documentation/environment-variables/) so they can easily be reused 
or modified. For my setup, I have created a sub environment called "Test Application" and included
the following JSON value:

```json
{
	"client_id": "fa122270cdf09954296d",
	"client_secret": "274e6d43420c73d9c89f52a4a99a9731e6bdb96c",
	"redirect_url": "https://insomnia.rest"
}
```

<p class="notice warn">
Don't forget to activate your new environment in the sidebar after creating it
</p>

Now that we have everything we need, let's start setting up a request.

## Setting Up The Request

Most read-only endpoints on GitHub don't require authentication (not very useful for
demoing OAuth) so we'll be using the 
[create repository](https://developer.github.com/v3/repos/#create) endpoint for this 
demonstration. 

To get started, open Insomnia and create a new request by the name of "Create Repository". 
Then, copy and paste the following curl command into the URL bar. 

<p class="notice info">
We're making use of Insomnia's <strong>import from Curl</strong> feature here to 
save on typing.
</p>

```bash
curl --request POST \
  --url 'https://api.github.com/user/repos' \
  --header 'content-type: application/json' \
  --data '{
  "name": "insomnia-test-repo",
  "description": "Test repo for Insomnia tutorial"
}'
```

You should end up with a request that looks like this.

![Imported request](/images/blog/github-oauth/request.png)

## Setting up OAuth 2.0

If you sent the request now, before setting up authentication, you would receive a 
`401 Unauthorized` response. This is because the `POST /user/repos` endpoint requires 
an OAuth token to be sent with the request. However, obtaining an OAuth token manually is not
easy and requires multiple, complicated steps. This is where Insomnia into play. 

Insomnia deals with the complex task of obtaining and managing OAuth tokens so you don't
have to. You don't even need to understand how it works – although I still recommend you learn. 👩‍💻

Now, back to the request. Select the Auth tab of your "Create Repository" request and change 
the authentication type to "OAuth 2". After doing that, fill out the values you collected earlier.
If you made use of environment variables, it should look something like this.

![Fill out authentication settings](/images/blog/github-oauth/authentication-settings.png)

Congratulations! The request is now ready to be sent. 😄👏🤖

## Sending the Request

<p class="notice warn">
Submitting the following request will create a new repository on your GitHub account. You can
delete the respository from the GitHub website later.
</p>

As soon as you send the request, Insomnia will detect that a token has not yet been obtained and
start the authentication process. You will be prompted to sign in with your GitHub 
credentials and authorize the OAuth application to act on your behalf.

![Allow application access](/images/blog/github-oauth/authorize.png)

After logging in, the token will be extracted from the resulting URL and stored in Insomnia.
The request will then be sent using the newly acquired token. If all went well
you should see a successful `201 Created` response with information about your newly
created repository.

![Create repository response](/images/blog/github-oauth/response.png)

<p class="notice info">
Make use of Insomnia's response filtering by entering a JSONPath query such as
<code>$.owner.login</code> below the response body
</p>

## More About OAuth 2.0

Even though Insomnia handles most of the complexities of OAuth for you, there are a 
few notable things that may come in handy.

### Viewing the Authorization Header

If you take a look at the Timeline tab, you will see the `Authorization` header that
was sent with the request. The value of the header `Bearer <TOKEN>` contains the token that
Insomnia extracted during the login process. This token will also appear in the Auth
tab of the request, where you can either refetch a new token or clear the existing one.

![Timeline view](/images/blog/github-oauth/timeline.png)

### Expiring Tokens and Refresh Tokens

Some OAuth 2.0 APIs make use of expiring tokens and/or refresh tokens. If the API token
received has an expiry, Insomnia will show it at the bottom of the Auth tab. If a token expires,
Insomnia will automatically try to refresh it when the next request. You can also trigger a
refresh manually from the Auth tab.

### Other Grant Types

OAuth 2.0 defines four [grant types](https://tools.ietf.org/html/rfc6749#section-1.3) 
that can be used to fetch a token, each to facilitate different use cases. 

- Authorization Code 
- Implicit
- Resource Owner Password Credentials 
- Client Credentials

Insomnia supports all of these grant types and will take care of all the complexities so you
don't have to. 

<p class="notice warn">
OAuth 2.0 has the ability for custom grant types, but these are not 
yet supported
</p>

### Login Window Cookies

Currently, the OAuth 2.0 login window uses a single global session that is cleared on every
restart of the app. That means, if you already signed in with one GitHub account, it won't need
ask you again. However, this also means that, if you want to switch GitHub accounts, you will 
need to restart the app to clear the current session.

## Wrap-Up

There have been a significant number of users asking for help with the OAuth 2.0 process. 
Hopefully this post was able to clear up some of the more common issues around the OAuth process. 
Even if you are not interacting with the GitHub API specifically, the information covered 
here will work for most other OAuth 2.0 APIs.
