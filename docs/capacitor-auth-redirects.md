# Capacitor Auth Redirects

Wardle keeps Clerk OAuth redirects in `doctordle-game/src/features/auth/authRedirects.ts`.

## Redirect Policy

- Web browser builds use the current browser origin:
  - `redirectUrl`: `<web-origin>/sso-callback`
  - `redirectUrlComplete`: `<web-origin>/`
- Capacitor native builds never derive OAuth redirects from the WebView origin (`https://localhost`).
- Production native builds should set `VITE_NATIVE_AUTH_APP_LINK_ORIGIN` to the verified HTTPS App Link origin.
- Development native builds may use `VITE_NATIVE_AUTH_CUSTOM_CALLBACK_URL`, which defaults to `app.wardle.medcase://sso-callback`.

## Clerk Dashboard

Register these allowed redirect URLs for the mobile OAuth provider:

- `https://<app-link-host>/sso-callback`
- `app.wardle.medcase://sso-callback`

Keep the web callback registered as well:

- `https://<web-host>/sso-callback`
- local dev origins such as `http://localhost:5173/sso-callback` when needed

## Android App Links

The Android manifest accepts both:

- the custom scheme fallback: `app.wardle.medcase://sso-callback`
- HTTPS App Links for the configured host

Set the Android App Link host with Gradle:

```properties
wardleAppLinkHost=your-app.example.com
```

The HTTPS host must serve a valid Digital Asset Links file at:

```text
https://<app-link-host>/.well-known/assetlinks.json
```

The same origin should be used for `VITE_NATIVE_AUTH_APP_LINK_ORIGIN`.
