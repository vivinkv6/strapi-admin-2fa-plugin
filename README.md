# strapi-2fa-admin-plugin

`strapi-2fa-admin-plugin` is a Strapi 5 plugin that provides the backend side of an OTP-based 2FA flow for Strapi admin authentication.

This package handles:

- admin credential check
- OTP challenge generation and hashing
- OTP resend and verification
- rate limiting for login, verify, and resend
- OTP delivery through Strapi's email plugin
- final Strapi admin session creation after OTP verification

This package does **not** replace the Strapi admin login UI by itself. You still need a frontend/admin integration layer that calls the plugin endpoints.

## Endpoints

The plugin exposes these content API routes:

- `POST /api/admin-2fa/login`
- `POST /api/admin-2fa/verify`
- `POST /api/admin-2fa/resend`

## Requirements

- Strapi 5
- Node.js `20.x` or `22.x`
- A configured Strapi email provider

## Install In An Existing Strapi Project

### Option 1: Use as a published npm package

Install the package in your Strapi app:

```bash
npm install strapi-2fa-admin-plugin
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
