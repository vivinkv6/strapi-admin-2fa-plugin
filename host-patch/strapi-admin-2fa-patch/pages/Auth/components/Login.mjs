import { jsx, jsxs } from 'react/jsx-runtime';
import * as React from 'react';
import { Main, Box, Typography, Flex, Button, Link } from '@strapi/design-system';
import camelCase from 'lodash/camelCase';
import { useIntl } from 'react-intl';
import { useLocation, useNavigate, NavLink } from 'react-router-dom';
import * as yup from 'yup';
import { Form, useForm } from '../../../components/Form.mjs';
import { InputRenderer as MemoizedInputRenderer } from '../../../components/FormInputs/Renderer.mjs';
import { Logo } from '../../../components/UnauthenticatedLogo.mjs';
import { UnauthenticatedLayout, LayoutContent, Column } from '../../../layouts/UnauthenticatedLayout.mjs';
import { useTypedDispatch } from '../../../core/store/hooks.mjs';
import { useNotification } from '../../../features/Notifications.mjs';
import { login as loginAction } from '../../../reducer.mjs';
import { useAdminLoginWithOtpMutation, useVerifyAdminLoginOtpMutation, useResendAdminLoginOtpMutation } from '../../../services/auth.mjs';
import { getOrCreateDeviceId } from '../../../utils/deviceId.mjs';
import { translatedErrors as errorsTrads } from '../../../utils/translatedErrors.mjs';

const getApiErrorMessage = (error, fallback = 'Something went wrong')=>{
    if (!error || typeof error !== 'object') {
        return fallback;
    }
    const candidates = [
        error?.data?.error?.message,
        error?.data?.message,
        error?.error?.message,
        error?.message,
        typeof error?.error === 'string' ? error.error : undefined
    ];
    const message = candidates.find((value)=>typeof value === 'string' && value.trim().length > 0);
    return message ?? fallback;
};

const OTP_LENGTH = 6;
const OTP_DIGIT_INPUT_STYLE = {
    width: 'min(3.75rem, calc((100vw - 7rem) / 6))',
    minWidth: '2.7rem',
    maxWidth: '3.75rem',
    flex: '1 1 0',
    height: 'min(4.5rem, calc((100vw - 7rem) / 5.4))',
    borderRadius: '1rem',
    borderStyle: 'solid',
    borderWidth: '2px',
    borderColor: 'var(--strapi-colors-neutral500)',
    backgroundColor: 'var(--strapi-colors-neutral200)',
    color: 'var(--strapi-colors-neutral800)',
    fontSize: '1.85rem',
    fontWeight: 700,
    textAlign: 'center',
    outline: 'none',
    transition: 'all 160ms ease',
    boxShadow: 'none'
};
const sanitizeOtp = (value = '')=>value.replace(/\D/g, '').slice(0, OTP_LENGTH);
const createOtpDigits = (value = '')=>Array.from({
        length: OTP_LENGTH
    }, (_, index)=>value[index] ?? '');
const LOGIN_SCHEMA = yup.object().shape({
    email: yup.string().nullable().email({
        id: errorsTrads.email.id,
        defaultMessage: 'Not a valid email'
    }).required(errorsTrads.required),
    password: yup.string().required(errorsTrads.required).nullable(),
    rememberMe: yup.bool().nullable()
});
const OTP_SCHEMA = yup.object().shape({
    code: yup.string().nullable().matches(/^\d{6}$/, {
        message: 'OTP code must be a 6-digit number'
    }).required(errorsTrads.required)
});
const OtpField = ()=>{
    const { values, errors, onChange, isSubmitting } = useForm('OtpField', (state)=>state);
    const inputRefs = React.useRef([]);
    const codeValue = typeof values.code === 'string' ? values.code : '';
    const digits = React.useMemo(()=>createOtpDigits(codeValue), [
        codeValue
    ]);
    const [activeIndex, setActiveIndex] = React.useState(0);
    const focusInput = React.useCallback((index)=>{
        window.requestAnimationFrame(()=>{
            const element = inputRefs.current[index];
            if (element) {
                element.focus();
                element.select();
            }
        });
    }, []);
    React.useEffect(()=>{
        if (!codeValue) {
            focusInput(0);
        }
    }, [
        codeValue,
        focusInput
    ]);
    const commitDigits = React.useCallback((nextDigits, focusIndex)=>{
        const nextCode = nextDigits.join('');
        onChange('code', nextCode || null);
        if (typeof focusIndex === 'number') {
            focusInput(focusIndex);
        }
    }, [
        focusInput,
        onChange
    ]);
    const handleChange = (index)=>(event)=>{
            const incomingValue = sanitizeOtp(event.target.value);
            const nextDigits = [
                ...digits
            ];
            if (!incomingValue) {
                nextDigits[index] = '';
                commitDigits(nextDigits, index);
                return;
            }
            incomingValue.split('').forEach((digit, offset)=>{
                const targetIndex = index + offset;
                if (targetIndex < OTP_LENGTH) {
                    nextDigits[targetIndex] = digit;
                }
            });
            const nextFocusIndex = Math.min(index + incomingValue.length, OTP_LENGTH - 1);
            commitDigits(nextDigits, nextFocusIndex);
        };
    const handleKeyDown = (index)=>(event)=>{
            if (event.key === 'Backspace') {
                event.preventDefault();
                const nextDigits = [
                    ...digits
                ];
                if (nextDigits[index]) {
                    nextDigits[index] = '';
                    commitDigits(nextDigits, index);
                } else if (index > 0) {
                    nextDigits[index - 1] = '';
                    commitDigits(nextDigits, index - 1);
                }
                return;
            }
            if (event.key === 'ArrowLeft' && index > 0) {
                event.preventDefault();
                focusInput(index - 1);
                return;
            }
            if (event.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
                event.preventDefault();
                focusInput(index + 1);
            }
        };
    const handlePaste = (event)=>{
        const pastedValue = sanitizeOtp(event.clipboardData.getData('text'));
        if (!pastedValue) {
            return;
        }
        event.preventDefault();
        const nextDigits = createOtpDigits();
        pastedValue.split('').forEach((digit, index)=>{
            nextDigits[index] = digit;
        });
        commitDigits(nextDigits, Math.min(pastedValue.length, OTP_LENGTH) - 1);
    };
    return /*#__PURE__*/ jsxs(Box, {
        padding: 5,
        style: {
            borderRadius: '1.25rem',
            background: 'var(--strapi-colors-neutral150)',
            border: '1px solid var(--strapi-colors-neutral300)'
        },
        children: [
            /*#__PURE__*/ jsx(Box, {
                paddingBottom: 2,
                children: /*#__PURE__*/ jsx(Flex, {
                    gap: 2,
                    justifyContent: "center",
                    wrap: "nowrap",
                    width: "100%",
                    style: {
                        maxWidth: '24rem',
                        marginInline: 'auto'
                    },
                    onPaste: handlePaste,
                    children: digits.map((digit, index)=>/*#__PURE__*/ jsx("input", {
                            "aria-invalid": errors.code ? 'true' : 'false',
                            "aria-label": `OTP digit ${index + 1}`,
                            autoComplete: index === 0 ? 'one-time-code' : 'off',
                            disabled: isSubmitting,
                            inputMode: "numeric",
                            maxLength: 6,
                            onChange: handleChange(index),
                            onFocus: ()=>setActiveIndex(index),
                            onKeyDown: handleKeyDown(index),
                            pattern: "[0-9]*",
                            ref: (element)=>{
                                inputRefs.current[index] = element;
                            },
                            style: {
                                ...OTP_DIGIT_INPUT_STYLE,
                                borderColor: errors.code ? 'var(--strapi-colors-danger600)' : activeIndex === index ? 'var(--strapi-colors-primary600)' : 'var(--strapi-colors-neutral500)',
                                backgroundColor: activeIndex === index ? 'var(--strapi-colors-neutral0)' : 'var(--strapi-colors-neutral200)',
                                boxShadow: errors.code ? '0 0 0 1px var(--strapi-colors-danger600)' : activeIndex === index ? '0 0 0 3px rgba(73, 69, 255, 0.18)' : 'inset 0 0 0 1px var(--strapi-colors-neutral600)'
                            },
                            type: "text",
                            value: digit
                        }, index))
                })
            }),
            errors.code ? /*#__PURE__*/ jsx(Box, {
                paddingTop: 3,
                children: /*#__PURE__*/ jsx(Typography, {
                    id: "otp-code-error",
                    variant: "pi",
                    textColor: "danger600",
                    children: errors.code
                })
            }) : null
        ]
    });
};
const Login = ({ children })=>{
    const [apiError, setApiError] = React.useState();
    const [otpStep, setOtpStep] = React.useState(null);
    const { formatMessage } = useIntl();
    const { search: searchString } = useLocation();
    const query = React.useMemo(()=>new URLSearchParams(searchString), [
        searchString
    ]);
    const navigate = useNavigate();
    const dispatch = useTypedDispatch();
    const { toggleNotification } = useNotification();
    const [adminLoginWithOtp, { isLoading: isLoggingIn }] = useAdminLoginWithOtpMutation();
    const [verifyAdminLoginOtp, { isLoading: isVerifyingOtp }] = useVerifyAdminLoginOtpMutation();
    const [resendAdminLoginOtp, { isLoading: isResendingOtp }] = useResendAdminLoginOtpMutation();
    React.useEffect(()=>{
        document.title = 'Admin Dashboard';
    }, []);
    const handleLogin = async (body)=>{
        setApiError(undefined);
        const res = await adminLoginWithOtp({
            ...body,
            deviceId: getOrCreateDeviceId()
        });
        if ('error' in res) {
            const message = getApiErrorMessage(res.error);
            if (camelCase(message).toLowerCase() === 'usernotactive') {
                navigate('/auth/oops');
                return;
            }
            setApiError(message);
        } else {
            setOtpStep({
                challengeId: res.data.challengeId,
                expiresAt: res.data.expiresAt,
                maskedEmail: res.data.maskedEmail,
                rememberMe: body.rememberMe
            });
        }
    };
    const handleVerifyOtp = async ({ code })=>{
        if (!otpStep) {
            return;
        }
        setApiError(undefined);
        const res = await verifyAdminLoginOtp({
            challengeId: otpStep.challengeId,
            code
        });
        if ('error' in res) {
            setApiError(getApiErrorMessage(res.error));
        } else {
            toggleNotification({
                type: 'success',
                title: formatMessage({
                    id: 'Auth.notification.authenticated.title',
                    defaultMessage: 'Successfully authenticated'
                })
            });
            dispatch(loginAction({
                token: res.data.token,
                persist: otpStep.rememberMe
            }));
            const redirectTo = query.get('redirectTo');
            const redirectUrl = redirectTo ? decodeURIComponent(redirectTo) : '/';
            navigate(redirectUrl);
        }
    };
    const handleResendOtp = async ()=>{
        if (!otpStep) {
            return;
        }
        setApiError(undefined);
        const res = await resendAdminLoginOtp({
            challengeId: otpStep.challengeId
        });
        if ('error' in res) {
            setApiError(getApiErrorMessage(res.error));
        } else {
            setOtpStep({
                ...otpStep,
                expiresAt: res.data.expiresAt,
                maskedEmail: res.data.maskedEmail
            });
            toggleNotification({
                type: 'success',
                title: formatMessage({
                    id: 'Auth.notification.otpResent.title',
                    defaultMessage: 'OTP resent'
                }),
                message: formatMessage({
                    id: 'Auth.notification.otpResent.message',
                    defaultMessage: `A new OTP has been sent to ${res.data.maskedEmail}.`
                })
            });
        }
    };
    return /*#__PURE__*/ jsx(UnauthenticatedLayout, {
        children: /*#__PURE__*/ jsxs(Main, {
            children: [
                /*#__PURE__*/ jsxs(LayoutContent, {
                    children: [
                        /*#__PURE__*/ jsxs(Column, {
                            children: [
                                /*#__PURE__*/ jsx(Logo, {}),
                                /*#__PURE__*/ jsx(Box, {
                                    paddingTop: 6,
                                    paddingBottom: 1,
                                    children: /*#__PURE__*/ jsx(Typography, {
                                        variant: "alpha",
                                        tag: "h1",
                                        textAlign: "center",
                                        children: formatMessage({
                                            id: otpStep ? 'Auth.form.otp.title' : 'Auth.form.welcome.title',
                                            defaultMessage: otpStep ? 'Enter your OTP code' : 'Welcome!'
                                        })
                                    })
                                }),
                                /*#__PURE__*/ jsx(Box, {
                                    paddingBottom: otpStep ? 5 : 7,
                                    children: /*#__PURE__*/ jsx(Typography, {
                                        variant: "epsilon",
                                        textColor: "neutral600",
                                        textAlign: "center",
                                        display: "block",
                                        children: formatMessage({
                                            id: otpStep ? 'Auth.form.otp.subtitle' : 'Auth.form.welcome.subtitle',
                                            defaultMessage: otpStep ? `We sent a 6-digit code to ${otpStep.maskedEmail}` : 'Log in to your Strapi account'
                                        })
                                    })
                                }),
                                otpStep ? /*#__PURE__*/ jsx(Box, {
                                    paddingBottom: 5,
                                    children: /*#__PURE__*/ jsx(Typography, {
                                        variant: "pi",
                                        textColor: "neutral600",
                                        textAlign: "center",
                                        children: `OTP expires at ${new Date(otpStep.expiresAt).toLocaleTimeString()}`
                                    })
                                }) : null,
                                apiError ? /*#__PURE__*/ jsx(Box, {
                                    paddingBottom: 4,
                                    children: /*#__PURE__*/ jsx(Typography, {
                                        id: "global-form-error",
                                        role: "alert",
                                        tabIndex: -1,
                                        textColor: "danger600",
                                        textAlign: "center",
                                        children: apiError
                                    })
                                }) : null
                            ]
                        }),
                        /*#__PURE__*/ jsx(Form, {
                            method: "PUT",
                            initialValues: otpStep ? {
                                code: ''
                            } : {
                                email: '',
                                password: '',
                                rememberMe: false
                            },
                            onSubmit: (values)=>{
                                if (otpStep) {
                                    handleVerifyOtp(values);
                                } else {
                                    handleLogin(values);
                                }
                            },
                            validationSchema: otpStep ? OTP_SCHEMA : LOGIN_SCHEMA,
                            children: /*#__PURE__*/ jsxs(Flex, {
                                direction: "column",
                                alignItems: "stretch",
                                gap: 6,
                                children: [
                                    otpStep ? /*#__PURE__*/ jsx(OtpField, {}) : [
                                        /*#__PURE__*/ jsx(MemoizedInputRenderer, {
                                            label: formatMessage({
                                                id: 'Auth.form.email.label',
                                                defaultMessage: 'Email'
                                            }),
                                            name: "email",
                                            placeholder: formatMessage({
                                                id: 'Auth.form.email.placeholder',
                                                defaultMessage: 'kai@doe.com'
                                            }),
                                            required: true,
                                            type: "email"
                                        }, "email"),
                                        /*#__PURE__*/ jsx(MemoizedInputRenderer, {
                                            label: formatMessage({
                                                id: 'global.password',
                                                defaultMessage: 'Password'
                                            }),
                                            name: "password",
                                            required: true,
                                            type: "password"
                                        }, "password"),
                                        /*#__PURE__*/ jsx(MemoizedInputRenderer, {
                                            label: formatMessage({
                                                id: 'Auth.form.rememberMe.label',
                                                defaultMessage: 'Remember me'
                                            }),
                                            name: "rememberMe",
                                            type: "checkbox"
                                        }, "rememberMe")
                                    ],
                                    /*#__PURE__*/ jsxs(Flex, {
                                        direction: "column",
                                        gap: 3,
                                        children: [
                                            /*#__PURE__*/ jsx(Button, {
                                                fullWidth: true,
                                                type: "submit",
                                                disabled: otpStep ? isVerifyingOtp : isLoggingIn,
                                                loading: otpStep ? isVerifyingOtp : isLoggingIn,
                                                children: formatMessage({
                                                    id: otpStep ? 'Auth.form.button.verifyOtp' : 'Auth.form.button.login',
                                                    defaultMessage: otpStep ? isVerifyingOtp ? 'Verifying...' : 'Verify OTP' : isLoggingIn ? 'Login...' : 'Login'
                                                })
                                            }),
                                            otpStep ? /*#__PURE__*/ jsxs(Flex, {
                                                gap: 2,
                                                justifyContent: "space-between",
                                                alignItems: "stretch",
                                                children: [
                                                    /*#__PURE__*/ jsx(Button, {
                                                        fullWidth: true,
                                                        style: {
                                                            minWidth: '11rem'
                                                        },
                                                        type: "button",
                                                        variant: "secondary",
                                                        onClick: ()=>setOtpStep(null),
                                                        disabled: isResendingOtp,
                                                        children: formatMessage({
                                                            id: 'Auth.form.button.back',
                                                            defaultMessage: 'Back'
                                                        })
                                                    }),
                                                    /*#__PURE__*/ jsx(Button, {
                                                        fullWidth: true,
                                                        style: {
                                                            minWidth: '11rem'
                                                        },
                                                        type: "button",
                                                        variant: "tertiary",
                                                        onClick: handleResendOtp,
                                                        disabled: isResendingOtp,
                                                        children: formatMessage({
                                                            id: 'Auth.form.button.resendOtp',
                                                            defaultMessage: isResendingOtp ? 'Resending...' : 'Resend OTP'
                                                        })
                                                    })
                                                ]
                                            }) : null
                                        ]
                                    })
                                ]
                            })
                        }),
                        children
                    ]
                }),
                /*#__PURE__*/ jsx(Flex, {
                    justifyContent: "center",
                    children: /*#__PURE__*/ jsx(Box, {
                        paddingTop: 4,
                        children: /*#__PURE__*/ jsx(Link, {
                            isExternal: false,
                            tag: NavLink,
                            to: "/auth/forgot-password",
                            children: formatMessage({
                                id: 'Auth.link.forgot-password',
                                defaultMessage: 'Forgot your password?'
                            })
                        })
                    })
                })
            ]
        })
    });
};

export { Login };
