// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useManagedConfig} from '@mattermost/react-native-emm';
import React, {useCallback, useEffect, useMemo, useRef, useState, type RefObject} from 'react';
import {defineMessages, useIntl} from 'react-intl';
import {Keyboard, TextInput, TouchableOpacity, View} from 'react-native';

import {login} from '@actions/remote/session';
import Button from '@components/button';
import CompassIcon from '@components/compass_icon';
import FloatingTextInput from '@components/floating_input/floating_text_input_label';
import {MFA} from '@constants/screens';
import {useAvoidKeyboard} from '@hooks/device';
import {usePreventDoubleTap} from '@hooks/utils';
import {goToScreen, loginAnimationOptions, resetToHome} from '@screens/navigation';
import {getFullErrorMessage, getServerError, isErrorWithMessage, isServerError} from '@utils/errors';
import {changeOpacity, makeStyleSheetFromTheme} from '@utils/theme';

import type {LaunchProps} from '@typings/launch';
import type {KeyboardAwareScrollView} from 'react-native-keyboard-aware-scroll-view';

interface LoginProps extends LaunchProps {
    config: Partial<ClientConfig>;
    license: Partial<ClientLicense>;
    keyboardAwareRef: RefObject<KeyboardAwareScrollView>;
    serverDisplayName: string;
    theme: Theme;
}

export const MFA_EXPECTED_ERRORS = ['mfa.validate_token.authenticate.app_error', 'ent.mfa.validate_token.authenticate.app_error'];
const hitSlop = {top: 8, right: 8, bottom: 8, left: 8};

const getStyleSheet = makeStyleSheetFromTheme((theme: Theme) => ({
    container: {
        marginBottom: 24,
        gap: 24,
    },
    loginButtonContainer: {
        marginTop: 20,
    },
    endAdornment: {
        top: 2,
    },
}));

const messages = defineMessages({
    signIn: {
        id: 'login.signIn',
        defaultMessage: 'Log In',
    },
    signingIn: {
        id: 'login.signingIn',
        defaultMessage: 'Logging In',
    },
});

const isMFAError = (loginError: unknown): boolean => {
    const serverError = getServerError(loginError);
    if (serverError) {
        return MFA_EXPECTED_ERRORS.includes(serverError);
    }
    return false;
};

const LoginForm = ({config, extra, keyboardAwareRef, serverDisplayName, launchError, launchType, license, serverUrl, theme}: LoginProps) => {
    const styles = getStyleSheet(theme);
    const loginRef = useRef<TextInput>(null);
    const passwordRef = useRef<TextInput>(null);
    const intl = useIntl();
    const managedConfig = useManagedConfig<ManagedConfig>();
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | undefined>();
    const [loginId, setLoginId] = useState<string>('');
    const [password, setPassword] = useState<string>('');
    const [buttonDisabled, setButtonDisabled] = useState(true);
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    useAvoidKeyboard(keyboardAwareRef);

    const goToHome = useCallback((loginError?: unknown) => {
        const hasError = launchError || Boolean(loginError);
        resetToHome({extra, launchError: hasError, launchType, serverUrl});
    }, [extra, launchError, launchType, serverUrl]);

    const goToMfa = useCallback(() => {
        goToScreen(MFA, '', {goToHome, loginId, password, config, serverDisplayName, license, serverUrl, theme}, loginAnimationOptions());
    }, [config, goToHome, license, loginId, password, serverDisplayName, serverUrl, theme]);

    const getLoginErrorMessage = useCallback((loginError: unknown) => {
        if (isServerError(loginError)) {
            const errorId = loginError.server_error_id;
            if (errorId === 'api.user.login.invalid_credentials_email_username' || (!isErrorWithMessage(loginError) && typeof loginError !== 'string')) {
                return intl.formatMessage({
                    id: 'login.invalid_credentials',
                    defaultMessage: 'The national ID you entered is incorrect',
                });
            }
        }

        return getFullErrorMessage(loginError);
    }, [intl]);

    const checkLoginResponse = useCallback((data: LoginActionResponse) => {
        const {failed, error: loginError} = data;
        if (failed && isMFAError(loginError)) {
            goToMfa();
            setIsLoading(false);
            return false;
        }

        if (failed && loginError) {
            setIsLoading(false);
            setError(getLoginErrorMessage(loginError));
            return false;
        }

        setIsLoading(false);

        return true;
    }, [getLoginErrorMessage, goToMfa]);

    const signIn = useCallback(async () => {
        const result: LoginActionResponse = await login(serverUrl!, {serverDisplayName, loginId, password, config, license});
        if (checkLoginResponse(result)) {
            goToHome(result.error);
        }
    }, [checkLoginResponse, config, goToHome, license, loginId, password, serverDisplayName, serverUrl]);

    const preSignIn = usePreventDoubleTap(useCallback(async () => {
        setIsLoading(true);

        Keyboard.dismiss();
        signIn();
    }, [signIn]));

    const focusPassword = useCallback(() => {
        passwordRef?.current?.focus();
    }, []);

    const onLogin = useCallback(() => {
        Keyboard.dismiss();
        preSignIn();
    }, [preSignIn]);

    const onLoginChange = useCallback((text: string) => {
        setLoginId(text);
        if (error) {
            setError(undefined);
        }
    }, [error]);

    const onPasswordChange = useCallback((text: string) => {
        setPassword(text);
        if (error) {
            setError(undefined);
        }
    }, [error]);

    const togglePasswordVisiblity = useCallback(() => {
        setIsPasswordVisible((prevState) => !prevState);
    }, []);

    // useEffect to set userName for EMM
    useEffect(() => {
        const setEmmUsernameIfAvailable = async () => {
            if (managedConfig?.username) {
                setLoginId(managedConfig.username);
            }
        };

        setEmmUsernameIfAvailable();
    }, [managedConfig?.username]);

    useEffect(() => {
        if (loginId && password) {
            setButtonDisabled(false);
            return;
        }
        setButtonDisabled(true);
    }, [loginId, password]);

    const proceedButton = (
        <View style={styles.loginButtonContainer}>
            <Button
                disabled={buttonDisabled}
                onPress={onLogin}
                size='lg'
                testID={buttonDisabled ? 'login_form.signin.button.disabled' : 'login_form.signin.button'}
                text={intl.formatMessage(isLoading ? messages.signingIn : messages.signIn)}
                showLoader={isLoading}
                theme={theme}
            />
        </View>
    );

    const endAdornment = useMemo(() => (
        <TouchableOpacity
            onPress={togglePasswordVisiblity}
            hitSlop={hitSlop}
            style={styles.endAdornment}
        >
            <CompassIcon
                name={isPasswordVisible ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={changeOpacity(theme.centerChannelColor, 0.64)}
            />
        </TouchableOpacity>
    ), [isPasswordVisible, styles.endAdornment, theme.centerChannelColor, togglePasswordVisiblity]);

    return (
        <View style={styles.container}>
            <FloatingTextInput
                rawInput={true}
                blurOnSubmit={false}
                autoComplete='off'
                disableFullscreenUI={true}
                enablesReturnKeyAutomatically={true}
                error={error ? ' ' : ''}
                keyboardType='number-pad'
                label={intl.formatMessage({id: 'login.national_id', defaultMessage: 'National ID'})}
                onChangeText={onLoginChange}
                onSubmitEditing={focusPassword}
                ref={loginRef}
                returnKeyType='next'
                hideErrorIcon={true}
                testID='login_form.username.input'
                theme={theme}
                value={loginId}
            />
            <FloatingTextInput
                rawInput={true}
                blurOnSubmit={false}
                autoComplete='current-password'
                disableFullscreenUI={true}
                enablesReturnKeyAutomatically={true}
                error={error}
                keyboardType='number-pad'
                label={intl.formatMessage({id: 'login.national_id', defaultMessage: 'National ID'})}
                onChangeText={onPasswordChange}
                onSubmitEditing={onLogin}
                ref={passwordRef}
                returnKeyType='join'
                secureTextEntry={!isPasswordVisible}
                testID='login_form.password.input'
                theme={theme}
                value={password}
                endAdornment={endAdornment}
            />
            {proceedButton}
        </View>
    );
};

export default LoginForm;
