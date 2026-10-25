# Vidyamedic Web

React web app for patient-facing Vidyamedic with Dashboard, Monitoring,
Profil Kesehatan, Business Intelligence, AI & Deteksi Dini, Rekomendasi &
Keputusan, Laporan, and Perangkat & Privasi sections. It reuses the
authenticated `/api` patient endpoints provided by the existing backend.

## Run locally

```sh
npm install
npm run dev
```

The Vite development server runs at `http://localhost:3032` and proxies `/api`
requests to `http://localhost:3030`. Set `VITE_API_URL` when the API is hosted
at another base URL.

## Build

```sh
npm run build
npm run preview
```

## Run with Docker Compose

The repository's Compose configuration builds this app as the production
frontend, publishes it on host port `8080`, and proxies `/api/` requests to the
Compose `api` service. From the repository root:

```sh
docker compose up -d --build --remove-orphans
docker compose ps
docker compose logs vidyamedic-web --tail=50
```

The VPS Nginx frontend upstream can continue pointing to `http://localhost:8080`.
The old `capar-web` service is replaced; `--remove-orphans` removes its
superseded container from the Compose project.

Patient data is loaded from authenticated API responses; the app does not
generate substitute health measurements. The Rekomendasi & Keputusan page
reflects the backend's prediction availability and does not invent a forecast
when the backend withholds one.

The Laporan page can print the currently loaded history or export it as CSV.
Wearable RMSSD values are measurements derived from RR intervals and are not
calculated from daily check-ins.
