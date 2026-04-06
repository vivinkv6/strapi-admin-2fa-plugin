'use strict';

const sessionAuth = require('../utils/strapi-session-auth');

const getService = () => strapi.plugin('admin-2fa').service('auth');

const APPLICATION_ERROR_STATUS = {
  ApplicationError: 400,
  ValidationError: 400,
  UnauthorizedError: 400,
  ForbiddenError: 400,
  NotFoundError: 404,
  PayloadTooLargeError: 413,
  RateLimitError: 429,
  NotImplementedError: 501,
};

const deriveApplicationErrorStatus = (error) => {
  if (typeof error?.status === 'number' && error.status >= 400 && error.status < 500) {
    return error.status;
  }

  const message = typeof error?.message === 'string' ? error.message.toLowerCase() : '';

  if (
    message.includes('session not found') ||
    message.includes('please log in again') ||
    message.includes('otp expired') ||
    message.includes('expired otp')
  ) {
    return 409;
  }

  return APPLICATION_ERROR_STATUS[error?.name] ?? 400;
};

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

const sendApplicationError = (ctx, error) => {
  const derivedStatus = deriveApplicationErrorStatus(error);

  ctx.status = derivedStatus;
  ctx.body = {
    data: null,
    error: {
      status: derivedStatus,
      name: error?.name ?? 'ApplicationError',
      message: error?.message ?? 'Request failed',
      details: error?.details ?? {},
    },
  };
};

module.exports = {
  async login(ctx) {
    try {
      const result = await getService().createChallenge(ctx.request.body ?? {}, {
        clientIp: getClientIp(ctx),
      });

      ctx.body = { data: result };
    } catch (error) {
      if (error?.name && APPLICATION_ERROR_STATUS[error.name]) {
        sendApplicationError(ctx, error);
        return;
      }

      throw error;
    }
  },

  async resend(ctx) {
    try {
      const result = await getService().resendChallenge(ctx.request.body ?? {}, {
        clientIp: getClientIp(ctx),
      });

      ctx.body = { data: result };
    } catch (error) {
      if (error?.name && APPLICATION_ERROR_STATUS[error.name]) {
        sendApplicationError(ctx, error);
        return;
      }

      throw error;
    }
  },

  async verify(ctx) {
    try {
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
    } catch (error) {
      if (error?.name && APPLICATION_ERROR_STATUS[error.name]) {
        sendApplicationError(ctx, error);
        return;
      }

      throw error;
    }
  },
};
