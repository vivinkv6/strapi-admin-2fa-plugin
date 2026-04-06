# @vivinkv28/strapi-2fa-admin-plugin

`@vivinkv28/strapi-2fa-admin-plugin` is a Strapi 5 plugin that adds the backend side of an OTP-based admin login flow.

It gives your Strapi project:

- admin credential validation before OTP
- OTP challenge creation
- OTP resend and verification
- rate limiting for login, verify, and resend
- OTP delivery through Strapi's email plugin
- final Strapi admin session creation only after OTP verification

## What This Package Is

This package is a **backend/admin-auth plugin**.

It does **not** automatically replace the default Strapi admin login UI.

To use it in a real project, you need two parts:

1. this plugin for the backend OTP/auth logic
2. an admin login screen integration in your Strapi project that calls the plugin endpoints

That means this package is ideal if you want:

- a reusable backend OTP engine
- control over how the admin login UI looks
- a project-level patch/customization for the Strapi admin login page

## Endpoints

After installation, the plugin exposes:

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

## Step 1: Enable The Plugin

In your Strapi project, update `config/plugins.ts`:

```ts
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

## Step 2: Configure Email

This plugin sends OTP emails through Strapi's email plugin.

Your project must have a working email provider configuration in `config/plugins.ts`.

If email is not configured, login will fail when OTP delivery is attempted.

## Step 3: Make Sure Server/Proxy Settings Are Correct

If your Strapi app runs behind a proxy, configure `config/server.ts` correctly so admin cookies work as expected.

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

## Step 4: Add Admin Login UI Integration

This package does not inject the login UI automatically.

Your Strapi project must customize the admin login flow so it works like this:

1. admin enters email and password
2. frontend calls `POST /api/admin-2fa/login`
3. frontend shows OTP screen
4. admin enters OTP
5. frontend calls `POST /api/admin-2fa/verify`
6. optional resend button calls `POST /api/admin-2fa/resend`

## Recommended Project Structure For The Admin Patch

In your Strapi project, keep your admin patch files in your own `scripts` folder:

```text
your-project/
  scripts/
    strapi-admin-2fa-patch/
      services/
        auth.js
        auth.mjs
      pages/
        Auth/
          components/
            Login.js
            Login.mjs
    apply-strapi-admin-2fa-patch.js
```

This keeps your admin customizations reproducible and easy to reapply after `npm install`.

## Step 5: Patch The Strapi Admin Auth Service

Create these files in your Strapi project:

- `scripts/strapi-admin-2fa-patch/services/auth.js`
- `scripts/strapi-admin-2fa-patch/services/auth.mjs`

Start from the corresponding Strapi admin auth service file and add the OTP mutations below.

### Add these mutations

```js
adminLoginWithOtp: builder.mutation({
  query: (body) => ({
    method: 'POST',
    url: '/api/admin-2fa/login',
    data: body,
  }),
  transformResponse(res) {
    return res.data;
  },
}),

verifyAdminLoginOtp: builder.mutation({
  query: (body) => ({
    method: 'POST',
    url: '/api/admin-2fa/verify',
    data: body,
  }),
  transformResponse(res) {
    return res.data;
  },
  invalidatesTags: ['Me'],
}),

resendAdminLoginOtp: builder.mutation({
  query: (body) => ({
    method: 'POST',
    url: '/api/admin-2fa/resend',
    data: body,
  }),
  transformResponse(res) {
    return res.data;
  },
}),
```

### Export these hooks

```js
const {
  useAdminLoginWithOtpMutation,
  useVerifyAdminLoginOtpMutation,
  useResendAdminLoginOtpMutation,
} = authService;
```

## Step 6: Patch The Strapi Login Screen

Create these files in your Strapi project:

- `scripts/strapi-admin-2fa-patch/pages/Auth/components/Login.js`
- `scripts/strapi-admin-2fa-patch/pages/Auth/components/Login.mjs`

This component must replace the normal one-step login with a two-step state:

- credentials step
- OTP step

### Minimum state you need

```js
const [otpStep, setOtpStep] = React.useState(null);
const [apiError, setApiError] = React.useState();

const [adminLoginWithOtp, { isLoading: isLoggingIn }] = useAdminLoginWithOtpMutation();
const [verifyAdminLoginOtp, { isLoading: isVerifyingOtp }] = useVerifyAdminLoginOtpMutation();
const [resendAdminLoginOtp, { isLoading: isResendingOtp }] = useResendAdminLoginOtpMutation();
```

### Credentials submit handler

```js
const handleLogin = async (body) => {
  setApiError(undefined);

  const res = await adminLoginWithOtp({
    ...body,
    deviceId: crypto.randomUUID(),
  });

  if ('error' in res) {
    setApiError(res.error.message ?? 'Something went wrong');
    return;
  }

  setOtpStep({
    challengeId: res.data.challengeId,
    expiresAt: res.data.expiresAt,
    maskedEmail: res.data.maskedEmail,
    rememberMe: body.rememberMe,
  });
};
```

### OTP verify handler

```js
const handleVerifyOtp = async ({ code }) => {
  if (!otpStep) return;

  setApiError(undefined);

  const res = await verifyAdminLoginOtp({
    challengeId: otpStep.challengeId,
    code,
  });

  if ('error' in res) {
    setApiError(res.error.message ?? 'Something went wrong');
    return;
  }

  dispatch(
    login({
      token: res.data.token,
      persist: otpStep.rememberMe,
    })
  );

  navigate('/');
};
```

### OTP resend handler

```js
const handleResendOtp = async () => {
  if (!otpStep) return;

  setApiError(undefined);

  const res = await resendAdminLoginOtp({
    challengeId: otpStep.challengeId,
  });

  if ('error' in res) {
    setApiError(res.error.message ?? 'Something went wrong');
    return;
  }

  setOtpStep((current) =>
    current
      ? {
          ...current,
          expiresAt: res.data.expiresAt,
          maskedEmail: res.data.maskedEmail,
        }
      : current
  );
};
```

### OTP input handling

At minimum:

```js
const OTP_LENGTH = 6;
const sanitizeOtp = (value = '') => value.replace(/\D/g, '').slice(0, OTP_LENGTH);
```

The working implementation used in the companion project includes:

- 6 digit boxes
- paste support
- backspace handling
- auto focus
- inline error state

## Step 7: Add A Patch Apply Script

Create:

- `scripts/apply-strapi-admin-2fa-patch.js`

This script should:

1. copy `scripts/strapi-admin-2fa-patch/services/auth.js`
2. copy `scripts/strapi-admin-2fa-patch/services/auth.mjs`
3. copy `scripts/strapi-admin-2fa-patch/pages/Auth/components/Login.js`
4. copy `scripts/strapi-admin-2fa-patch/pages/Auth/components/Login.mjs`
5. overwrite the matching files in `node_modules/@strapi/admin/...`
6. clear stale Strapi admin cache directories

## Step 8: Wire The Patch Script In `package.json`

In your Strapi project `package.json`, add:

```json
{
  "scripts": {
    "prebuild": "node scripts/apply-strapi-admin-2fa-patch.js",
    "predev": "node scripts/apply-strapi-admin-2fa-patch.js",
    "predevelop": "node scripts/apply-strapi-admin-2fa-patch.js",
    "postinstall": "node scripts/apply-strapi-admin-2fa-patch.js"
  }
}
```

This ensures the login patch is reapplied:

- after dependency install
- before build
- before dev

## Request Flow

### Login

```http
POST /api/admin-2fa/login
Content-Type: application/json
```

Example body:

```json
{
  "email": "admin@example.com",
  "password": "super-secret-password",
  "rememberMe": true,
  "deviceId": "browser-device-id"
}
```

Example response:

```json
{
  "data": {
    "challengeId": "***",
    "expiresAt": "2026-04-05T18:30:00.000Z",
    "maskedEmail": "admin@example.com",
    "rememberMe": true
  }
}
```

### Verify

```http
POST /api/admin-2fa/verify
Content-Type: application/json
```

Example body:

```json
{
  "challengeId": "***",
  "code": "123456"
}
```

### Resend

```http
POST /api/admin-2fa/resend
Content-Type: application/json
```

Example body:

```json
{
  "challengeId": "***"
}
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

## Testing Checklist

After setup, test these cases:

1. correct email/password shows OTP screen
2. correct OTP logs into admin successfully
3. resend OTP works
4. invalid OTP shows an error
5. expired OTP restarts the flow properly
6. wrong email/password still fails safely

## Code-Level Overview

Main plugin files:

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
  Declares `/login`, `/verify`, and `/resend`.

- `server/src/controllers/auth.js`
  Extracts request data, resolves client IP, sets refresh cookies after verification.

- `server/src/services/auth.js`
  Core OTP engine: credentials, challenge lifecycle, rate limits, email sending, and session creation.

- `server/src/utils/strapi-session-auth.js`
  Resolves Strapi's internal admin session helper at runtime.

## Deeper Docs

If you want more detail from the repository:

- `docs/INTEGRATION.md`
- `docs/ARCHITECTURE.md`
- `admin-screen.md`

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
4. test in a real Strapi app
5. bump the version
6. run `npm publish --access public`

## Production Notes

- This improves admin security, but email OTP is still weaker than TOTP or WebAuthn.
- If the admin email account is compromised, the second factor can still be bypassed.
- For stronger future versions, consider TOTP, backup codes, trusted devices, or passkeys.
