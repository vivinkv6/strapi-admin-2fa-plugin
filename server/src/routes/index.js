'use strict';

module.exports = {
  'content-api': {
    type: 'content-api',
    routes: [
      {
        method: 'POST',
        path: '/login',
        handler: 'auth.login',
        config: {
          auth: false,
        },
      },
      {
        method: 'POST',
        path: '/verify',
        handler: 'auth.verify',
        config: {
          auth: false,
        },
      },
      {
        method: 'POST',
        path: '/resend',
        handler: 'auth.resend',
        config: {
          auth: false,
        },
      },
    ],
  },
};
