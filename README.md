# @vivinkv28/strapi-2fa-admin-plugin

`@vivinkv28/strapi-2fa-admin-plugin` is a Strapi 5 plugin that provides the backend side of an OTP-based 2FA flow for Strapi admin authentication.

This package handles:

- admin credential check
- OTP challenge generation and hashing
- OTP resend and verification
- rate limiting for login, verify, and resend
- OTP delivery through Strapi's email plugin
- final Strapi admin session creation after OTP verification

This package does **not** replace the Strapi admin login UI by itself. You still need a frontend/admin integration layer that calls the plugin endpoints.

## Documentation

- [Integration Guide](#integration-guide)
- [Architecture Guide](#architecture-guide)
- [Admin UI Integration](#admin-ui-integration)

## Endpoints

The plugin exposes these content API routes:

- `POST /api/admin-2fa/login`
- `POST /api/admin-2fa/verify`
- `POST /api/admin-2fa/resend`

See the detailed request and response flow in the `Integration Guide` section below.

## Requirements

- Strapi 5
- Node.js `20.x` or `22.x`
- A configured Strapi email provider

## Install In An Existing Strapi Project

### Option 1: Use as a published npm package

Install the package in your Strapi app:

```bash
npm install @vivinkv28/strapi-2fa-admin-plugin
```

Then enable it in your Strapi app plugin config:

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

### Option 2: Use as a local external plugin

If the plugin lives next to your Strapi app, point Strapi to it with `resolve`:

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

### 1. Configure an email provider

The plugin uses Strapi's `email` plugin to send OTP emails. Your host project must configure an email provider in `config/plugins.ts`.

### 2. Add an admin login integration layer

This plugin is backend-only. To use it for real admin login 2FA, your project must:

- intercept the normal admin login flow
- call `POST /api/admin-2fa/login`
- show an OTP input step
- call `POST /api/admin-2fa/verify`
- optionally call `POST /api/admin-2fa/resend`

The expected frontend flow, payloads, and response handling are documented in [docs/INTEGRATION.md](./docs/INTEGRATION.md).
The expected frontend flow, payloads, and response handling are documented in the `Integration Guide` and `Admin UI Integration` sections below.

## Integration Guide

This plugin is intended to be used as the backend engine for an admin OTP login flow.

The normal integration flow is:

1. collect admin email and password
2. call `POST /api/admin-2fa/login`
3. display an OTP entry screen
4. call `POST /api/admin-2fa/verify`
5. optionally call `POST /api/admin-2fa/resend`

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
- resend limit exceeded

## Admin UI Integration

This package is backend-focused. To make it usable in a real Strapi admin login flow, the host project must provide an admin-side integration.

A typical admin UI integration has two screens or states:

### 1. Credentials step

- collect email and password
- send them to `/api/admin-2fa/login`
- if successful, store `challengeId` in memory and switch the UI into OTP mode

### 2. OTP step

- collect the OTP code
- submit it to `/api/admin-2fa/verify`
- if successful, continue the normal authenticated admin flow
- provide a resend button that calls `/api/admin-2fa/resend`

### Recommended UI behavior

- keep login and OTP as separate form states
- do not create a session after password validation alone
- only treat the login as complete after `/verify` succeeds
- if resend or verify says the challenge expired, restart from the credentials step

### Current integration approach used by the example project

In the companion Strapi app used during development, the admin login UI is integrated by patching Strapi's admin login screen and auth service so they call:

- `/api/admin-2fa/login`
- `/api/admin-2fa/verify`
- `/api/admin-2fa/resend`

This plugin itself does not inject that UI automatically. That choice is left to the host app because Strapi admin login customization is more app-specific than the backend OTP engine.

## Architecture Guide

The plugin has a minimal admin entry and a backend-focused server implementation.

### Main files

```text
admin/src/index.js
server/src/index.js
server/src/routes/index.js
server/src/controllers/auth.js
server/src/services/auth.js
server/src/utils/strapi-session-auth.js
```

### Responsibilities

- `admin/src/index.js`
  Minimal admin plugin stub required by the Strapi Plugin SDK.

- `server/src/routes/index.js`
  Declares the plugin routes for login, verify, and resend.

- `server/src/controllers/auth.js`
  Reads requests, extracts client IP, delegates to the service, and sets the admin refresh cookie after successful verification.

- `server/src/services/auth.js`
  Core OTP logic: credential validation, challenge lifecycle, resend/verify rules, rate limiting, email sending, and final session creation.

- `server/src/utils/strapi-session-auth.js`
  Runtime helper that resolves Strapi's internal admin session utility needed to create the final admin session.

### Security model

- password-only login is not enough
- raw OTP values are never stored
- OTPs expire
- verify/resend/login are rate-limited
- the final Strapi admin session is created only after OTP verification

### Important limitation

This is email OTP, not TOTP or WebAuthn. It improves admin security substantially, but it is still weaker than authenticator-app or passkey-based 2FA.

If you already maintain a patched Strapi admin login screen, point it to:

- `/api/admin-2fa/login`
- `/api/admin-2fa/verify`
- `/api/admin-2fa/resend`

### 3. Ensure proxy / HTTPS settings are correct in production

If your Strapi app runs behind a proxy, make sure `config/server.ts` is configured correctly so secure admin cookies work.

Example:

```ts
// config/server.ts
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

Suggested variables for the host Strapi project:

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

## Plugin Development

Install dependencies:

```bash
npm install
```

Build the plugin:

```bash
npm run build
```

Watch during development:

```bash
npm run watch
```

Verify publishable output:

```bash
npm run verify
```

Link to a Strapi project with the SDK workflow:

```bash
npm run watch:link
```

## Publishing Checklist

Before publishing:

1. Run `npm install`
2. Run `npm run build`
3. Run `npm run verify`
4. Confirm the host Strapi app works with the built package
5. Update the package version
6. Publish with `npm publish`

## Production Notes

- Email OTP is a practical 2FA improvement, but it is weaker than TOTP or WebAuthn.
- If an attacker controls the admin email inbox, they can still complete the second factor.
- For stronger security, consider adding trusted devices, backup codes, TOTP, or passkeys in a future version.
