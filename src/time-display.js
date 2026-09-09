/* SPDX-License-Identifier: LGPL-2.1-or-later */

// Intl formatter construction is relatively expensive and these functions
// are called once for every visible row on every render. Keep a small LRU per
// display format so changing the Cockpit language remains correct without
// allowing repeated language switches to grow the cache indefinitely.
const MAX_FORMATTER_CACHE = 8;
const dateTimeSecondsFormatters = new Map();
const relativeTimeFormatters = new Map();

const relativeUnits = [
    { name: "second", max: 60 },
    { name: "minute", max: 3600 },
    { name: "hour", max: 86400 },
    { name: "day", max: 86400 * 7 },
    { name: "week", max: 86400 * 30 },
    { name: "month", max: 86400 * 365 },
    { name: "year", max: Infinity },
];

const cachedFormatter = (cache, locale, create) => {
    const existing = cache.get(locale);
    if (existing) {
        cache.delete(locale);
        cache.set(locale, existing);
        return existing;
    }

    const formatter = create();
    cache.set(locale, formatter);
    while (cache.size > MAX_FORMATTER_CACHE)
        cache.delete(cache.keys().next().value);
    return formatter;
};

const dateTimeSecondsFormatter = locale => cachedFormatter(
    dateTimeSecondsFormatters,
    locale,
    () => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "medium" }),
);

const relativeTimeFormatter = locale => cachedFormatter(
    relativeTimeFormatters,
    locale,
    () => new Intl.RelativeTimeFormat(locale, { numeric: "auto" }),
);

export const cachedDateTimeSeconds = (timestamp, locale) =>
    dateTimeSecondsFormatter(locale).format(timestamp);

export const cachedDistanceToNow = (timestamp, locale, gettext) => {
    const timestampValue = timestamp?.valueOf?.() ?? timestamp;
    const secondsDiff = Math.round((timestampValue - Date.now()) / 1000);

    // Keep the same precision and translated short strings as Cockpit's
    // timeformat helper. Seconds are too precise for a display that does not
    // constantly re-render.
    if (secondsDiff <= 0 && secondsDiff > -60)
        return gettext("less than a minute ago");
    if (secondsDiff > 0 && secondsDiff < 60)
        return gettext("in less than a minute");

    const unitIndex = relativeUnits.findIndex(unit => unit.max > Math.abs(secondsDiff));
    const divisor = unitIndex ? relativeUnits[unitIndex - 1].max : 1;
    const unit = relativeUnits[unitIndex];
    return relativeTimeFormatter(locale).format(Math.round(secondsDiff / divisor), unit.name);
};
