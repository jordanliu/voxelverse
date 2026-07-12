# Anonymous ownership

## Publish

1. Client POSTs scene + metadata to `/api/models`.
2. Server generates a high-entropy `edit_key` and stores only `edit_key_hash`.
3. Response returns `public_id`, `public_url`, and the raw `edit_key` **once**.
4. Browser stores ownership in IndexedDB and offers recovery download.

## Edit URL

Private edit links use the URL fragment so the key is not sent as a normal query string:

```text
/editor/{publicId}#key={editKey}
```

Mutating API calls send `edit_key` in the JSON body (or `X-Edit-Key` on delete).

## Rules

- Public responses never include `edit_key` or `edit_key_hash`.
- Application logs must not record raw edit keys or raw device ids.
- Lost anonymous credentials cannot be recovered by the server.
- Anyone with the private edit link is treated as an owner.

## Ratings identity

A random `device_id` is stored locally. The server derives:

```text
HMAC-SHA256(device_id | public_id, APP_KEY)
```

Only the hash is stored on ratings/reports.
