import { adminApi } from './api.mjs';

const authService = adminApi.enhanceEndpoints({
    addTagTypes: [
        'User',
        'Me',
        'ProvidersOptions'
    ]
}).injectEndpoints({
    endpoints: (builder)=>({
            getMe: builder.query({
                query: ()=>({
                        method: 'GET',
                        url: '/admin/users/me'
                    }),
                transformResponse (res) {
                    return res.data;
                },
                providesTags: (res)=>res ? [
                        'Me',
                        {
                            type: 'User',
                            id: res.id
                        }
                    ] : [
                        'Me'
                    ]
            }),
            getMyPermissions: builder.query({
                query: ()=>({
                        method: 'GET',
                        url: '/admin/users/me/permissions'
                    }),
                transformResponse (res) {
                    return res.data;
                }
            }),
            updateMe: builder.mutation({
                query: (body)=>({
                        method: 'PUT',
                        url: '/admin/users/me',
                        data: body
                    }),
                transformResponse (res) {
                    return res.data;
                },
                invalidatesTags: [
                    'Me'
                ]
            }),
            checkPermissions: builder.query({
                query: (permissions)=>({
                        method: 'POST',
                        url: '/admin/permissions/check',
                        data: permissions
                    })
            }),
            login: builder.mutation({
                query: (body)=>({
                        method: 'POST',
                        url: '/admin/login',
                        data: body
                    }),
                transformResponse (res) {
                    return res.data;
                },
                invalidatesTags: [
                    'Me'
                ]
            }),
            adminLoginWithOtp: builder.mutation({
                query: (body)=>({
                        method: 'POST',
                        url: '/api/admin-2fa/login',
                        data: body
                    }),
                transformResponse (res) {
                    return res.data;
                }
            }),
            verifyAdminLoginOtp: builder.mutation({
                query: (body)=>({
                        method: 'POST',
                        url: '/api/admin-2fa/verify',
                        data: body
                    }),
                transformResponse (res) {
                    return res.data;
                },
                invalidatesTags: [
                    'Me'
                ]
            }),
            resendAdminLoginOtp: builder.mutation({
                query: (body)=>({
                        method: 'POST',
                        url: '/api/admin-2fa/resend',
                        data: body
                    }),
                transformResponse (res) {
                    return res.data;
                }
            }),
            logout: builder.mutation({
                query: (body)=>({
                        method: 'POST',
                        url: '/admin/logout',
                        data: body
                    })
            }),
            resetPassword: builder.mutation({
                query: (body)=>({
                        method: 'POST',
                        url: '/admin/reset-password',
                        data: body
                    }),
                transformResponse (res) {
                    return res.data;
                }
            }),
            accessTokenExchange: builder.mutation({
                query: (body)=>({
                        method: 'POST',
                        url: '/admin/access-token',
                        data: body
                    }),
                transformResponse (res) {
                    return res.data;
                }
            }),
            getRegistrationInfo: builder.query({
                query: (registrationToken)=>({
                        url: '/admin/registration-info',
                        method: 'GET',
                        config: {
                            params: {
                                registrationToken
                            }
                        }
                    }),
                transformResponse (res) {
                    return res.data;
                }
            }),
            registerAdmin: builder.mutation({
                query: (body)=>({
                        method: 'POST',
                        url: '/admin/register-admin',
                        data: body
                    }),
                transformResponse (res) {
                    return res.data;
                }
            }),
            registerUser: builder.mutation({
                query: (body)=>({
                        method: 'POST',
                        url: '/admin/register',
                        data: body
                    }),
                transformResponse (res) {
                    return res.data;
                }
            }),
            forgotPassword: builder.mutation({
                query: (body)=>({
                        url: '/admin/forgot-password',
                        method: 'POST',
                        data: body
                    })
            }),
            isSSOLocked: builder.query({
                query: ()=>({
                        url: '/admin/providers/isSSOLocked',
                        method: 'GET'
                    }),
                transformResponse (res) {
                    return res.data;
                }
            }),
            getProviders: builder.query({
                query: ()=>({
                        url: '/admin/providers',
                        method: 'GET'
                    })
            }),
            getProviderOptions: builder.query({
                query: ()=>({
                        url: '/admin/providers/options',
                        method: 'GET'
                    }),
                transformResponse (res) {
                    return res.data;
                },
                providesTags: [
                    'ProvidersOptions'
                ]
            }),
            updateProviderOptions: builder.mutation({
                query: (body)=>({
                        url: '/admin/providers/options',
                        method: 'PUT',
                        data: body
                    }),
                transformResponse (res) {
                    return res.data;
                },
                invalidatesTags: [
                    'ProvidersOptions'
                ]
            })
        }),
    overrideExisting: true
});
const { useCheckPermissionsQuery, useLazyCheckPermissionsQuery, useGetMeQuery, useLoginMutation, useAdminLoginWithOtpMutation, useVerifyAdminLoginOtpMutation, useResendAdminLoginOtpMutation, useAccessTokenExchangeMutation, useLogoutMutation, useUpdateMeMutation, useResetPasswordMutation, useRegisterAdminMutation, useRegisterUserMutation, useGetRegistrationInfoQuery, useForgotPasswordMutation, useGetMyPermissionsQuery, useIsSSOLockedQuery, useGetProvidersQuery, useGetProviderOptionsQuery, useUpdateProviderOptionsMutation } = authService;

export { useAccessTokenExchangeMutation, useAdminLoginWithOtpMutation, useCheckPermissionsQuery, useForgotPasswordMutation, useGetMeQuery, useGetMyPermissionsQuery, useGetProviderOptionsQuery, useGetProvidersQuery, useGetRegistrationInfoQuery, useIsSSOLockedQuery, useLazyCheckPermissionsQuery, useLoginMutation, useLogoutMutation, useRegisterAdminMutation, useRegisterUserMutation, useResendAdminLoginOtpMutation, useResetPasswordMutation, useUpdateMeMutation, useUpdateProviderOptionsMutation, useVerifyAdminLoginOtpMutation };
