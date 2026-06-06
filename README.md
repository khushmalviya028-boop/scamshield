# ScamShield

**India's scam app detector — verify before you trust**

---

## Overview

ScamShield helps users verify whether a lending or finance app is legitimate before they hand over personal data or take a loan. It cross-references apps against the RBI's Digital Lending App (DLA) registry, analyses permission patterns, aggregates community-reported scam signals, and produces a transparent risk score with plain-English reasoning.

Core verification checks:
- **RBI gate**: Is the app listed in the RBI's official DLA directory?
- **Permission analysis**: Does the app request SMS, contacts, or location beyond what a lender needs?
- **Age signal**: Apps published fewer than 30 days ago carry elevated risk.
- **Policy check**: Does the app have a privacy policy?
- **Community reports**: Weighted count of user-submitted scam reports.

ScamShield never labels an app "a scam" as a statement of fact. It outputs a risk tier (Safe / Caution / High Risk) with transparent, auditable reasoning.

---

## Architecture

```
scamshield/
├── engine/       TypeScript scoring engine (pure functions, unit-tested)
├── backend/      Node.js/Express API + SQLite + RBI dataset
├── apps/mobile/  React Native + Expo (iOS + Android)
└── ingestion/    Python RBI data scraper
```

The engine is a dependency of the backend and is kept separate to enable isolated unit testing of scoring logic without standing up the full API.

---

## Quick Start: Test on iPhone NOW

### Step 1: Install Expo Go

Install **Expo Go** from the App Store on your iPhone.
- Search "Expo Go" in the App Store, or visit: https://apps.apple.com/app/expo-go/id982107779

### Step 2: Start the backend

```bash
cd backend
npm install
npm run dev
# Backend starts on http://localhost:3001
```

### Step 3: Find your Mac's local IP

```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
# Look for something like 192.168.1.42
```

### Step 4: Update the mobile app config

Edit `apps/mobile/src/config.ts` and set `LOCAL_IP` to your Mac's IP address.

### Step 5: Start the mobile app

```bash
cd apps/mobile
npm install
npx expo start
# A QR code will appear in the terminal
```

### Step 6: Scan the QR code

Open Expo Go on your iPhone and scan the QR code. The app will load instantly.

> **iPhone and Mac must be on the same WiFi network.**

---

## Test on Android

Same steps as iPhone. Scan the QR code with the **Expo Go** Android app from the Google Play Store.

Or use an Android Studio emulator:

```bash
npx expo start --android
```

---

## Backend API

The backend runs at `http://localhost:3001`.

| Endpoint | Method | Description |
|---|---|---|
| `/api/health` | GET | Health check |
| `/api/verify` | POST | Verify an app (full score) |
| `/api/reports` | POST | Submit community report |
| `/api/demo/safe` | GET | Demo: safe app verdict |
| `/api/demo/caution` | GET | Demo: caution verdict |
| `/api/demo/high-risk` | GET | Demo: high-risk verdict |

### POST /api/verify example

```bash
curl -X POST http://localhost:3001/api/verify \
  -H "Content-Type: application/json" \
  -d '{
    "appName": "QuickRupee Fast Loan",
    "isFinanceApp": true,
    "permissions": ["READ_CONTACTS", "READ_SMS", "CAMERA"],
    "publishedDaysAgo": 7,
    "hasPrivacyPolicy": false,
    "communityReports": 42
  }'
```

---

## RBI Data Ingestion

The ingestion script fetches the RBI's Digital Lending App directory and writes a structured JSON file to `backend/data/rbi_dla_dataset.json`.

```bash
cd ingestion
pip install -r requirements.txt

# Fetch live data from RBI
python3 scrape_rbi.py

# Use test fixture — no network needed (for development and CI)
python3 scrape_rbi.py --test

# Override output path
python3 scrape_rbi.py --output /tmp/rbi_test.json

# Verbose output (shows each record as processed)
python3 scrape_rbi.py --verbose
```

The ingestion script auto-detects the data format (CSV, XLSX, or HTML table), normalises app names for fuzzy matching, and de-duplicates records by normalised name.

Run daily via cron to keep the dataset current:

```bash
# Example crontab entry — runs at 03:00 daily
0 3 * * * cd /path/to/scamshield/ingestion && python3 scrape_rbi.py >> /var/log/scamshield-ingestion.log 2>&1
```

---

## Run the Scoring Engine Tests

```bash
cd engine
npm install
npm test
```

The engine is pure TypeScript with no external dependencies (except Jest). Each scoring rule is individually unit-tested to prevent regressions when weights are tuned.

---

## Android Install-Watcher

The native Android module (`apps/mobile/android/`) detects newly installed apps and immediately sends a ScamShield verification prompt via a high-priority notification. Users can tap the notification to run a full check before opening the app.

See `apps/mobile/android/AndroidManifest_additions.xml` for integration instructions.

Key files:
- `InstallWatcherReceiver.kt` — listens for `ACTION_PACKAGE_ADDED`, posts notification
- `BootReceiver.kt` — placeholder for post-reboot service restart

> **Requires an Expo development build** (not Expo Go, which does not support custom native modules).
> Build command: `npx expo run:android`

---

## iOS Share Extension

On iOS, users can share any App Store listing directly to ScamShield via the native Share sheet:

1. Find the app on the App Store
2. Tap the Share button
3. Select ScamShield from the share options
4. Receive an instant verdict

> **Requires an Expo development build**.
> Build command: `npx expo run:ios` (requires macOS + Xcode 15+)

---

## Privacy and Compliance

**Minimum permissions**: ScamShield requests only the permissions necessary for each feature. The Android install watcher requires `QUERY_ALL_PACKAGES` (to read installed app names) and `POST_NOTIFICATIONS`. No user data is sold or shared with any third party.

**Defamation-safe wording**: ScamShield never asserts that an app "is a scam" as a matter of fact. All verdicts are expressed as risk tiers with transparent reasoning (e.g., "High Risk — not found in RBI's verified lender list, requests SMS access, no privacy policy"). This framing is factual and auditable.

**Platform policy**: `QUERY_ALL_PACKAGES` requires a Play Console declaration under the anti-fraud / security scanner use case. The iOS share extension uses documented, public-facing APIs.

See `PRIVACY.md` for the full privacy policy.

---

## Stack

| Layer | Technology |
|---|---|
| Scoring engine | TypeScript, Jest |
| Backend API | Node.js, Express, SQLite (better-sqlite3) |
| Mobile app | React Native, Expo SDK 51, React Navigation 6 |
| Data ingestion | Python 3.10+, BeautifulSoup4, pandas |
| Android native | Kotlin, AndroidX |
