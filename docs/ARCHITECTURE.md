# Architecture Guide

This guide explains the internal structure of `strapi-2fa-admin-plugin` for maintainers and contributors.

## High-Level Design

The plugin is a backend-focused Strapi 5 plugin with a minimal admin stub.

Its responsibilities are:

- validate Strapi admin credentials
- create a temporary OTP challenge
- send an OTP by email
- verify the OTP
- create the final Strapi admin session only after OTP verification

Its non-responsibilities are:

- replacing the Strapi admin login UI
- rendering a custom OTP page inside the admin by itself

## Folder Structure

```text
admin/src/index.js
server/src/index.js
server/src/routes/index.js
server/src/controllers/auth.js
server/src/services/auth.js
server/src/utils/strapi-session-auth.js
```

## Entry Points

### `admin/src/index.js`

This is a minimal admin-side plugin entry required by the Strapi Plugin SDK.

Right now it only provides:

- `register()`
- `bootstrap()`
- `registerTrads()`

It does not add real admin UI behavior.

### `server/src/index.js`

This is the server-side plugin entry. It wires together:

- controllers
- routes
- services

## Routes

Defined in [`server/src/routes/index.js`](../server/src/routes/index.js).

The plugin registers a `content-api` router with these logical paths:

- `/login`
- `/verify`
- `/resend`

Because Strapi prefixes plugin content-api routes with the plugin name, these become:

- `/api/admin-2fa/login`
- `/api/admin-2fa/verify`
- `/api/admin-2fa/resend`

## Controller Layer

Defined in [`server/src/controllers/auth.js`](../server/src/controllers/auth.js).

The controller is intentionally thin:

- reads request body
- reads client IP from proxy-aware request headers
- calls the auth service
- sets the Strapi admin refresh cookie after successful OTP verification
- returns response data in Strapi-style `{ data: ... }` format

### Client IP handling

The controller checks:

1. `x-forwarded-for`
2. `ctx.request.ip`
3. `ctx.ip`

This is important because the service rate-limits by IP.

## Service Layer

Defined in [`server/src/services/auth.js`](../server/src/services/auth.js).

This is the core of the plugin.

### Main responsibilities

- read plugin config from `strapi.config.get("plugin::admin-2fa")`
- normalize and validate request input
- call `strapi.service("admin::auth").checkCredentials(...)`
- generate OTP codes
- hash OTP values with `crypto.scrypt`
- store challenge state in `strapi.store`
- enforce resend/verify/login rate limits
- send OTP email using Strapi email plugin
- create the final Strapi admin session after OTP verification

### Important internal helpers

#### `getPluginConfig()`

Builds the runtime configuration using plugin config values with defaults.

#### `createOtpCode()`

Generates a numeric OTP code with configurable length.

#### `createOtpHash()`

Hashes the OTP using:

- `challengeId`
- `code`
- random `salt`

The raw OTP is never stored.

#### `registerRateLimitHit()`

Stores rate-limit counters in `strapi.store`.

Rate-limit keys are hashed with SHA-256 so raw identifiers are not used directly as store keys.

#### `createSession()`

Uses Strapi's internal admin session helpers to generate:

- refresh token
- cookie options
- access token
- sanitized admin user

## Challenge Storage

The plugin uses `strapi.store()` with:

- type: `plugin`
- name: `admin-otp-login`

This is used for:

- OTP challenges
- rate-limit entries

This keeps OTP state internal to Strapi rather than creating a public collection type.

## Session Helper

Defined in [`server/src/utils/strapi-session-auth.js`](../server/src/utils/strapi-session-auth.js).

Strapi does not expose the needed admin session helper directly as a simple public import for this use case, so the plugin resolves the installed Strapi admin `session-auth.js` helper at runtime.

This is one of the more sensitive parts of the implementation because it depends on Strapi internal package layout.

## Security Model

### Good properties

- password alone does not create a final admin session
- OTP is hashed, not stored in plain text
- OTPs expire
- resend attempts are limited
- verify attempts are limited
- login/verify/resend rate limits exist

### Limitations

- this is email OTP, not TOTP or WebAuthn
- if the admin email account is compromised, the second factor can still be bypassed
- session creation still depends on Strapi internal admin session utilities

## Extension Points

If you want to extend this plugin later, common directions are:

- customizable email templates
- audit logging
- backup codes
- trusted devices
- TOTP support
- WebAuthn/passkeys

## Integration Boundary

The clean boundary is:

- plugin: backend 2FA engine
- host app: admin login UI interception and OTP screen behavior

That split is intentional and should stay explicit in docs and versioning.
