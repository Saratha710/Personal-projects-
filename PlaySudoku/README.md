# Play Sudoku

A Sudoku game for Android that teaches as you play. Web app (`www/`) inside a Capacitor Android project (`android/`).

## Get the test APK

### Option 1: GitHub (nothing to install)
1. Open the repository's **Actions** tab on github.com and select **Build Play Sudoku**.
2. Open the latest run and wait for it to finish, about 5 to 10 minutes.
3. Under **Artifacts**, download **play-sudoku-test-apk**.
4. Unzip it, copy the `.apk` to your phone and install it. Android will ask you to allow installs from that app.

The build runs whenever files in `PlaySudoku/` change. Its file is `.github/workflows/build-play-sudoku.yml` at the top of the repository.

### Option 2: Android Studio
1. Install Node.js 22 and the latest Android Studio.
2. In the `PlaySudoku` folder run `npm ci`, then `npx cap sync android`.
3. Open the `android` folder in Android Studio and let it finish syncing.
4. Choose **Build > Generate App Bundles or APKs > Generate APKs**.

## Testing tips
- Settings: tap the version line 7 times to turn on tester mode. It unlocks every level and simulates purchases.
- Before the game server is connected, Compete offers a computer opponent and a test challenge so you can try the match screens.
- Real live matches need the game server below and two phones on the Compete page.
- `npm test` checks the engine, all 1,000 puzzles, every trick example and the scoreboard requests. `tests/ui-*.cjs` run the app in a browser, including two-player matches against a simulated server.

## Before uploading to Google Play
1. **Name and app id.** Check that "Play Sudoku" is free to use. Change `appId` in `capacitor.config.json` and `applicationId` and `namespace` in `android/app/build.gradle` if you want another id. The id can never change after your first upload.
2. **Turn off tester mode.** Set `allowTesterMode: false` in `www/js/config.js`.
3. **Connect worldwide scores** (below). Sample players show until you do.
4. **Create the signing key** and keep a backup; losing it complicates every future update:
   `keytool -genkeypair -v -keystore upload.keystore -alias upload -keyalg RSA -keysize 2048 -validity 10000`
5. **Add four GitHub secrets:** `ANDROID_KEYSTORE_BASE64` (the keystore file in base64), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`. The build then also produces **play-sudoku-play-bundle**, the `.aab` file Play needs.
6. **Create the in-app products** in Play Console under Monetize:
   - `pro_unlimited`: one-time product, Unlimited Help
   - `hints_25`: one-time consumable product, 25 Help
   Purchases only work in a build installed from a Play testing track. A sideloaded APK cannot buy.
7. **Publish a privacy policy.** Edit `PRIVACY.md`, host it, and put the link in `privacyUrl` in `config.js` and in Play Console.
8. **Player names are user content.** Google Play expects a way to report or remove offensive names. Decide this before launch, or replace free-typed names with preset ones.
9. **Testing rule.** Personal developer accounts created after 13 November 2023 must run a closed test with at least 12 testers for 14 days in a row before production access.
10. Raise `versionCode` in `android/app/build.gradle` for every upload.

## Connect the game server (Firebase, free plan)
This turns on real live matches and worldwide Daily scores.
1. Create a project at console.firebase.google.com.
2. Under Authentication, enable the **Anonymous** sign-in method.
3. Add a **Web app** to the project and copy its API key.
4. Create a **Realtime Database** in locked mode. Paste `firebase/database.rules.json` into its Rules tab and publish. Copy the database URL.
5. Create a **Firestore database** in production mode. Paste `firebase/firestore.rules` into its Rules tab and publish. Copy the Project ID.
6. Put all three values into `firebase` in `www/js/config.js`, run `npx cap sync android`, and rebuild.

How live matches work: phones check for changes every 1.5 to 3 seconds while on the Compete page or in a match. Challenges reach people on the Compete page only; there are no phone notifications when the app is closed. The server decides who joined first and who won.

Scores and progress are sent from the phone, so a determined cheat could fake them. Before prizes or serious competition, add server-side checks. Finished matches stay in the database until you clear them.

## Changing the app
- Prices: set in Play Console.
- Help per puzzle, wins needed, product ids: `www/js/config.js`.
- Level colours: top of `www/css/app.css`. Board colours: the `.board` rule in the same file.
- Trick explanations: `www/js/lessons.js` and `www/js/engine.js`.
- New puzzles: `node tools/gen-bank.mjs <seed> <seconds> data/bank.json`, then `node tools/gen-examples.mjs`.
- After any change in `www/`, run `npx cap sync android`.
