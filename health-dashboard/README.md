# Health Board

A single-page personal health dashboard styled like an airport departure board: food log with
AI-estimated macros, training checklist, sleep tracker, supplements, lift log, and streaks.
Data is stored locally in SQLite via a small Express backend.

## Setup

```bash
cd health-dashboard
npm install
cp .env.example .env
```

Open `.env` and add your Anthropic API key:

```
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

Get a key at https://console.anthropic.com/settings/keys. The key is only ever read
server-side (`server/anthropic.js` via `dotenv`) — it is never sent to the browser.

## Run

```bash
npm start
```

Then open **http://localhost:5050** (or the `PORT` you set in `.env`).

For auto-restart on file changes during development:

```bash
npm run dev
```

## How it works

- **Frontend**: plain HTML/CSS/JS in `public/` — no build step.
- **Backend**: Express server in `server/index.js`.
- **Macro estimation**: when you log a food entry, the backend sends your description to the
  Anthropic Messages API (`claude-sonnet-4-6`) and asks for calorie/protein/carb/fat estimates
  as JSON. See `server/anthropic.js`.
- **Storage**: SQLite database at `data/health.db` (created automatically, gitignored).
  - Training checklist, sleep, supplements, food log, and notes are stored **per day**, keyed by date.
  - The lift log (Bench Press / Squat / Overhead Press / Row-Pullup) is a **single running record**
    that persists across days — it's not reset each day.
- **Targets**: Normal day = 180g protein / 2600 kcal. Shift day = 160g protein / 2900 kcal.
  Toggling the day type at the top switches the accent color (amber ↔ teal) and the day's targets.

## Project structure

```
health-dashboard/
├── server/
│   ├── index.js       # Express app + routes
│   ├── db.js           # SQLite schema + connection
│   ├── dashboard.js    # business logic (totals, targets, streaks, feedback)
│   └── anthropic.js    # Claude macro-estimation call
├── public/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── data/                # SQLite db lives here (gitignored)
├── .env.example
└── package.json
```
