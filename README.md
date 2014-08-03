River streaming twitter client
=====

Front-end for https://deny.io/river



What
-----
Javascript/NodeJS streaming twitter client using socket.io

Supports
* Live stream of twitter feed
* Writing new tweets
* Replying to tweets (through external link)
* Retweets (viewing)
* Deleted tweets
* Inline images
* Responsive resizing based on viewport

In-progress
* Twitter stream from specific keyword

Planned
* Options
* Reply clustering
* Multi-line tweet formatting
* Page personalization based on logged in user
* Logins from multiple locations at the same time
* HDTV display format
* Secure requests with HMAC


Options
--------
These can currently be found in localStorage in your browser:

* warcode.river.user.maxtweets = 300 (Purges old messages over limit. Increase only if your browser can handle it.)
* warcode.river.user.keyword = keyword (Makes river use a keyword stream. Currently does nothing if you have already started a userstream.)