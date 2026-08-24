# Dhebu

Dhebu is an Android-first personal finance application built with React Native and Expo. It helps users record income and expenses, organize transactions, review activity by date, and detect supported transaction notifications from selected Android apps.

> **Project status:** V1 release candidate. The main V1 feature set is implemented; final production regression testing and release validation are in progress.

## Features

- Personal onboarding with name, currency, and avatar selection
- Dashboard with income, expense, and balance summaries
- Manual income and expense entry
- Custom accounts and categories
- Transaction history with monthly grouping
- Calendar notes, reminders, and leave-day tracking
- Local user profile and appearance settings
- System, light, and dark themes
- Android notification-access status monitoring
- Selection of approved transaction-notification apps
- Automatic detection of supported transaction notifications
- Review, confirm, or dismiss detected pending transactions
- Native persistent notification queue for delivery when JavaScript is unavailable
- Local SQLite storage with versioned, data-preserving migrations

## Technology

- React Native
- Expo
- Expo Router
- TypeScript
- Expo SQLite
- Kotlin native Android modules
- Android Notification Listener Service
- EAS Build

## Requirements

- Node.js 20 or a compatible LTS release
- npm
- Android Studio and an Android SDK for local native builds
- Java Development Kit compatible with the project’s Android/Gradle version
- An Android device or emulator
- Expo/EAS CLI access for cloud builds

## Installation

Clone the repository and install its dependencies:

```bash
git clone https://github.com/NhonoLama/Dhebu.git
cd Dhebu
npm install
```

## Running the app

Dhebu contains custom Android native code for notification access and processing. The complete app cannot be tested in Expo Go.

Run a local Android development build:

```bash
npx expo run:android
```

After the development build is installed, start the Metro development server when needed:

```bash
npx expo start --dev-client
```

## Android notification setup

To let Dhebu process transaction notifications:

1. Open **Profile** in Dhebu.
2. Select **Open Notification Settings**.
3. Enable notification access for Dhebu in Android settings.
4. Return to Dhebu and select **Choose Apps**.
5. Enable only the apps whose transaction notifications Dhebu should process.

Selected package names are saved in native Android preferences and synchronized with the local SQLite database. Notifications from unselected packages are rejected before transaction parsing.

Notification layouts differ between banks, wallets, email providers, and Android versions. Every automatically detected transaction should be reviewed before confirmation.

## Local database

Dhebu stores V1 application data in a local SQLite database named `dhebu.db`.

The schema currently uses database version `8` and includes:

- Accounts
- Categories
- Transactions
- Calendar notes
- Leave settings and leave days
- Approved notification apps
- Pending detected transactions
- User profile

Database changes must be added as incremental migrations. Existing migration blocks must not be removed or rewritten after release because users may upgrade from any earlier database version.

Example:

```ts
if (version < 9) {
  // Apply the version 9 schema change safely.
}
```

When adding a column, check whether it already exists so interrupted or partially completed migrations can recover without deleting user data.

## Production builds

Create an Android preview build:

```bash
eas build --platform android --profile preview
```

Create an Android production build:

```bash
eas build --platform android --profile production
```

Before publishing a production build, test both of these installation paths:

1. Install over an older Dhebu version and confirm that existing user data remains available.
2. Perform a clean installation and confirm that onboarding and all database migrations complete successfully.

Also verify notification access, app selection, notification capture, pending-transaction review, manual transactions, reminders, theme changes, and application restart behavior on a physical Android device.

## Privacy

Dhebu V1 stores financial records and notification-processing preferences locally on the user’s device. Notification access should be enabled only for apps the user deliberately selects.

The app uses notification content solely to identify possible financial transactions. Users remain responsible for reviewing detected amounts, transaction types, categories, and dates before confirming them.

## Important development notes

- Keep the native `android` directory tracked because Dhebu contains required native changes.
- Do not commit signing keys, credentials, local environment files, build output, or Gradle caches.
- Changes to Kotlin modules, the Android manifest, package identifiers, or other native configuration require a new native build.
- Test database migrations without uninstalling first; uninstalling the app deletes its local data.
- Treat duplicate-notification protection and pending-transaction validation as data-integrity features and cover them with regression tests.

## V1 release checklist

- [x] Core finance screens and navigation
- [x] Local SQLite database and migrations
- [x] Accounts, categories, and transactions
- [x] Calendar notes and leave tracking
- [x] User profile and theme settings
- [x] Android notification access and listener lifecycle
- [x] Native notification queue
- [x] Approved notification-app selection
- [x] Pending-transaction review flow
- [ ] Complete final physical-device regression testing
- [ ] Verify duplicate-notification protection across supported sources
- [ ] Install and validate the final production build

## Repository

[github.com/NhonoLama/Dhebu](https://github.com/NhonoLama/Dhebu)

