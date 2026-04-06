'use strict';

const crypto = require('crypto');
const { errors } = require('@strapi/utils');
const sessionAuth = require('../utils/strapi-session-auth');

const { ApplicationError, RateLimitError, UnauthorizedError, ValidationError } = errors;

const STORE_NAME = 'admin-otp-login';
const STORE_KEY_PREFIX = 'challenge:';
const RATE_LIMIT_KEY_PREFIX = 'rate-limit:';

const DEFAULT_CONFIG = {
  otpDigits: 6,
  otpTtlSeconds: 5 * 60,
  maxAttempts: 5,
  maxResends: 3,
  rateLimitWindowSeconds: 15 * 60,
  loginIpLimit: 10,
  loginEmailLimit: 5,
  verifyIpLimit: 20,
  verifyEmailLimit: 10,
  resendIpLimit: 10,
  resendEmailLimit: 5,
  debugTimings: process.env.ADMIN_OTP_DEBUG_TIMINGS === 'true' || process.env.NODE_ENV !== 'production',
  emailSubject: 'Your admin login OTP code',
  emailTextTemplate: 'Your OTP code is {{code}}. It expires in {{expiryMinutes}} minutes.',
  emailHtmlTemplate:
    '<p>Your admin login OTP code is <strong>{{code}}</strong>.</p><p>This code expires in {{expiryMinutes}} minutes.</p><p>If you did not try to sign in, please change your password immediately.</p>',
};

const now = () => Date.now();

const parsePositiveInt = (value, fallback) => {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.floor(parsed);
};

const normalizeEmail = (email) => {
  if (typeof email !== 'string') {
    return '';
  }

  return email.trim().toLowerCase();
};

const normalizeIp = (ip) => {
  if (typeof ip !== 'string') {
    return '';
  }

  return ip.trim();
};

const ensureString = (value, message) => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ValidationError(message);
  }

  return value.trim();
};

const ensureOtpFormat = (value, otpDigits) => {
  const code = ensureString(value, 'OTP code is required');
  const pattern = new RegExp(`^\\d{${otpDigits}}$`);

  if (!pattern.test(code)) {
    throw new ValidationError(`OTP code must be a ${otpDigits}-digit number`);
  }

  return code;
};

const getPluginConfig = () => {
  const rawConfig = strapi.config.get('plugin::admin-2fa') ?? {};

  return {
    otpDigits: parsePositiveInt(rawConfig.otpDigits, DEFAULT_CONFIG.otpDigits),
    otpTtlSeconds: parsePositiveInt(rawConfig.otpTtlSeconds, DEFAULT_CONFIG.otpTtlSeconds),
    maxAttempts: parsePositiveInt(rawConfig.maxAttempts, DEFAULT_CONFIG.maxAttempts),
    maxResends: parsePositiveInt(rawConfig.maxResends, DEFAULT_CONFIG.maxResends),
    rateLimitWindowSeconds: parsePositiveInt(
      rawConfig.rateLimitWindowSeconds,
      DEFAULT_CONFIG.rateLimitWindowSeconds
    ),
    loginIpLimit: parsePositiveInt(rawConfig.loginIpLimit, DEFAULT_CONFIG.loginIpLimit),
    loginEmailLimit: parsePositiveInt(rawConfig.loginEmailLimit, DEFAULT_CONFIG.loginEmailLimit),
    verifyIpLimit: parsePositiveInt(rawConfig.verifyIpLimit, DEFAULT_CONFIG.verifyIpLimit),
    verifyEmailLimit: parsePositiveInt(rawConfig.verifyEmailLimit, DEFAULT_CONFIG.verifyEmailLimit),
    resendIpLimit: parsePositiveInt(rawConfig.resendIpLimit, DEFAULT_CONFIG.resendIpLimit),
    resendEmailLimit: parsePositiveInt(rawConfig.resendEmailLimit, DEFAULT_CONFIG.resendEmailLimit),
    debugTimings:
      typeof rawConfig.debugTimings === 'boolean' ? rawConfig.debugTimings : DEFAULT_CONFIG.debugTimings,
    emailSubject:
      typeof rawConfig.emailSubject === 'string' && rawConfig.emailSubject.trim().length > 0
        ? rawConfig.emailSubject.trim()
        : DEFAULT_CONFIG.emailSubject,
    emailTextTemplate:
      typeof rawConfig.emailTextTemplate === 'string' && rawConfig.emailTextTemplate.trim().length > 0
        ? rawConfig.emailTextTemplate
        : DEFAULT_CONFIG.emailTextTemplate,
    emailHtmlTemplate:
      typeof rawConfig.emailHtmlTemplate === 'string' && rawConfig.emailHtmlTemplate.trim().length > 0
        ? rawConfig.emailHtmlTemplate
        : DEFAULT_CONFIG.emailHtmlTemplate,
  };
};

const logDuration = (config, label, startedAt, meta) => {
  if (!config.debugTimings) {
    return;
  }

  const durationMs = Date.now() - startedAt;
  const suffix = meta && Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
  strapi.log.info(`[admin-2fa] ${label} completed in ${durationMs}ms${suffix}`);
};

const createOtpCode = (otpDigits) =>
  crypto.randomInt(0, 10 ** otpDigits).toString().padStart(otpDigits, '0');

const createOtpHash = (challengeId, code, salt) =>
  new Promise((resolve, reject) => {
    crypto.scrypt(`${challengeId}:${code}`, salt, 64, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(derivedKey.toString('hex'));
    });
  });

const getStore = () =>
  strapi.store({
    type: 'plugin',
    name: STORE_NAME,
  });

const getStoreKey = (challengeId) => `${STORE_KEY_PREFIX}${challengeId}`;

const getRateLimitKey = (action, scope, identifier) => {
  const hash = crypto.createHash('sha256').update(identifier).digest('hex');
  return `${RATE_LIMIT_KEY_PREFIX}${action}:${scope}:${hash}`;
};

const getRateLimitLimit = (config, action, scope) => {
  if (action === 'login' && scope === 'ip') return config.loginIpLimit;
  if (action === 'login' && scope === 'email') return config.loginEmailLimit;
  if (action === 'verify' && scope === 'ip') return config.verifyIpLimit;
  if (action === 'verify' && scope === 'email') return config.verifyEmailLimit;
  if (action === 'resend' && scope === 'ip') return config.resendIpLimit;
  return config.resendEmailLimit;
};

const deleteChallenge = async (store, challengeId) => {
  await store.delete({ key: getStoreKey(challengeId) });
};

const getChallenge = async (store, challengeId) => {
  const challenge = await store.get({ key: getStoreKey(challengeId) });

  if (!challenge) {
    throw new UnauthorizedError('OTP session not found. Please log in again.');
  }

  if (new Date(challenge.expiresAt).getTime() <= Date.now()) {
    await deleteChallenge(store, challengeId);
    throw new UnauthorizedError('OTP expired. Please log in again.');
  }

  return challenge;
};

const registerRateLimitHit = async (store, config, action, scope, identifier) => {
  if (!identifier) {
    return;
  }

  const limit = getRateLimitLimit(config, action, scope);
  const key = getRateLimitKey(action, scope, identifier);
  const existing = await store.get({ key });
  const startedAt = Date.now();

  if (!existing || new Date(existing.resetAt).getTime() <= startedAt) {
    await store.set({
      key,
      value: {
        count: 1,
        resetAt: new Date(startedAt + config.rateLimitWindowSeconds * 1000).toISOString(),
      },
    });
    return;
  }

  if (existing.count >= limit) {
    throw new RateLimitError('Too many authentication attempts. Please wait a few minutes and try again.');
  }

  await store.set({
    key,
    value: {
      ...existing,
      count: existing.count + 1,
    },
  });
};

const applyTemplate = (template, values) =>
  template.replace(/\{\{(\w+)\}\}/g, (_match, key) => String(values[key] ?? ''));

const sendOtpEmail = async (config, email, code) => {
  const startedAt = now();
  const expiryMinutes = Math.max(1, Math.floor(config.otpTtlSeconds / 60));

  await strapi.plugin('email').service('email').send({
    to: email,
    subject: config.emailSubject,
    text: applyTemplate(config.emailTextTemplate, { code, expiryMinutes }),
    html: applyTemplate(config.emailHtmlTemplate, { code, expiryMinutes }),
  });

  logDuration(config, 'sendOtpEmail', startedAt);
};

const createSession = async (userId, deviceId, rememberMe, secureRequest) => {
  const sessionManager = sessionAuth.getSessionManager();

  if (!sessionManager) {
    throw new ApplicationError('Admin session manager is not available');
  }

  const { token: refreshToken, absoluteExpiresAt } = await sessionManager('admin').generateRefreshToken(
    String(userId),
    deviceId,
    {
      type: rememberMe ? 'refresh' : 'session',
    }
  );

  const cookieOptions = sessionAuth.buildCookieOptionsWithExpiry(
    rememberMe ? 'refresh' : 'session',
    absoluteExpiresAt,
    secureRequest
  );

  const accessResult = await sessionManager('admin').generateAccessToken(refreshToken);

  if ('error' in accessResult) {
    throw new ApplicationError('Failed to generate admin access token');
  }

  const userService = strapi.service('admin::user');
  const user = await strapi.db.query('admin::user').findOne({
    where: { id: userId },
  });

  if (!user) {
    throw new ApplicationError('Admin user no longer exists');
  }

  return {
    refreshToken,
    cookieOptions,
    accessToken: accessResult.token,
    user: userService.sanitizeUser(user),
  };
};

module.exports = () => ({
  async createChallenge(body = {}, context = {}) {
    const config = getPluginConfig();
    const requestStartedAt = now();
    const email = normalizeEmail(body.email);
    const password = ensureString(body.password, 'Password is required');
    const clientIp = normalizeIp(context.clientIp);
    const deviceId =
      typeof body.deviceId === 'string' && body.deviceId.trim().length > 0
        ? body.deviceId.trim()
        : sessionAuth.generateDeviceId();
    const rememberMe = Boolean(body.rememberMe);
    const store = getStore();

    if (!email) {
      throw new ValidationError('Email is required');
    }

    await registerRateLimitHit(store, config, 'login', 'ip', clientIp);
    await registerRateLimitHit(store, config, 'login', 'email', email);

    const credentialsStartedAt = now();
    const [, user, info] = await strapi.service('admin::auth').checkCredentials({
      email,
      password,
    });
    logDuration(config, 'checkCredentials', credentialsStartedAt);

    if (!user) {
      throw new UnauthorizedError(info?.message ?? 'Invalid credentials');
    }

    const challengeId = crypto.randomUUID();
    const code = createOtpCode(config.otpDigits);
    const salt = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + config.otpTtlSeconds * 1000).toISOString();
    const hashStartedAt = now();
    const hash = await createOtpHash(challengeId, code, salt);
    logDuration(config, 'createOtpHash', hashStartedAt, { challengeId });

    const challenge = {
      id: challengeId,
      userId: user.id,
      email,
      deviceId,
      rememberMe,
      salt,
      hash,
      attempts: 0,
      resendCount: 0,
      expiresAt,
    };

    const storeStartedAt = now();
    await store.set({
      key: getStoreKey(challengeId),
      value: challenge,
    });
    logDuration(config, 'storeChallenge', storeStartedAt, { challengeId });

    await sendOtpEmail(config, email, code);
    logDuration(config, 'createChallenge', requestStartedAt, { challengeId });

    return {
      challengeId,
      expiresAt,
      maskedEmail: email,
      rememberMe,
    };
  },

  async resendChallenge(body = {}, context = {}) {
    const config = getPluginConfig();
    const requestStartedAt = now();
    const challengeId = ensureString(body.challengeId, 'Challenge ID is required');
    const clientIp = normalizeIp(context.clientIp);
    const store = getStore();

    await registerRateLimitHit(store, config, 'resend', 'ip', clientIp);

    const loadStartedAt = now();
    const current = await getChallenge(store, challengeId);
    logDuration(config, 'loadChallengeForResend', loadStartedAt, { challengeId });

    await registerRateLimitHit(store, config, 'resend', 'email', current.email);

    if (current.resendCount >= config.maxResends) {
      await deleteChallenge(store, challengeId);
      throw new RateLimitError('Maximum OTP resend attempts exceeded. Please log in again.');
    }

    const code = createOtpCode(config.otpDigits);
    const salt = crypto.randomBytes(16).toString('hex');
    const hashStartedAt = now();
    const hash = await createOtpHash(challengeId, code, salt);
    logDuration(config, 'createOtpHashForResend', hashStartedAt, { challengeId });

    const nextChallenge = {
      ...current,
      salt,
      hash,
      resendCount: current.resendCount + 1,
      attempts: 0,
      expiresAt: new Date(Date.now() + config.otpTtlSeconds * 1000).toISOString(),
    };

    const storeStartedAt = now();
    await store.set({
      key: getStoreKey(challengeId),
      value: nextChallenge,
    });
    logDuration(config, 'storeResentChallenge', storeStartedAt, { challengeId });

    await sendOtpEmail(config, current.email, code);
    logDuration(config, 'resendChallenge', requestStartedAt, { challengeId });

    return {
      challengeId,
      expiresAt: nextChallenge.expiresAt,
      maskedEmail: current.email,
    };
  },

  async verifyChallenge(body = {}, context = {}) {
    const config = getPluginConfig();
    const requestStartedAt = now();
    const challengeId = ensureString(body.challengeId, 'Challenge ID is required');
    const code = ensureOtpFormat(body.code, config.otpDigits);
    const clientIp = normalizeIp(context.clientIp);
    const store = getStore();

    await registerRateLimitHit(store, config, 'verify', 'ip', clientIp);

    const loadStartedAt = now();
    const challenge = await getChallenge(store, challengeId);
    logDuration(config, 'loadChallengeForVerify', loadStartedAt, { challengeId });

    await registerRateLimitHit(store, config, 'verify', 'email', challenge.email);

    if (challenge.attempts >= config.maxAttempts) {
      await deleteChallenge(store, challengeId);
      throw new RateLimitError('Maximum OTP attempts exceeded. Please log in again.');
    }

    const hashStartedAt = now();
    const computedHash = await createOtpHash(challengeId, code, challenge.salt);
    logDuration(config, 'createOtpHashForVerify', hashStartedAt, { challengeId });

    const isValid = crypto.timingSafeEqual(
      Buffer.from(computedHash, 'hex'),
      Buffer.from(challenge.hash, 'hex')
    );

    if (!isValid) {
      const nextAttempts = challenge.attempts + 1;

      if (nextAttempts >= config.maxAttempts) {
        await deleteChallenge(store, challengeId);
        throw new RateLimitError('Maximum OTP attempts exceeded. Please log in again.');
      }

      const storeStartedAt = now();
      await store.set({
        key: getStoreKey(challengeId),
        value: {
          ...challenge,
          attempts: nextAttempts,
        },
      });
      logDuration(config, 'storeFailedAttempt', storeStartedAt, {
        challengeId,
        attempts: nextAttempts,
      });

      throw new UnauthorizedError('Invalid OTP code');
    }

    const deleteStartedAt = now();
    await deleteChallenge(store, challengeId);
    logDuration(config, 'deleteChallengeAfterVerify', deleteStartedAt, { challengeId });

    const sessionStartedAt = now();
    const session = await createSession(
      challenge.userId,
      challenge.deviceId,
      challenge.rememberMe,
      Boolean(context.secureRequest)
    );
    logDuration(config, 'createSession', sessionStartedAt, { challengeId });
    logDuration(config, 'verifyChallenge', requestStartedAt, { challengeId });

    return session;
  },
});
