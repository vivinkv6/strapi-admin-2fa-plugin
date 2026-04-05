'use strict';

const sessionAuth = require('../utils/strapi-session-auth');

const getService = () => strapi.plugin('admin-2fa').service('auth');

const setRefreshCookie = (ctx, refreshToken, cookieOptions) => {
  ctx.cookies.set(sessionAuth.REFRESH_COOKIE_NAME, refreshToken, cookieOptions);
};

const getClientIp = (ctx) => {
  const forwardedFor = ctx.request.headers['x-forwarded-for'];

  if (typeof forwardedFor === 'string' && forwardedFor.trim().length > 0) {
    return forwardedFor.split(',')[0].trim();
  }

  if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
    return String(forwardedFor[0]).trim();
  }

  return String(ctx.request.ip ?? ctx.ip ?? '').trim();
};

module.exports = {
  async login(ctx) {
    const result = await getService().createChallenge(ctx.request.body ?? {}, {
      clientIp: getClientIp(ctx),
    });

    ctx.body = { data: result };
  },

  async resend(ctx) {
    const result = await getService().resendChallenge(ctx.request.body ?? {}, {
      clientIp: getClientIp(ctx),
    });

    ctx.body = { data: result };
  },

  async verify(ctx) {
    const result = await getService().verifyChallenge(ctx.request.body ?? {}, {
      secureRequest: ctx.request.secure,
      clientIp: getClientIp(ctx),
    });

    setRefreshCookie(ctx, result.refreshToken, result.cookieOptions);

    ctx.body = {
      data: {
        token: result.accessToken,
        accessToken: result.accessToken,
        user: result.user,
      },
    };
  },
};
