# Marchés Publics — Mobile App

A mobile app for browsing Moroccan public tenders (data in the style of **marchespublics.gov.ma**): search open consultations, filter them, follow deadlines, see award results, and save favourites and searches.

The project has two parts:

| Folder    | What it is                                                                 |
|-----------|----------------------------------------------------------------------------|
| `api/`    | Node.js + Express API that reads the tenders from MongoDB                  |
| `mobile/` | React Native app (Expo + TypeScript) for Android and iOS, also runs on web |

The app never connects to MongoDB directly. It only talks to the API, so the database password never ships inside the app.

---

## Features

- **Consultations** — list of open tenders with infinite scroll and pull-to-refresh
- **Search** — full-text search on subject and buyer
- **Filters** — status, category, procedure, region, buyer, deadline range, estimated amount, "réservé PME"
- **Detail** — deadline countdown, key facts (estimation, caution, bid opening, site visit), documents, timeline
- **Attributions** — awarded / unsuccessful tenders with winner and amount
- **Favourites & saved searches** — stored on the phone

Not built yet: push notifications for saved searches (see [Roadmap](#roadmap)).

---

## Tech stack

**Mobile (`mobile/`)**
- [Expo](https://expo.dev) + React Native, TypeScript
- **Expo Router** — file-based navigation; each file in `mobile/src/app/` is a screen
- **TanStack Query** — data loading, caching, infinite scroll, pull-to-refresh
- **Zustand** + **AsyncStorage** — favourites and saved searches, stored on the device

**API (`api/`)**
- Node.js 22+
- Express 5
- Official MongoDB Node.js driver

---

## Project structure

```
marches-app/
├── api/
│   ├── src/
│   │   ├── fields.js      # maps app field names → your MongoDB field names
│   │   └── ...
│   ├── .env.example
│   └── package.json
└── mobile/
    ├── src/
    │   └── app/           # one file per screen (Expo Router)
    ├── app.json           # app name, icon, bundle IDs
    ├── eas.json           # build profiles (created by `eas build:configure`)
    ├── .env
    └── package.json
```

---

## Requirements

- **Node.js 22 or newer** — check with `node -v`
- **MongoDB** — local server or MongoDB Atlas
- **Expo Go** on your phone (App Store / Play Store) for development
- Optional: **Xcode** (iOS simulator, Mac only) or **Android Studio** (Android emulator)

---

## 1. Run the API

```bash
cd api
npm install
cp .env.example .env
```

Edit `api/.env`:

```env
MONGODB_URI=mongodb://localhost:27017      # or your Atlas connection string
MONGODB_DB=marches
CONSULTATIONS_COLLECTION=consultations
ATTRIBUTIONS_COLLECTION=attributions
CORS_ORIGINS=http://localhost:8081         # needed for the web version
```

Then:

```bash
npm run indexes   # creates the search and sort indexes (run once)
npm run dev       # starts the API on http://localhost:4000
```

You should see `MongoDB connected` and `API ready on http://localhost:4000`.
Check it by opening <http://localhost:4000/api/consultations> in a browser — you should get JSON.

**No data yet?** `npm run seed` adds sample tenders. It only runs on empty collections, so it won't touch real data.

### Connecting your own data

Edit only **`api/src/fields.js`**. Each line maps the name the app uses to the field in your documents, for example:

```js
objet: 'intitule',
```

Two rules for your data:
- Dates must be stored as real MongoDB dates, not text.
- Amounts must be numbers, not text.

---

## 2. Run the mobile app

```bash
cd mobile
npm install
```

Create `mobile/.env` with the address of the API:

```env
EXPO_PUBLIC_API_URL=http://192.168.1.10:4000
```

| Where the app runs   | Value to use                                  |
|----------------------|-----------------------------------------------|
| Physical phone       | Your computer's local IP (see below)          |
| iOS simulator        | `http://localhost:4000`                       |
| Android emulator     | `http://10.0.2.2:4000`                        |
| Web browser          | `http://localhost:4000`                       |

Find your computer's IP:
- **Mac:** `ipconfig getifaddr en0`
- **Windows:** `ipconfig` → *IPv4 Address*
- **Linux:** `hostname -I`

Start Expo:

```bash
npx expo start
```

Then:
- **Phone:** same Wi-Fi as the computer, no VPN. Scan the QR code (iPhone: Camera app; Android: Expo Go → *Scan QR code*).
- **iOS simulator:** press `i`
- **Android emulator:** start the virtual device first, then press `a`
- **Web:** press `w`

If macOS asks *"Allow node to accept incoming connections?"*, click **Allow**.

Keep **two terminals** open: one for the API, one for Expo.

---

## 3. Build an installable app (EAS Build)

Builds run in Expo's cloud — no Mac needed for Android, and no Android Studio needed at all.

### 3.1 Put the API online first

An installed app is used outside your Wi-Fi, so the API needs a public **https** address (release builds also block plain `http`).

1. Host the database on **MongoDB Atlas** (free tier available).
2. Deploy `api/` to a Node host (Render, Railway, Fly.io, or your own server) with the same environment variables as `api/.env`.
3. Check that `https://<your-api>/api/consultations` returns JSON.

### 3.2 Set the app identity

In `mobile/app.json`:

```json
{
  "expo": {
    "name": "Marchés Publics",
    "slug": "marches-app",
    "version": "1.0.0",
    "ios": { "bundleIdentifier": "ma.yourname.marches" },
    "android": { "package": "ma.yourname.marches" }
  }
}
```

The bundle ID / package name can't be changed after publishing.

### 3.3 Install EAS and configure

```bash
sudo npm install -g eas-cli
eas login
cd mobile
eas build:configure
```

Run `eas build:configure` **inside `mobile/`** (the folder with `app.json`).

### 3.4 Point the builds at the online API

In `mobile/eas.json`:

```json
{
  "build": {
    "preview": {
      "distribution": "internal",
      "android": { "buildType": "apk" },
      "env": { "EXPO_PUBLIC_API_URL": "https://your-api-address" }
    },
    "production": {
      "env": { "EXPO_PUBLIC_API_URL": "https://your-api-address" }
    }
  }
}
```

### 3.5 Build

```bash
# Android test APK — free, install directly on any Android phone
eas build -p android --profile preview

# iOS — requires an Apple Developer account ($99/year)
eas build -p ios --profile preview
```

### 3.6 Publish to the stores

```bash
eas build -p android --profile production   # .aab for Google Play
eas build -p ios --profile production

eas submit -p android   # Google Play Console account ($25 one-time)
eas submit -p ios       # App Store Connect / TestFlight
```

The stores also ask for screenshots, a description and a privacy policy URL.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| App shows *"Impossible de joindre le serveur"* | Open `http://YOUR-IP:4000/api/consultations` in the **phone's** browser. If it fails, the firewall is blocking port 4000 — allow Node.js. Check `EXPO_PUBLIC_API_URL`. |
| Changed `.env` but nothing changed | Stop Expo (Ctrl + C) and run `npx expo start --clear`. |
| QR code won't connect (office / public Wi-Fi) | Run `npx expo start --tunnel`. The API must still be reachable from the phone. |
| `MONGODB_URI is missing` | `.env` is not in `api/`, or it's saved as `.env.txt`. |
| Lists are empty but no error | Field names differ from the defaults — update `api/src/fields.js`. |
| `Error: ENOENT ... uv_cwd` | The terminal is inside a folder that was deleted or moved. Run `cd ~` (or open a new terminal), then `cd` back into the project. |
| `zsh: bad pattern: #` | zsh doesn't accept `#` comments pasted after commands. Run commands without the comments. |
| `npm error code EACCES` (cache contains root-owned files) | `sudo chown -R $(id -u):$(id -g) ~/.npm` |
| `Run this command inside a project directory` (EAS) | `cd` into `mobile/` — the folder with `app.json`. |
| `EJSONPARSE` / empty `package.json` | The project copy is damaged. Unzip a fresh copy into a new folder (e.g. `~/Projects`). |
| Web version errors | Install web support: `npm pkg set dependencies.react-native-web=~0.21.4 && npm install`, and keep `CORS_ORIGINS` in `api/.env`. |

---

## Roadmap

- [ ] Push notifications for saved searches and followed tenders (Expo Notifications + a scheduled job in the API)
- [ ] Deploy the API to a public host
- [ ] App icon and splash screen
- [ ] Store listings (Google Play, App Store)
