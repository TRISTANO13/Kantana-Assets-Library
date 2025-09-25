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

## 🐳 Running with Docker Desktop

If you prefer not to install Node.js locally you can run the whole stack with
Docker Desktop. The repository now includes a `docker-compose.yml` file that
starts both the API and the web application in two containers (Node.js for the
API and Nginx for the built frontend).

1. **Prepare an assets folder on your machine** (for example
   `C:\AssetsLibrary`) and add a few test files. In Docker Desktop go to
   **Settings → Resources → File Sharing** and make sure the drive or directory
   that contains this folder is shared, otherwise containers cannot read it.
2. **Clone the repository** and open a terminal in its root.
3. **Tell Docker which folder to mount (optional).** By default the compose file
   maps a local `./assets` directory. You can either create that directory next
   to the compose file or set an `ASSETS_HOST_DIR` variable in a `.env` file at
   the repository root, for example:

   ```env
   ASSETS_HOST_DIR=C:\\AssetsLibrary
   ```

   The value can point to any host folder that Docker Desktop is allowed to
   share. It will be mounted read-only inside the backend container at
   `/assets`.
   
4. **Launch the stack** with Docker Desktop:

   ```bash
   docker compose up --build
   ```

   The command builds the backend and frontend images, installs all
   dependencies, and starts both services.

5. **Open the application** in your browser at [http://localhost:8080](http://localhost:8080).
   The frontend is served by Nginx and proxies `/api` and `/files` to the
   backend container, so the UI works without additional configuration.
6. **Stop the containers** at any time with `Ctrl+C` in the terminal or by
   running `docker compose down` in another shell.

> **Note:** If you update the source code, re-run `docker compose up --build` so
> Docker rebuilds the images with your changes.

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
