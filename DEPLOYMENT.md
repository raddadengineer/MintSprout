# MintSprout Docker Deployment Guide

This guide explains how to deploy MintSprout using Docker and Docker Compose for self-hosting.

## Prerequisites

- Docker Engine 20.10 or later
- Docker Compose v2.0 or later
- At least 2GB RAM available
- At least 5GB storage space

## Quick Start

1. **Clone or download the MintSprout project files**

2. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   Edit the `.env` file and update:
   - `JWT_SECRET`: Generate a secure random string
   - `DATABASE_URL`: Update if using external PostgreSQL
   - `ALLOWED_ORIGINS`: Update with your domain

3. **Start the application**
   ```bash
   docker-compose up -d
   ```

4. **Access the application**
   - HTTP: http://localhost:8080
   - HTTPS (with nginx): https://localhost

## Configuration Options

### Basic Deployment (HTTP only)
```bash
docker-compose up -d postgres mintsprout
```
Access via: http://localhost:8080

### Production Deployment (with HTTPS)
1. **Generate SSL certificates**
   ```bash
   mkdir -p ssl
   openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
     -keyout ssl/nginx-selfsigned.key \
     -out ssl/nginx-selfsigned.crt \
     -subj "/CN=localhost"
   ```

2. **Start with nginx** (requires `ssl/nginx-selfsigned.crt` and `ssl/nginx-selfsigned.key` from step 1)
   ```bash
   docker compose --profile production up -d
   ```
   Access via: https://localhost (HTTP on port 80 redirects to HTTPS). The app remains available on http://localhost:8080 without the production profile.

### Custom Domain Setup
1. Update `.env` file:
   ```
   ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
   ```

2. Update `nginx.conf`:
   ```
   server_name yourdomain.com www.yourdomain.com;
   ```

3. Use valid SSL certificates (Let's Encrypt recommended)

## Database Architecture

MintSprout automatically uses PostgreSQL in production Docker deployments for persistent data storage. The application includes:

- Automatic database schema creation and initialization
- Initial family data with pre-configured accounts
- Persistent storage for all financial transactions and learning progress
- Database connection retry logic for container startup timing

## Initial family accounts

After deployment, only the **parent** account is created automatically in PostgreSQL:

**Parent account:**
- Username: `parent`
- Password: `password123`

**Child accounts:** Add from **Family → Add Child** in the app (name, age, username, password). Edit profiles or reset passwords anytime from the same screen.

**Recommended:** Change the parent password after setup (`npm run passwords:reset` in the app container).

## Database Management

### Data directories

Compose stores persistent data on the **host** (see `.env`):

| Path variable | Default | Contents |
|---------------|---------|----------|
| `MINTSPROUT_POSTGRES_DIR` | `./data/postgres` | Live PostgreSQL data |
| `MINTSPROUT_LOGS_DIR` | `./data/logs` | App logs |
| `MINTSPROUT_BACKUPS_DIR` | `./data/backups` | `daily/`, `weekly/`, and manual dumps |

### Automated backup (recommended)

The MintSprout app schedules backups internally (no separate container). Mount `MINTSPROUT_BACKUPS_DIR` on the app service (see `docker-compose.yml`).

- **Daily** — default 02:00 UTC → `backups/daily/` (retention configurable in Sprout & App, default 14 days)
- **Weekly** — default Sunday 03:00 UTC → `backups/weekly/` (default 8 weeks)

Configure or run immediately from **Controls → Sprout & App → Database backup & restore**.

Manual backup from the Docker host (writes to `./data/backups/manual` by default):

```bash
chmod +x scripts/backup-db.sh
./scripts/backup-db.sh manual
```

Optional environment variables:

- `MINTSPROUT_BACKUPS_DIR` — root backup folder (must be mounted on the app container)
- `BACKUP_DAILY_RETENTION_DAYS` / `BACKUP_WEEKLY_RETENTION_WEEKS` — first-boot defaults until saved in Sprout & App
- `BACKUP_RETENTION_DAYS` — alias for daily retention in `backup-db.sh`
- `DB_CONTAINER` — Postgres container name (default `mintsprout-db`)

**Restore from a plain SQL dump:**

```bash
gunzip -c data/backups/daily/mintsprout-YYYYMMDD-HHMMSS.sql.gz | docker exec -i mintsprout-db psql -U mintsprout -d mintsprout
```

### Migrating from Docker named volumes

If you previously used `postgres_data` / `app_logs` named volumes:

```bash
docker compose down
docker run --rm -v mintsprout_postgres_data:/from -v "$(pwd)/data/postgres":/to alpine sh -c "cp -a /from/. /to/"
# repeat for app_logs -> ./data/logs if needed
docker compose up -d
```

### Manual backup

```bash
docker exec mintsprout-db pg_dump -U mintsprout mintsprout > backup.sql
```

### Restore Database
```bash
cat backup.sql | docker exec -i mintsprout-db psql -U mintsprout -d mintsprout
```

### Access Database Console
```bash
docker exec -it mintsprout-db psql -U mintsprout -d mintsprout
```

## Monitoring and Logs

### View Application Logs
```bash
docker-compose logs -f mintsprout
```

### View Database Logs
```bash
docker-compose logs -f postgres
```

### Health Checks
- Application: http://localhost:8080/api/auth/me
- Database: Check with `docker-compose ps`

## Scaling and Performance

### Resource Limits
Add to `docker-compose.yml` under services:
```yaml
mintsprout:
  deploy:
    resources:
      limits:
        memory: 1G
        cpus: '0.5'
```

### Multiple App Instances
```bash
docker-compose up -d --scale mintsprout=3
```

## Security Considerations

### Production Checklist
- [ ] Change default passwords
- [ ] Use strong JWT secret (32+ characters)
- [ ] Enable HTTPS with valid certificates
- [ ] Set up firewall rules
- [ ] Regular database backups
- [ ] Monitor logs for suspicious activity
- [ ] Update Docker images regularly

### Environment Variables Security
Never commit `.env` files to version control. Use Docker secrets or external secret management for production.

## Troubleshooting

### Common Issues

**Application won't start:**
1. Check logs: `docker-compose logs mintsprout`
2. Verify database connection: `docker-compose logs postgres`
3. Ensure ports aren't in use: `netstat -tulpn | grep :8080`

**Login not working:**
1. Check JWT_SECRET is set
2. Verify database initialization completed
3. Check browser console for errors

**Database connection errors:**
1. Ensure PostgreSQL container is healthy: `docker-compose ps`
2. Check DATABASE_URL format
3. Verify network connectivity between containers

### Reset Everything

> **Warning:** `docker compose down` no longer removes data by default — data lives in `MINTSPROUT_POSTGRES_DIR`. To wipe the database, stop Compose and delete that folder after backing up. Run `./scripts/backup-db.sh manual` first if you need to keep family data.

```bash
docker-compose down -v
docker-compose up -d
```

## Updating MintSprout

1. **Backup your data**
2. **Pull latest changes**
3. **Rebuild containers**
   ```bash
   docker-compose down
   docker-compose build --no-cache
   docker-compose up -d
   ```

## Support

For issues and support:
- Check application logs first
- Verify all environment variables are set correctly
- Ensure sufficient system resources
- Check Docker and Docker Compose versions

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│     Nginx       │    │   MintSprout    │    │   PostgreSQL    │
│  (Reverse Proxy)│    │   Application   │    │    Database     │
│   Port 80/443   │────│    Port 5000    │────│    Port 5432    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

The application uses:
- **Node.js + Express** for the backend API
- **React + TypeScript** for the frontend
- **PostgreSQL** for data persistence
- **Nginx** for HTTPS termination and rate limiting
- **JWT tokens** for authentication