# Admin Screen Integration

This file shows the practical admin-side integration used with `@vivinkv28/strapi-2fa-admin-plugin`.

Use this when you want to connect the plugin backend endpoints to a custom Strapi admin login + OTP screen.

## Links

- GitHub repo: [https://github.com/vivinkv6/strapi-admin-2fa-plugin](https://github.com/vivinkv6/strapi-admin-2fa-plugin)
- README: [https://github.com/vivinkv6/strapi-admin-2fa-plugin/blob/main/README.md](https://github.com/vivinkv6/strapi-admin-2fa-plugin/blob/main/README.md)
- Integration doc: [https://github.com/vivinkv6/strapi-admin-2fa-plugin/blob/main/docs/INTEGRATION.md](https://github.com/vivinkv6/strapi-admin-2fa-plugin/blob/main/docs/INTEGRATION.md)

## What You Need In The Host Strapi Project

The plugin already gives you the backend endpoints:

- `POST /api/admin-2fa/login`
- `POST /api/admin-2fa/verify`
- `POST /api/admin-2fa/resend`

To make them usable in Strapi admin login, the host project needs:

1. an auth service patch that calls those endpoints
2. a login screen patch with two states:
   - credentials step
   - OTP step
3. a script that copies the patched files into Strapi admin source during install/build/dev

## Step 1: Patch The Admin Auth Service

In the Strapi admin auth service, add three mutations:

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

And export the hooks:

```js
const {
  useAdminLoginWithOtpMutation,
  useVerifyAdminLoginOtpMutation,
  useResendAdminLoginOtpMutation,
} = authService;
```

## Step 2: Patch The Login Screen

The login screen needs two phases:

### Phase A: Email + password

- collect `email`
- collect `password`
- collect `rememberMe`
- call `useAdminLoginWithOtpMutation()`

On success, save:

- `challengeId`
- `expiresAt`
- `maskedEmail`
- `rememberMe`

Then switch into OTP mode.

### Phase B: OTP input

- show 6 OTP boxes
- call `useVerifyAdminLoginOtpMutation()`
- add a resend button using `useResendAdminLoginOtpMutation()`
- on success, dispatch normal Strapi login state

## Example Login State

This is the basic state shape used in the working example:

```js
const [otpStep, setOtpStep] = React.useState(null);
const [apiError, setApiError] = React.useState();

const [adminLoginWithOtp, { isLoading: isLoggingIn }] = useAdminLoginWithOtpMutation();
const [verifyAdminLoginOtp, { isLoading: isVerifyingOtp }] = useVerifyAdminLoginOtpMutation();
const [resendAdminLoginOtp, { isLoading: isResendingOtp }] = useResendAdminLoginOtpMutation();
```

## Example Login Handler

```js
const handleLogin = async (body) => {
  setApiError(undefined);

  const res = await adminLoginWithOtp({
    ...body,
    deviceId: getOrCreateDeviceId(),
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

## Example Verify Handler

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

  dispatch(login({
    token: res.data.token,
    persist: otpStep.rememberMe,
  }));

  navigate('/');
};
```

## Example Resend Handler

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

  setOtpStep({
    ...otpStep,
    expiresAt: res.data.expiresAt,
    maskedEmail: res.data.maskedEmail,
  });
};
```

## OTP Input Rules Used In The Working Screen

- 6 digits only
- auto-focus next digit
- support paste
- support backspace across boxes
- show error state for invalid OTP

Minimal sanitize helper:

```js
const OTP_LENGTH = 6;
const sanitizeOtp = (value = '') => value.replace(/\D/g, '').slice(0, OTP_LENGTH);
```

## Step 3: Copy The Patch Into Strapi Admin

Because Strapi admin login is inside `node_modules/@strapi/admin/...`, keep your patched files in your own project and copy them during:

- `postinstall`
- `predev`
- `prebuild`

Typical files to patch:

- `services/auth.js`
- `services/auth.mjs`
- `pages/Auth/components/Login.js`
- `pages/Auth/components/Login.mjs`

## Step 4: Add A Patch Apply Script

Typical idea:

1. keep your modified files in `scripts/your-admin-patch/...`
2. copy them into the matching Strapi admin source files
3. clear stale Strapi admin cache folders

This keeps the admin customization reproducible after `npm install`.

## Recommended Host Project Flow

1. install the plugin
2. configure the plugin in `config/plugins.ts`
3. configure your email provider
4. patch the Strapi admin auth service
5. patch the Strapi login screen
6. add the patch copy script
7. restart Strapi and test:
   - correct email/password -> OTP screen
   - valid OTP -> admin login success
   - resend OTP
   - invalid OTP
   - expired OTP

## Important Note

This plugin is intentionally backend-focused.

The admin login screen integration is project-level work because Strapi does not provide a simple plug-and-play extension point for replacing the default admin login with a custom OTP UI flow.
