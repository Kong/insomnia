# Insomnia

The main desktop application.

## Data fetching

- To fetch data from our APIs we use the `insomniaFetch` function. This allows us to overcome cross-origin issues and helps us to standardize the way we fetch data and also to handle errors in a centralized way.

- For real-time data fetching we use SSE (Server-Sent Events). This is a standard way to receive data from the server in real-time. The server will send a message to the client when something happens. The client will receive the message and update the data accordingly. To handle SSE we use the `insomnia-event-source://` protocol which is a custom protocol that gets handled by the app in the main process. This allows us to overcome cross-origin issues and also to handle SSE in a centralized way.

- Polling is also used to fetch data from the server. This is used when we need to fetch data periodically as SSE can sometimes fail and data can go out of sync.
The main places we use polling are:
  - Refreshing Insomnia Sync data.
  - Refreshing Git Sync data.
  - Refreshing Presence data.

> ⚠️ Using a combination of SSE and polling we can keep the data in sync and up to date but might also lead to some race conditions. For example, if we are polling for data every 5 seconds and the server sends an SSE message at the same time, the data might be out of sync for a few seconds. This is something we need to keep in mind when using SSE and polling.
