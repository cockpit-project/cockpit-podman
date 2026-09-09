/* SPDX-License-Identifier: LGPL-2.1-or-later */

import assert from "node:assert/strict";

const OriginalDateTimeFormat = Intl.DateTimeFormat;
const OriginalRelativeTimeFormat = Intl.RelativeTimeFormat;
let dateFormatterCount = 0;
let relativeFormatterCount = 0;

Intl.DateTimeFormat = function(...args) {
    dateFormatterCount++;
    return new OriginalDateTimeFormat(...args);
};
Intl.DateTimeFormat.prototype = OriginalDateTimeFormat.prototype;
Intl.RelativeTimeFormat = function(...args) {
    relativeFormatterCount++;
    return new OriginalRelativeTimeFormat(...args);
};
Intl.RelativeTimeFormat.prototype = OriginalRelativeTimeFormat.prototype;

try {
    const { cachedDateTimeSeconds, cachedDistanceToNow } = await import("../src/time-display.js?test=cache");
    const timestamp = Date.UTC(2026, 0, 2, 3, 4, 5);
    const locales = ["en-US", "de-DE", "fr-FR", "es-ES", "it-IT", "ja-JP", "ko-KR", "pt-BR"];

    assert.equal(cachedDateTimeSeconds(timestamp, "de-DE"),
                 new OriginalDateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "medium" }).format(timestamp));
    assert.equal(cachedDateTimeSeconds(timestamp, "de-DE"),
                 new OriginalDateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "medium" }).format(timestamp));
    assert.equal(dateFormatterCount, 1);

    assert.equal(cachedDistanceToNow(Date.now() - 2 * 60 * 60 * 1000, "en-US", text => text),
                 new OriginalRelativeTimeFormat("en-US", { numeric: "auto" }).format(-2, "hour"));
    assert.equal(cachedDistanceToNow(Date.now() - 2 * 60 * 60 * 1000, "en-US", text => text),
                 new OriginalRelativeTimeFormat("en-US", { numeric: "auto" }).format(-2, "hour"));
    assert.equal(relativeFormatterCount, 1);

    // The cache is bounded to eight locales and uses LRU order. Touch the
    // first locale, add a ninth, then confirm the least recently used entry
    // is reconstructed when it is requested again.
    for (const locale of locales)
        cachedDateTimeSeconds(timestamp, locale);
    assert.equal(dateFormatterCount, 8);
    cachedDateTimeSeconds(timestamp, locales[0]);
    assert.equal(dateFormatterCount, 8);
    cachedDateTimeSeconds(timestamp, "zh-CN");
    assert.equal(dateFormatterCount, 9);
    cachedDateTimeSeconds(timestamp, locales[1]);
    assert.equal(dateFormatterCount, 10);

    console.log("time-display fixtures: PASS");
} finally {
    Intl.DateTimeFormat = OriginalDateTimeFormat;
    Intl.RelativeTimeFormat = OriginalRelativeTimeFormat;
}
