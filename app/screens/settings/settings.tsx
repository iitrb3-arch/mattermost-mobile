// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {useIntl} from 'react-intl';
import {Platform} from 'react-native';

import CompassIcon from '@components/compass_icon';
import MenuDivider from '@components/menu_divider';
import SettingContainer from '@components/settings/container';
import SettingItem from '@components/settings/item';
import OptionItem from '@components/option_item';
import {Screens} from '@constants';
import {useServerDisplayName, useServerUrl} from '@context/server';
import {useTheme} from '@context/theme';
import useAndroidHardwareBackHandler from '@hooks/android_back_handler';
import useNavButtonPressed from '@hooks/navigation_button_pressed';
import {usePreventDoubleTap} from '@hooks/utils';
import {dismissModal, goToScreen, setButtons} from '@screens/navigation';
import {savePreference} from '@actions/remote/preference';
import DatabaseManager from '@database/manager';
import {Preferences} from '@constants/preferences';
import {getCurrentUserId} from '@queries/servers/system';
import {logError} from '@utils/log';
import type PreferenceType from '@typings/api/preferences';

import type {AvailableScreens} from '@typings/screens/navigation';

const CLOSE_BUTTON_ID = 'close-settings';

type SettingsProps = {
    componentId: AvailableScreens;
    morningGreetingEnabled?: boolean;
    siteName: string;
}

const Settings = ({componentId, morningGreetingEnabled = true, siteName}: SettingsProps) => {
    const theme = useTheme();
    const intl = useIntl();
    const serverUrl = useServerUrl();
    const serverDisplayName = useServerDisplayName();
    const [isGreetingEnabled, setIsGreetingEnabled] = useState<boolean>(morningGreetingEnabled);

    const serverName = siteName || serverDisplayName;

    const closeButton = useMemo(() => {
        return {
            id: CLOSE_BUTTON_ID,
            icon: CompassIcon.getImageSourceSync('close', 24, theme.centerChannelColor),
            testID: 'close.settings.button',
        };
    }, [theme.centerChannelColor]);

    const close = useCallback(() => {
        dismissModal({componentId});
    }, [componentId]);

    useEffect(() => {
        setIsGreetingEnabled(morningGreetingEnabled);
    }, [morningGreetingEnabled]);

    useEffect(() => {
        setButtons(componentId, {
            leftButtons: [closeButton],
        });
    }, []);

    useAndroidHardwareBackHandler(componentId, close);
    useNavButtonPressed(CLOSE_BUTTON_ID, componentId, close, []);

    const goToNotifications = usePreventDoubleTap(useCallback(() => {
        const screen = Screens.SETTINGS_NOTIFICATION;
        const title = intl.formatMessage({id: 'settings.notifications', defaultMessage: 'Notifications'});

        goToScreen(screen, title);
    }, [intl]));

    const goToDisplaySettings = usePreventDoubleTap(useCallback(() => {
        const screen = Screens.SETTINGS_DISPLAY;
        const title = intl.formatMessage({id: 'settings.display', defaultMessage: 'Display'});

        goToScreen(screen, title);
    }, [intl]));

    const goToAbout = usePreventDoubleTap(useCallback(() => {
        const screen = Screens.ABOUT;
        const title = intl.formatMessage({id: 'settings.about', defaultMessage: 'About {appTitle}'}, {appTitle: serverName});

        goToScreen(screen, title);
    }, [intl, serverName]));

    const goToAdvancedSettings = usePreventDoubleTap(useCallback(() => {
        const screen = Screens.SETTINGS_ADVANCED;
        const title = intl.formatMessage({id: 'settings.advanced_settings', defaultMessage: 'Advanced Settings'});

        goToScreen(screen, title);
    }, [intl]));

    const onMorningGreetingChange = usePreventDoubleTap(useCallback(async (value: boolean) => {
        setIsGreetingEnabled(value);

        try {
            const {database} = DatabaseManager.getServerDatabaseAndOperator(serverUrl);
            const userId = await getCurrentUserId(database);
            const pref: PreferenceType = {
                category: Preferences.CATEGORIES.MORNING_GREETING,
                name: 'enabled',
                user_id: userId,
                value: value ? 'true' : 'false',
            };

            await savePreference(serverUrl, [pref]);
        } catch (error) {
            setIsGreetingEnabled((prev) => !prev);
            logError('Failed to save morning greeting preference', error);
        }
    }, [serverUrl]));

    return (
        <SettingContainer testID='settings'>
            <SettingItem
                onPress={goToNotifications}
                optionName='notification'
                testID='settings.notifications.option'
            />
            <SettingItem
                onPress={goToDisplaySettings}
                optionName='display'
                testID='settings.display.option'
            />
            <SettingItem
                onPress={goToAdvancedSettings}
                optionName='advanced_settings'
                testID='settings.advanced_settings.option'
            />
            <SettingItem
                icon='information-outline'
                label={intl.formatMessage({id: 'settings.about', defaultMessage: 'About {appTitle}'}, {appTitle: serverName})}
                onPress={goToAbout}
                optionName='about'
                testID='settings.about.option'
            />
            {Platform.OS === 'android' && <MenuDivider/>}
            <OptionItem
                action={onMorningGreetingChange}
                label={intl.formatMessage({id: 'settings.morning_greeting', defaultMessage: 'Morning welcome message'})}
                selected={isGreetingEnabled}
                type='toggle'
                testID='settings.morning_greeting.toggle'
            />
        </SettingContainer>
    );
};

export default Settings;
