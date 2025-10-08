// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useManagedConfig} from '@mattermost/react-native-emm';
import {useIsFocused, useNavigation, useRoute} from '@react-navigation/native';
import React, {useCallback, useEffect, useState} from 'react';
import {useIntl} from 'react-intl';
import {Alert, BackHandler, DeviceEventEmitter, StyleSheet, ToastAndroid, View} from 'react-native';
import Animated, {useAnimatedStyle, withTiming} from 'react-native-reanimated';
import {type Edge, SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';

import LocalConfig from '@assets/config.json';
import {savePreference} from '@actions/remote/preference';
import {refetchCurrentUser} from '@actions/remote/user';
import FloatingCallContainer from '@calls/components/floating_call_container';
import AnnouncementBanner from '@components/announcement_banner';
import ConnectionBanner from '@components/connection_banner';
import TeamSidebar from '@components/team_sidebar';
import {Navigation as NavigationConstants, Screens} from '@constants';
import {Preferences} from '@constants/preferences';
import {useServerUrl} from '@context/server';
import {useTheme} from '@context/theme';
import {useIsTablet} from '@hooks/device';
import PerformanceMetricsManager from '@managers/performance_metrics_manager';
import DatabaseManager from '@database/manager';
import {resetToTeams, openToS} from '@screens/navigation';
import NavigationStore from '@store/navigation_store';
import {isMainActivity} from '@utils/helpers';
import {logError} from '@utils/log';
import {tryRunAppReview} from '@utils/reviews';
import {addSentryContext} from '@utils/sentry';
import {getCurrentUserId} from '@queries/servers/system';

import AdditionalTabletView from './additional_tablet_view';
import CategoriesList from './categories_list';
import Servers from './servers';

import type {LaunchType} from '@typings/launch';
import type UserModel from '@typings/database/models/servers/user';
import type PreferenceType from '@typings/api/preferences';

type ChannelProps = {
    hasChannels: boolean;
    isCRTEnabled: boolean;
    hasTeams: boolean;
    hasMoreThanOneTeam: boolean;
    isLicensed: boolean;
    showToS: boolean;
    launchType: LaunchType;
    coldStart?: boolean;
    currentUserId?: string;
    hasCurrentUser: boolean;
    showIncomingCalls: boolean;
    currentUser?: UserModel;
    morningGreetingEnabled: boolean;
    lastMorningGreeting?: string;
};

const edges: Edge[] = ['bottom', 'left', 'right'];

const styles = StyleSheet.create({
    content: {
        flex: 1,
        flexDirection: 'row',
    },
    flex: {
        flex: 1,
    },
});

let backPressedCount = 0;
let backPressTimeout: NodeJS.Timeout|undefined;

// This is needed since the Database Provider is recreating this component
// when the database is changed (couldn't find exactly why), re-triggering
// the effect. This makes sure the rate logic is only handle on the first
// run. Most of the normal users won't see this issue, but on edge times
// (near the time you will see the rate dialog) will show when switching
// servers.
let hasRendered = false;

const ChannelListScreen = (props: ChannelProps) => {
    const theme = useTheme();
    const managedConfig = useManagedConfig<ManagedConfig>();
    const intl = useIntl();

    const isTablet = useIsTablet();
    const route = useRoute();
    const isFocused = useIsFocused();
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const serverUrl = useServerUrl();
    const params = route.params as {direction: string};
    const localAllowOtherServers = LocalConfig.AllowOtherServers !== false;
    const canAddOtherServers = localAllowOtherServers && managedConfig?.allowOtherServers !== 'false';
    const [hasShownGreeting, setHasShownGreeting] = useState(false);

    const handleBackPress = useCallback(() => {
        const isHomeScreen = NavigationStore.getVisibleScreen() === Screens.HOME;
        const homeTab = NavigationStore.getVisibleTab() === Screens.HOME;
        const focused = navigation.isFocused() && isHomeScreen && homeTab;

        if (isMainActivity()) {
            if (!backPressedCount && focused) {
                backPressedCount++;
                ToastAndroid.show(intl.formatMessage({
                    id: 'mobile.android.back_handler_exit',
                    defaultMessage: 'Press back again to exit',
                }), ToastAndroid.SHORT);

                if (backPressTimeout) {
                    clearTimeout(backPressTimeout);
                }
                backPressTimeout = setTimeout(() => {
                    clearTimeout(backPressTimeout!);
                    backPressedCount = 0;
                }, 2000);
                return true;
            } else if (isHomeScreen && !homeTab) {
                DeviceEventEmitter.emit(NavigationConstants.NAVIGATION_HOME);
                return true;
            }
        }
        return false;
    }, [intl, navigation]);

    const animated = useAnimatedStyle(() => {
        if (!isFocused) {
            let initial = 0;
            if (params?.direction) {
                initial = -25;
            }
            return {
                opacity: withTiming(0, {duration: 150}),
                transform: [{translateX: withTiming(initial, {duration: 150})}],
            };
        }
        return {
            opacity: withTiming(1, {duration: 150}),
            transform: [{translateX: withTiming(0, {duration: 150})}],
        };
    }, [isFocused, params]);

    const top = useAnimatedStyle(() => {
        return {height: insets.top, backgroundColor: theme.sidebarBg};
    }, [theme, insets.top]);

    useEffect(() => {
        if (!props.hasTeams) {
            resetToTeams();
        }
    }, [props.hasTeams]);

    useEffect(() => {
        const back = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
        return () => back.remove();
    }, [handleBackPress]);

    useEffect(() => {
        addSentryContext(serverUrl);
    }, [serverUrl]);

    useEffect(() => {
        if (props.showToS && !NavigationStore.isToSOpen()) {
            openToS();
        }
    }, [props.showToS]);

    useEffect(() => {
        if (!props.hasCurrentUser || !props.currentUserId) {
            refetchCurrentUser(serverUrl, props.currentUserId);
        }
    }, [props.currentUserId, props.hasCurrentUser]);

    // Init the rate app. Only run the effect on the first render if ToS is not open
    useEffect(() => {
        if (hasRendered) {
            return;
        }
        hasRendered = true;
        if (!NavigationStore.isToSOpen()) {
            tryRunAppReview(props.launchType, props.coldStart);
        }
    }, []);

    useEffect(() => {
        PerformanceMetricsManager.finishLoad('HOME', serverUrl);
        PerformanceMetricsManager.measureTimeToInteraction();
    }, []);

    useEffect(() => {
        const maybeShowGreeting = async () => {
            if (!props.morningGreetingEnabled || hasShownGreeting) {
                return;
            }

            if (!props.currentUser) {
                return;
            }

            const now = new Date();
            const hour = now.getHours();
            if (hour < 5 || hour >= 12) {
                return;
            }

            const todayKey = now.toISOString().slice(0, 10);
            if (props.lastMorningGreeting === todayKey) {
                return;
            }

            const name = props.currentUser.first_name?.trim().length ? props.currentUser.first_name.trim() : props.currentUser.username;
            const greetingName = name || intl.formatMessage({id: 'greeting.morning.fallbackName', defaultMessage: 'student'});

            Alert.alert(
                intl.formatMessage({id: 'greeting.morning.title', defaultMessage: 'Good morning'}),
                intl.formatMessage({id: 'greeting.morning.message', defaultMessage: 'Good morning, {name}! Welcome to school.'}, {name: greetingName}),
            );
            setHasShownGreeting(true);

            try {
                const {database} = DatabaseManager.getServerDatabaseAndOperator(serverUrl);
                const userId = await getCurrentUserId(database);
                const pref: PreferenceType = {
                    category: Preferences.CATEGORIES.MORNING_GREETING,
                    name: 'last_shown',
                    user_id: userId,
                    value: todayKey,
                };
                await savePreference(serverUrl, [pref]);
            } catch (error) {
                logError('Failed to persist morning greeting state', error);
            }
        };

        maybeShowGreeting();
    }, [
        props.morningGreetingEnabled,
        props.currentUser?.id,
        props.currentUser?.first_name,
        props.currentUser?.username,
        props.lastMorningGreeting,
        intl,
        serverUrl,
        hasShownGreeting,
    ]);

    return (
        <>
            <Animated.View style={top}/>
            <SafeAreaView
                style={styles.flex}
                edges={edges}
                testID='channel_list.screen'
            >
                <ConnectionBanner/>
                {props.isLicensed &&
                    <AnnouncementBanner/>
                }
                <View style={styles.content}>
                    {canAddOtherServers && <Servers/>}
                    <Animated.View
                        style={[styles.content, animated]}
                    >
                        <TeamSidebar
                            iconPad={canAddOtherServers}
                            hasMoreThanOneTeam={props.hasMoreThanOneTeam}
                        />
                        <CategoriesList
                            iconPad={canAddOtherServers && !props.hasMoreThanOneTeam}
                            isCRTEnabled={props.isCRTEnabled}
                            moreThanOneTeam={props.hasMoreThanOneTeam}
                            hasChannels={props.hasChannels}
                        />
                        {isTablet && props.hasChannels &&
                            <AdditionalTabletView/>
                        }
                        {props.showIncomingCalls && !isTablet &&
                            <FloatingCallContainer
                                showIncomingCalls={props.showIncomingCalls}
                                channelsScreen={true}
                            />
                        }
                    </Animated.View>
                </View>
            </SafeAreaView>
        </>
    );
};

export default ChannelListScreen;
