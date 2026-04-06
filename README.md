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

## Full Host Patch Source Included In This Package

This npm package now includes the ready-to-copy host-side admin patch source directly inside the package under:

```text
host-patch/
  apply-strapi-admin-2fa-patch.js
  strapi-admin-2fa-patch/
      services/
        auth.js
        auth.mjs
      pages/
        Auth/
          components/
            Login.js
            Login.mjs
```

Included files:

- `host-patch/apply-strapi-admin-2fa-patch.js`
- `host-patch/strapi-admin-2fa-patch/services/auth.js`
- `host-patch/strapi-admin-2fa-patch/services/auth.mjs`
- `host-patch/strapi-admin-2fa-patch/pages/Auth/components/Login.js`
- `host-patch/strapi-admin-2fa-patch/pages/Auth/components/Login.mjs`

These files are the exact host-side patch source for the admin login UI, OTP screen, and patch script, bundled in the npm package itself so you do not need a separate integration document.

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

## Exact Admin UI Pieces You Need

If you want the admin OTP screen to look and behave like the working portfolio backend, these are the UI pieces that must exist in your patched `Login` component:

### 1. Shared OTP constants and helpers

Use:

```js
const OTP_LENGTH = 6;
const sanitizeOtp = (value = '') => value.replace(/\D/g, '').slice(0, OTP_LENGTH);
const createOtpDigits = (value = '') =>
  Array.from({ length: OTP_LENGTH }, (_, index) => value[index] ?? '');
```

Why this matters:

- forces numeric-only OTP input
- keeps the code fixed to 6 digits
- makes the 6-box UI easy to control

### 2. Two screen states inside one login component

Your login screen should switch between:

- credentials screen
- OTP verification screen

The state shape used in the working backend is:

```js
const [apiError, setApiError] = React.useState();
const [otpStep, setOtpStep] = React.useState(null);
```

`otpStep` stores:

- `challengeId`
- `expiresAt`
- `maskedEmail`
- `rememberMe`

When `otpStep` is `null`, show email/password fields.

When `otpStep` exists, show the OTP UI.

### 3. Patched auth hooks

Your patched auth service must export:

```js
const {
  useAdminLoginWithOtpMutation,
  useVerifyAdminLoginOtpMutation,
  useResendAdminLoginOtpMutation,
} = authService;
```

Then the patched login screen uses:

```js
const [adminLoginWithOtp, { isLoading: isLoggingIn }] = useAdminLoginWithOtpMutation();
const [verifyAdminLoginOtp, { isLoading: isVerifyingOtp }] =
  useVerifyAdminLoginOtpMutation();
const [resendAdminLoginOtp, { isLoading: isResendingOtp }] =
  useResendAdminLoginOtpMutation();
```

### 4. Credentials form step

In the first step, keep the normal Strapi fields:

- `email`
- `password`
- `rememberMe`

On submit:

1. call the OTP login endpoint
2. do not create a Strapi session yet
3. store the returned `challengeId`, `expiresAt`, and `maskedEmail`
4. switch to the OTP step

### 5. OTP visual layout

The working backend UI uses:

- a heading such as `Enter your OTP code`
- a subtitle showing the masked email
- an expiry message
- a centered 6-digit input row
- a primary `Verify OTP` button
- a secondary `Back` button
- a tertiary `Resend OTP` button
- an inline error message area

### 6. OTP input box behavior

The working UI is not a single text input. It is a 6-box OTP component with:

- one visible input per digit
- automatic focus movement
- paste support for full OTP values
- backspace support to move backward
- left/right arrow key navigation
- red error styling when validation fails

That behavior lives inside a dedicated `OtpField` component inside the patched `Login.js` / `Login.mjs` files.

### 7. Verify flow

On OTP submit:

1. call the verify endpoint with `challengeId` and `code`
2. if it succeeds, dispatch the normal Strapi admin login action
3. navigate to `/` or the `redirectTo` query target

### 8. Resend flow

On resend:

1. call the resend endpoint with `challengeId`
2. keep the user on the OTP screen
3. update `expiresAt`
4. update `maskedEmail` if needed
5. show a success notification

### 9. Back button behavior

The working backend keeps a `Back` button on the OTP screen that simply resets:

```js
setOtpStep(null);
```

That sends the admin back to the email/password screen without refreshing the page.

### 10. Why both `.js` and `.mjs` files are needed

Strapi ships both CommonJS and ESM admin build files inside `node_modules/@strapi/admin/...`.

To keep the admin patch stable, the same logic should be copied into both:

- `Login.js`
- `Login.mjs`
- `auth.js`
- `auth.mjs`

If you patch only one side, the admin build can drift or break depending on how Strapi resolves the files.

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

## Admin UI Documentation Summary

If you want your project README or integration guide to document the admin UI clearly, include these sections in order:

1. exact patch folder structure
2. exact file names
3. purpose of each file
4. auth service mutations to add
5. login component state you need
6. OTP UI behavior details
7. patch apply script behavior
8. package.json hooks
9. request/response examples
10. testing checklist

## Production Notes

- This improves admin security, but email OTP is still weaker than TOTP or WebAuthn.
- If the admin email account is compromised, the second factor can still be bypassed.
- For stronger future versions, consider TOTP, backup codes, trusted devices, or passkeys.
