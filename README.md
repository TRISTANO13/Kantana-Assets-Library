# 📚 Asset Library Project

This project provides a **self-hosted asset library** with a backend API (Node/Express) and a React frontend. It is designed to organize, preview, and tag digital assets such as textures, HDRIs, and project files.

---

## 🗂️ Project Structure

```
project-root/
├── backend/               # Node/Express server (API + static file serving)
│   ├── index.js           # Main API entry point
│   ├── .env               # Environment variables (ASSETS_ROOT, PORT, etc.)
│   └── ...
│
├── frontend/              # React + Vite application
│   ├── src/
│   │   ├── App.jsx        # Main React component
│   │   ├── main.jsx       # React bootstrap file
│   │   └── ...
│   └── index.html         # HTML entry point (mounts React into #root)
│
├── start.bat              # Windows script to start backend + frontend
├── stop.bat               # Windows script to stop backend + frontend
└── README.md              # Documentation (this file)
```

---

## ▶️ Starting the Project

At the root of the repository you will find two Windows batch scripts:

* **`start.bat`** → Launches the backend server and the frontend dev/build server.
* **`stop.bat`** → Gracefully stops both processes.

This makes it easier to run the project without manually typing commands.

---

## 🔧 Backend (API)

* Located in the **`backend/`** folder.
* Built with **Node.js + Express**.
* Exposes REST endpoints such as:

  * `GET /api/assets?dir=subdir` → Returns assets and tags for a given directory.
  * `GET /files/*` → Serves raw files directly.
* Root directory for assets is defined in `.env` via `ASSETS_ROOT`.

---

## 🎨 Frontend (React)

* Located in the **`frontend/`** folder.
* Built with **React + Vite + TailwindCSS**.
* Fetches data from the backend (`/api/assets`).
* Provides:

  * Browsing folders and assets.
  * Image previews and lightbox.
  * Tag sidebar with filtering and sorting.
  * Dark mode with system preference + local persistence.

---

## ⚙️ Environment Variables

In `backend/.env` you should define:

```
ASSETS_ROOT=C:/path/to/your/assets
PORT=5174
```

* **ASSETS\_ROOT** → Absolute path to the folder containing your assets.
* **PORT** → Port where the backend server listens.

---

## 📦 Dependencies

* **Backend:** Express, mime-types, dotenv
* **Frontend:** React, TailwindCSS, Vite

Install dependencies in each folder (`backend/` and `frontend/`) using `npm install`.

---

## 🚀 Deployment

* For development: run `start.bat`.
* For production:

  * Build the frontend with `npm run build` inside `frontend/`.
  * Serve the built files with the backend.

---

## 📄 License

This project is internal documentation & asset management. Adjust license information as needed for your organization.
