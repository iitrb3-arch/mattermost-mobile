// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Alert, AlertButton, Linking} from 'react-native';
import {nativeApplicationVersion} from 'expo-application';
import coerce from 'semver/functions/coerce';
import gt from 'semver/functions/gt';

import {DEFAULT_LOCALE, getLocalizedMessage} from '@i18n';
import {logError} from '@utils/log';

const UPDATE_MANIFEST_URL = 'https://edu97.ir/app/version.json';

type RemoteVersionManifest = {
    version?: string;
    latest?: string;
    appVersion?: string;
    url?: string;
    downloadUrl?: string;
    link?: string;
};

export async function checkForUpdates() {
    try {
        const response = await fetch(UPDATE_MANIFEST_URL);
        if (!response.ok) {
            return;
        }

        const manifest: RemoteVersionManifest = await response.json();
        const rawRemoteVersion = manifest.version || manifest.latest || manifest.appVersion;
        const remoteVersion = rawRemoteVersion ? coerce(rawRemoteVersion)?.version : undefined;
        const currentVersion = coerce(nativeApplicationVersion)?.version;

        if (!remoteVersion || !currentVersion) {
            return;
        }

        if (!gt(remoteVersion, currentVersion)) {
            return;
        }

        const downloadUrl = manifest.url || manifest.downloadUrl || manifest.link;
        const title = getLocalizedMessage(DEFAULT_LOCALE, 'update.available.title', 'Update available');
        const messageTemplate = getLocalizedMessage(DEFAULT_LOCALE, 'update.available.message', 'Version {version} is available. You can download the latest update now.');
        const message = messageTemplate.replace('{version}', remoteVersion);
        const confirmText = getLocalizedMessage(DEFAULT_LOCALE, 'update.available.confirm', 'Update');
        const cancelText = getLocalizedMessage(DEFAULT_LOCALE, 'update.available.cancel', 'Later');

        const buttons: AlertButton[] = [{text: cancelText, style: 'cancel'}];
        if (downloadUrl) {
            buttons.push({
                text: confirmText,
                onPress: () => {
                    Linking.openURL(downloadUrl).catch((error) => logError('Failed to open update url', error));
                },
            });
        }

        Alert.alert(title, message, buttons, {cancelable: true});
    } catch (error) {
        logError('Failed to check for updates', error);
    }
}
