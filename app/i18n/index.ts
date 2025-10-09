// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import moment from 'moment';
import {getLocales} from 'react-native-localize';
import 'moment/min/locales';

import en from '@assets/i18n/en.json';
import fa from '@assets/i18n/fa.json';
import {logError} from '@utils/log';

import availableLanguages from './languages';

const PRIMARY_LOCALE = 'fa';
const BRAND_NAME_PER_LOCALE: Record<string, string> = {
    en: 'Andisheh Hosseini Elementary',
    fa: 'دبستان اندیشه حسینی',
};
const MATTERMOST_REGEX = /Mattermost/gi;
const deviceLocale = getLocales()[0]?.languageTag || PRIMARY_LOCALE;
export const DEFAULT_LOCALE = getLocaleFromLanguage(deviceLocale);

function applyBranding(translations: {[x: string]: string}, locale: string) {
    const brandName = BRAND_NAME_PER_LOCALE[locale] || BRAND_NAME_PER_LOCALE[PRIMARY_LOCALE];

    return Object.fromEntries(
        Object.entries(translations).map(([key, value]) => {
            if (typeof value === 'string' && value.match(MATTERMOST_REGEX)) {
                return [key, value.replace(MATTERMOST_REGEX, brandName)];
            }

            return [key, value];
        }),
    );
}

function loadTranslation(locale?: string): {[x: string]: string} {
    try {
        let translations: {[x: string]: string};

        switch (locale) {
            case 'fa':
                require('@formatjs/intl-pluralrules/locale-data/fa');
                require('@formatjs/intl-numberformat/locale-data/fa');
                require('@formatjs/intl-datetimeformat/locale-data/fa');
                require('@formatjs/intl-listformat/locale-data/fa');
                require('@formatjs/intl-relativetimeformat/locale-data/fa');

                translations = fa;
                break;
            default:
                require('@formatjs/intl-pluralrules/locale-data/en');
                require('@formatjs/intl-numberformat/locale-data/en');
                require('@formatjs/intl-datetimeformat/locale-data/en');
                require('@formatjs/intl-listformat/locale-data/en');
                require('@formatjs/intl-relativetimeformat/locale-data/en');

                translations = en;
                break;
        }

        return applyBranding(translations, locale || PRIMARY_LOCALE);
    } catch (e) {
        logError('NO Translation found', e);
        return applyBranding(en, PRIMARY_LOCALE);
    }
}

export function getLocaleFromLanguage(lang: string) {
    const languageCode = lang.split('-')[0];
    const locale = availableLanguages[lang] || availableLanguages[languageCode] || PRIMARY_LOCALE;
    return locale;
}

export function resetMomentLocale(locale?: string) {
    moment.locale(locale?.split('-')[0] || DEFAULT_LOCALE.split('-')[0]);
}

export function getTranslations(lang: string) {
    const locale = getLocaleFromLanguage(lang);
    return loadTranslation(locale);
}

export function getLocalizedMessage(lang: string, id: string, defaultMessage?: string) {
    const locale = getLocaleFromLanguage(lang);
    const translations = getTranslations(locale);

    return translations[id] || defaultMessage || '';
}
