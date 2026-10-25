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
Compose `api` service. From the repository root, with `.env.production` configured:

```sh
docker compose --env-file .env.production up -d --build --remove-orphans
docker compose --env-file .env.production ps
docker compose --env-file .env.production logs vidyamedic-web --tail=50
```

The VPS Nginx frontend upstream points to `http://127.0.0.1:8080`. The API is
bound to `127.0.0.1:3030`; the old `capar-web` service is replaced and
`--remove-orphans` removes its superseded container. In production, host Nginx
serves `vidyamedic.my.id` and
`www.vidyamedic.my.id` over HTTPS and proxies the API domain
`api.vidyamedic.my.id` to the API service. Containers bind only to host
loopback; see [`deploy/nginx/vidyamedic.conf`](../deploy/nginx/vidyamedic.conf)
and the VPS deployment guide.

Patient data is loaded from authenticated API responses; the app does not
generate substitute health measurements. The Rekomendasi & Keputusan page
reflects the backend's prediction availability and does not invent a forecast
when the backend withholds one.

The Laporan page can print the currently loaded history or export it as CSV.
Wearable RMSSD values are measurements derived from RR intervals and are not
calculated from daily check-ins.
