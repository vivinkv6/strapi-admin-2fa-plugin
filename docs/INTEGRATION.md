# Integration Guide

This guide explains how to use `strapi-2fa-admin-plugin` inside an existing Strapi 5 project.

## What The Plugin Does

The plugin provides the backend endpoints and auth logic for an OTP-based admin login flow.

It does not replace the Strapi admin login UI by itself.

Your host project must provide a login integration layer that:

1. collects admin email and password
2. calls the plugin login endpoint
3. shows an OTP input screen
4. calls the plugin verify endpoint
5. optionally allows OTP resend

## Endpoints

The plugin registers these routes:

- `POST /api/admin-2fa/login`
- `POST /api/admin-2fa/verify`
- `POST /api/admin-2fa/resend`

## Install And Enable

### Published npm package

```bash
npm install strapi-2fa-admin-plugin
```

### Local external plugin

In your Strapi app:

```ts
// config/plugins.ts
import type { Core } from "@strapi/strapi";

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Plugin => ({
  "admin-2fa": {
    enabled: true,
    resolve: "../strapi-2fa-admin-plugin",
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

## Required Host App Setup

### Email provider

The plugin calls `strapi.plugin("email").service("email").send(...)`.

Your Strapi project must configure an email provider or OTP delivery will fail.

### Proxy and HTTPS

If your project runs behind a reverse proxy, configure `config/server.ts` correctly so Strapi recognizes secure requests and admin cookies are set with the right options.

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

## Request Flow

### 1. Start login

Send admin email and password to:

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

What happens here:

- Strapi validates the admin credentials
- the plugin creates an OTP challenge
- the plugin emails the OTP
- no final admin session is created yet

### 2. Verify OTP

Send the OTP code to:

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

What happens here:

- the plugin reloads the OTP challenge
- the submitted code is hashed and compared
- the real Strapi admin session is created only after OTP verification
- the refresh cookie is set by the plugin controller

### 3. Resend OTP

Send:

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

This generates a new OTP for the same challenge and extends the expiry.

## Error Cases To Handle In The UI

Your login integration should handle these cases cleanly:

- invalid email or password
- OTP session not found
- OTP expired
- invalid OTP code
- too many authentication attempts
- maximum resend attempts exceeded

These are returned as normal Strapi error responses, so the frontend should surface the message to the admin user in a safe and friendly way.

## Recommended Frontend Behavior

- Keep login and OTP entry as two separate UI states.
- Store `challengeId` in memory for the current login attempt.
- Do not create your own session after password validation; wait for `/verify`.
- After successful OTP verification, treat the returned user/token exactly like a successful admin login.
- If resend fails due to limits or expiry, restart the login flow.

## Environment Variables

Recommended defaults:

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

## Production Notes

- Email OTP is better than password-only login, but weaker than TOTP or WebAuthn.
- If the admin mailbox is compromised, the second factor can still be bypassed.
- Use app passwords or provider-managed SMTP credentials for OTP delivery.
- Make sure your host project sets `URL` and proxy settings correctly in production.
