# Dhebu

**A personal finance app that helps you track transactions before you forget them.**

Most personal finance apps depend on manual entry. During a busy day, it is easy to make payments, receive money, and forget to record every transaction. Missing even a few entries can leave users with an incomplete financial history and no clear record of where their money went.

Dhebu is designed to solve that problem. It automatically detects supported transaction notifications from the Android apps selected by the user and turns them into pending transactions for review. The user can verify the amount, transaction type, category, source, date, and notes before confirming each entry. This reduces forgotten entries while keeping every transaction organized and traceable.

Users can also add transactions manually, manage accounts and categories, review monthly activity, and keep personal financial records in one place. Beyond finance, Dhebu includes a calendar for future notes and reminders, plus leave tracking so users can record leave days and see how many days remain.

> **Project status:** V1 release candidate. The main V1 feature set is implemented; final production regression testing and release validation are in progress.

## Two main real-life solutions

### 1. Track daily transactions before they are forgotten

People often make several payments or receive money throughout the day but forget to enter every transaction manually. Dhebu detects supported transaction notifications from selected Android apps and prepares them as pending transactions. The user reviews the details before confirming them, creating a more complete and traceable financial history without relying only on memory.

### 2. Remember future tasks and track remaining leave

Important payments, appointments, deadlines, and personal tasks are also easy to forget. Dhebu lets users add calendar notes and schedule reminders for future dates and times. Its leave tracker records leave taken and shows the remaining leave balance, removing the need to calculate or remember it separately.

## App features

### Finance and transactions

- Dashboard with income, expense, and balance summaries
- Manual income and expense entry
- Automatic detection of supported transaction notifications
- Pending transaction review before confirmation
- Confirm or dismiss detected transactions
- Custom accounts and income or expense categories
- Monthly transaction history
- Transaction details including amount, type, category, source, date, and notes

### Calendar and leave management

- Notes attached to specific calendar dates
- Scheduled reminders for future dates and times
- Leave allowance configuration
- Leave records for selected dates
- Used and remaining leave tracking

### Personalization and interface

- Personal onboarding with name, currency, and avatar selection
- Local user profile settings
- System, light, and dark themes
- Dashboard, calendar, add transaction, history, and profile navigation

### Notification processing

- Android notification-access status monitoring
- Selection of approved transaction-notification apps
- Native filtering of notifications from unselected apps
- Persistent native notification queue when JavaScript is unavailable
- Duplicate-notification protection

### Local data

- Local SQLite storage
- Versioned, data-preserving database migrations
- On-device transaction and preference storage

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
