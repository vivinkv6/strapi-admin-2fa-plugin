# @vivinkv28/strapi-2fa-admin-plugin

`@vivinkv28/strapi-2fa-admin-plugin` is a Strapi 5 plugin that provides the backend side of an OTP-based 2FA flow for Strapi admin authentication.

## What This Plugin Handles

- admin credential validation
- OTP challenge generation and hashing
- OTP resend and verification
- rate limiting for login, verify, and resend
- OTP delivery through Strapi's email plugin
- final Strapi admin session creation after OTP verification

## Important Scope

This package is a backend/admin-auth engine.

It does **not** replace the Strapi admin login UI by itself. Your host project still needs an admin-side integration layer that:

1. collects admin email and password
2. calls the plugin login endpoint
3. shows an OTP input UI
4. calls the plugin verify endpoint
5. optionally calls the resend endpoint

## Endpoints

The plugin exposes these routes:

- `POST /api/admin-2fa/login`
- `POST /api/admin-2fa/verify`
- `POST /api/admin-2fa/resend`

## Requirements

- Strapi 5
- Node.js `20.x` or `22.x`
- a configured Strapi email provider

## Install

```bash
npm install @vivinkv28/strapi-2fa-admin-plugin
```

## Enable In A Strapi Project

Add the plugin to your Strapi app config:

```ts
// config/plugins.ts
import type { Core } from "@strapi/strapi";

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Plugin => ({
  "admin-2fa": {
    enabled: true,
    config: {
      otpDigits: env.int("ADMIN_OTP_DIGITS", 6),
      otpTtlSeconds: env.int("ADMIN_OTP_TTL_SECONDS", 300),
      maxAttempts: env.int("ADMIN_OTP_MAX_ATTEMPTS", 5),
      maxResends: env.int("ADMIN_OTP_MAX_RESENDS", 3),
      rateLimitWindowSeconds: env.int("ADMIN_OTP_RATE_LIMIT_WINDOW_SECONDS", 900),
      loginIpLimit: env.int("ADMIN_OTP_LOGIN_IP_LIMIT", 10),
      loginEmailLimit: env.int("ADMIN_OTP_LOGIN_EMAIL_LIMIT", 5),
      verifyIpLimit: env.int("ADMIN_OTP_VERIFY_IP_LIMIT", 20),
      verifyEmailLimit: env.int("ADMIN_OTP_VERIFY_EMAIL_LIMIT", 10),
      resendIpLimit: env.int("ADMIN_OTP_RESEND_IP_LIMIT", 10),
      resendEmailLimit: env.int("ADMIN_OTP_RESEND_EMAIL_LIMIT", 5),
      debugTimings: env.bool(
        "ADMIN_OTP_DEBUG_TIMINGS",
        env("NODE_ENV", "development") !== "production"
      ),
    },
  },
});

export default config;
```

## Admin UI Integration

Because this package does not inject the full login UI by itself, the host project must integrate the admin flow.

### Expected UI flow

#### 1. Credentials step

- collect email and password
- send them to `POST /api/admin-2fa/login`
- if successful, store `challengeId` and switch to OTP mode

#### 2. OTP step

- collect the OTP code
- send it to `POST /api/admin-2fa/verify`
- if successful, continue the normal authenticated admin flow
- provide a resend action that calls `POST /api/admin-2fa/resend`

### Recommended UI behavior

- keep login and OTP as separate form states
- do not treat password validation as a completed login
- complete the login only after `/verify` succeeds
- restart from the credentials step if the challenge expires

## Integration Guide

### Login request

```http
POST /api/admin-2fa/login
Content-Type: application/json
```

Example payload:

```json
{
  "email": "admin@example.com",
  "password": "super-secret-password",
  "rememberMe": true,
  "deviceId": "browser-device-id"
}
```

Example success response:

```json
{
  "data": {
    "challengeId": "0d3af6fd-b351-4d1e-bb81-2a8201d8a0f4",
    "expiresAt": "2026-04-05T18:30:00.000Z",
    "maskedEmail": "admin@example.com",
    "rememberMe": true
  }
}
```

### Verify request

```http
POST /api/admin-2fa/verify
Content-Type: application/json
```

Example payload:

```json
{
  "challengeId": "0d3af6fd-b351-4d1e-bb81-2a8201d8a0f4",
  "code": "123456"
}
```

Example success response:

```json
{
  "data": {
    "token": "<access-token>",
    "accessToken": "<access-token>",
    "user": {
      "id": 1,
      "email": "admin@example.com"
    }
  }
}
```

### Resend request

```http
POST /api/admin-2fa/resend
Content-Type: application/json
```

Example payload:

```json
{
  "challengeId": "0d3af6fd-b351-4d1e-bb81-2a8201d8a0f4"
}
```

### UI error states to handle

- invalid email or password
- OTP expired
- OTP session not found
- invalid OTP code
- too many authentication attempts
- maximum resend attempts exceeded

## Host Project Requirements

### Email provider

The plugin sends OTP emails through Strapi's email plugin, so the host project must configure an email provider.

### Proxy and HTTPS

If the project runs behind a reverse proxy, configure `config/server.ts` correctly so secure admin cookies work.

Typical example:

```ts
import type { Core } from "@strapi/strapi";

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Server => ({
  host: env("HOST", "0.0.0.0"),
  port: env.int("PORT", 1337),
  url: env("URL", "http://localhost:1337"),
  proxy: env.bool("IS_PROXIED", env("NODE_ENV", "development") === "production"),
  app: {
    keys: env.array("APP_KEYS"),
  },
});

export default config;
```

## Environment Variables

Suggested defaults:

```env
ADMIN_OTP_DIGITS=6
ADMIN_OTP_TTL_SECONDS=300
ADMIN_OTP_MAX_ATTEMPTS=5
ADMIN_OTP_MAX_RESENDS=3
ADMIN_OTP_RATE_LIMIT_WINDOW_SECONDS=900
ADMIN_OTP_LOGIN_IP_LIMIT=10
ADMIN_OTP_LOGIN_EMAIL_LIMIT=5
ADMIN_OTP_VERIFY_IP_LIMIT=20
ADMIN_OTP_VERIFY_EMAIL_LIMIT=10
ADMIN_OTP_RESEND_IP_LIMIT=10
ADMIN_OTP_RESEND_EMAIL_LIMIT=5
ADMIN_OTP_DEBUG_TIMINGS=false
```

## Code-Level Architecture

Main files:

```text
admin/src/index.js
server/src/index.js
server/src/routes/index.js
server/src/controllers/auth.js
server/src/services/auth.js
server/src/utils/strapi-session-auth.js
```

Responsibilities:

- `admin/src/index.js`
  Minimal admin plugin stub required by the Strapi Plugin SDK.

- `server/src/routes/index.js`
  Declares the login, verify, and resend routes.

- `server/src/controllers/auth.js`
  Reads the request, extracts client IP, delegates to the service, and sets the admin refresh cookie after successful OTP verification.

- `server/src/services/auth.js`
  Core OTP logic: credential validation, challenge lifecycle, resend/verify rules, rate limiting, email sending, and final session creation.

- `server/src/utils/strapi-session-auth.js`
  Runtime helper that resolves Strapi's internal admin session utility for final session creation.

## Repo Docs

If you are reading the source repository directly, deeper docs are also available in:

- `docs/INTEGRATION.md`
- `docs/ARCHITECTURE.md`

## Development

```bash
npm install
npm run build
```

Useful commands:

- `npm run build`
- `npm run watch`
- `npm run watch:link`
- `npm run verify`

## Publishing Checklist

1. run `npm install`
2. run `npm run build`
3. run `npm run verify`
4. verify the plugin in a real Strapi app
5. bump the version
6. publish with `npm publish --access public`

## Production Notes

- Email OTP is better than password-only login, but weaker than TOTP or WebAuthn.
- If the admin mailbox is compromised, the second factor can still be bypassed.
- For stronger security later, consider TOTP, backup codes, trusted devices, or passkeys.
