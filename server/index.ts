import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { log } from "./log";
import { serveStatic } from "./serve-static";
import { ensureBaseSchema } from "./base-schema";
import { initializeDatabase } from "./db-init";
import { runMigrations, listFamilyIds } from "./migrations";
import { storage } from "./storage";
import { startAllowanceScheduler } from "./allowance-scheduler";
import { startBackupScheduler } from "./backup-scheduler";
import { loadAppConfig } from "./app-config";

const app = express();
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: false, limit: "50mb" }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Initialize database if using PostgreSQL (production or when DATABASE_URL is set)
  if (process.env.NODE_ENV === 'production' || process.env.DATABASE_URL) {
    try {
      await ensureBaseSchema();
      await runMigrations();
      await initializeDatabase();
      const { ensureCatalogLibrary } = await import("./catalog-seed");
      await ensureCatalogLibrary(storage);
      const familyIds = await listFamilyIds();
      const { ensureFamilyJobCategories } = await import("./job-categories");
      const { ensureFamilyCatalog } = await import("./catalog-seed");
      for (const familyId of familyIds) {
        await ensureFamilyJobCategories(storage, familyId);
        await ensureFamilyCatalog(storage, familyId);
      }
    } catch (error) {
      console.error("Failed to initialize database:", error);
      process.exit(1);
    }
  }

  if ("ready" in storage) {
    await storage.ready;
  }
  await loadAppConfig(storage);

  const server = await registerRoutes(app);
  startAllowanceScheduler(storage);
  startBackupScheduler(storage);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    console.error(err);
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    const devViteModule =
      process.env.MINTSPROUT_DEV_VITE_MODULE ?? "./dev-vite";
    const { setupVite } = await import(devViteModule);
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
