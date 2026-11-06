# Run the project with Docker Compose

This project runs as three containers: the React frontend, FastAPI backend, and MongoDB. MongoDB data is stored in the named `mongo_data` volume and survives container restarts.

## Start

From the project root, run:

```powershell
docker compose up --build -d
```

Open the app at <http://localhost:3000>. The API is available at <http://localhost:8000>, with interactive docs at <http://localhost:8000/api/docs>.

Check service status and logs:

```powershell
docker compose ps
docker compose logs -f backend
```

Stop the containers without deleting database contents:

```powershell
docker compose down
```

## Configuration

Compose accepts `FRONTEND_PORT`, `BACKEND_PORT`, `MONGO_PORT`, `DATABASE_NAME`, `ACCESS_TOKEN_EXPIRE_MINUTES`, and `JWT_SECRET` from the shell or a root `.env` file. MongoDB is published on `localhost:27017` by default so a backend running from the local Python venv can connect to it; the containerized backend continues to use the private Compose network. The default JWT secret is for local development only; set a strong private value before using the app beyond a local demo.

## Optional demo data

The backend starts without resetting or seeding the database. If you intentionally want to create the demo data, run:

```powershell
docker compose --profile demo-seed run --build --rm seed
```

The seed container uses the same backend image and Compose network as the API. It waits for MongoDB, then creates the demo admin, nominator, mentors, cohort, training and feedback snapshots, trainee locations/timezones, progress, feedback, TalentNext records, batches, sessions, and sample attendance.

**Warning:** `backend/seed.py` clears and recreates application data in the configured database, including batches, sessions, and attendance. Do not run this against a database whose data you need to keep.

To create or refresh only the demo nominator account without resetting other data, run:

```powershell
docker compose --profile demo-nominator run --build --rm demo-nominator
```

This uses `backend/create_demo_nominator.py` and creates or updates `nominator@example.com` with password `Nominator@123`. If a cohort exists, the script assigns the nominator to the most recently created cohort.

To remove containers and permanently delete the stored database volume:

```powershell
docker compose down --volumes
```
