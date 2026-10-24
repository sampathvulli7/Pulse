# Pulse — Smart Personal Music Workstation

Pulse is a local-first, personal music workstation and Spotify playlist manager with Web Audio API DSP, a 10-band equalizer, real-time synchronized lyrics (LRCLIB), audio spectrum visualizer, and mobile Wi-Fi streaming.

---

## Quick Start

### 1. Launch Everything
From this folder (`~/Documents/Pulse`):
```bash
./start.sh
```
Or with npm:
```bash
npm start
```

### 2. Access Links
- **Desktop / Laptop**: [http://localhost:5173](http://localhost:5173)
- **Phone (Same Wi-Fi)**: Check terminal output for your Wi-Fi IP (e.g., `http://192.168.29.94:5173`)

---

## Directory Overview

- `backend/` — Express API, SQLite database (`backend/data/pulse.sqlite`), HTTP 206 streaming proxies, lyrics proxy.
- `frontend/` — React 19 + TypeScript + Vite + Tailwind CSS v4 glassmorphic workstation UI.
- `plans/` — System architecture and ER schema specifications.
- `shared/` — Shared TypeScript data models.
- `.agents/` — Spec-driven multi-agent workflow configuration.
