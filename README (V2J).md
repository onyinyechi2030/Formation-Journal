# Daily Formation Journal V2

This is a mobile-first Firebase web app for a private journal with:
- Google sign-in
- Firestore sync across devices
- weekly exercise planning by weekday
- meal planning
- recurring personal goals
- weekly / monthly / yearly goals
- ranked daily goals
- goal locking with up to 2 revisions after lock
- evening examination with selectable contributing factors
- simple insights and trends
- installable PWA shell for Android home screen access

## Files
- `index.html` — app shell
- `styles.css` — styling
- `app.js` — app logic + Firebase integration
- `manifest.json` — PWA manifest
- `sw.js` — simple service worker
- `firestore.rules` — starter Firestore security rules

## Firebase setup
1. Create a Firebase project.
2. Add a **Web app** in the Firebase console.
3. Turn on **Authentication > Sign-in method > Google**.
4. Create **Cloud Firestore** in production mode.
5. In Firestore Rules, publish the contents of `firestore.rules`.
6. Copy your Firebase web config into `app.js`.
7. Host these files with Firebase Hosting, Netlify, or GitHub Pages.

## Strong recommendation
Use **Firebase Hosting** for the easiest setup, because the app is already using Firebase. GitHub Pages or Netlify also work.

## Security notes
Google sign-in is good authentication, but it is not enough by itself. The app should be protected with Firestore Security Rules so only your authenticated user can read and write your journal data. Firebase’s official docs recommend using Firebase Authentication together with Cloud Firestore Security Rules for web apps. citeturn460537search1turn460537search5turn460537search8

Firestore also supports offline persistence for web, mobile, and Apple platforms, caching active data locally and syncing changes when the device reconnects. citeturn460537search0

If you want stronger account protection, you can also enable multi-factor authentication on the Google account you use with Firebase Authentication.

## Android home screen install
After you host the app and open the hosted URL in Chrome on Android, Chrome should offer an install or add-to-home-screen option because the app includes a manifest and service worker.

## Suggested next upgrades
- optional local PIN/privacy gate
- better charts on the Insights tab
- weekly review flow
- custom icon set
- richer validation in Firestore rules
