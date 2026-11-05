# Daily Wisdom

Offline Android app that shows positive quotes and lines from great books, with reminders you control.
It has no internet permission: all 155 quotes, each with a plain-English meaning, ship inside the app.

## Install
Copy `DailyWisdom.apk` to your phone, open it, and allow "install unknown apps" when asked. Android 7 or newer.

## Open in Android Studio
Open this folder (Android Studio Koala or newer) and press Run. No extra libraries are used.

## Build without Android Studio
On Ubuntu: `tools/build_apk.sh` (the packages it needs are listed at the top of the script).
`tools/compile-stubs` exists only for that script; Android Studio does not use it.

## Project map
- `Schedule.java`: works out the next time. Tests: `app/src/test/.../ScheduleTest.java`
- `Alarms.java`: books the next firing with Android
- `QuoteReceiver.java`: runs when a quote is due, and after a restart
- `Notifier.java`: notifications and tone channels
- `AlarmService.java`, `AlarmActivity.java`: alarm mode (rings, Stop, Snooze)
- `MainActivity.java`, `SettingsActivity.java`: the two screens
- `assets/quotes.json`: the quotes. Add your own here using the same format.

## Signing
The signing key is not stored in this repository. `tools/build_apk.sh` creates a new key if none exists; an app signed with a different key cannot update an installed copy.

## Quotes
Every line was machine-checked against Project Gutenberg texts of the named work, then lightly tidied
(capitals and punctuation). All works are in the public domain. The meanings are newly written summaries.
