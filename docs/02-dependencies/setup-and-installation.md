# Setup and Installation

> **Purpose:** Zero to running locally — prerequisites, steps, verification.
> **Prerequisites:** [Stack and Toolchain](stack-and-toolchain.md)
> **Last validated:** 2026-03-15

## Prerequisites

- Node.js 22+ (for `--import tsx` and `node --test` support)
- npm 10+
- Python 3.x with Tkinter (for config tool only — optional for site dev)
- Git

## Steps

1. **Clone the repository**
   ```bash
   git clone <repo-url> "EG - TSX"
   cd "EG - TSX"
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create environment file**
   ```bash
   cp .env.example .env
   ```
   Fill in required values (see `docs/02-dependencies/environment-and-config.md` for each variable).

4. **Run the dev server**
   ```bash
   npm run dev
   ```
   Site available at http://localhost:4321

5. **Verify the environment**
   ```bash
   npm run type-check    # TypeScript validation
   npm run test:js       # Unit tests
   ```

## Config Tool (optional)

```bash
# Install Python dependencies
pip install -r config/app/requirements.txt

# Launch the Tk config GUI
pythonw config/eg-config.pyw

# Or launch the React config shell
python config/launch-react-config.pyw
```

## Content Data

Product data (366 JSON files) and article content (147 MDX files) are checked into the repository under `src/content/`. No seed data or database setup is required for local development.

## Database (optional — for search)

Search requires a PostgreSQL database. See `scripts/schema.sql` for the schema and `docs/05-operations/db-sync.md` for the sync pipeline. Without a database, the search endpoint returns empty results but the rest of the site works.

## Related Documents

- [Environment and Config](environment-and-config.md) — all env vars explained
- [DB Sync](../05-operations/db-sync.md) — search database setup
