// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {withDatabase, withObservables} from '@nozbe/watermelondb/react';
import {map} from 'rxjs/operators';

import {Preferences} from '@constants/preferences';
import {queryPreferencesByCategoryAndName} from '@queries/servers/preference';
import {observeConfigValue} from '@queries/servers/system';

import Settings from './settings';

import type {WithDatabaseArgs} from '@typings/database/database';

const enhanced = withObservables([], ({database}: WithDatabaseArgs) => {
    const siteName = observeConfigValue(database, 'SiteName');
    const morningGreetingEnabled = queryPreferencesByCategoryAndName(database, Preferences.CATEGORIES.MORNING_GREETING, 'enabled').observe().pipe(
        map((prefs) => {
            const value = prefs[0]?.value;
            if (value === undefined) {
                return true;
            }

            return value !== 'false';
        }),
    );

    return {
        siteName,
        morningGreetingEnabled,
    };
});

export default withDatabase(enhanced(Settings));
