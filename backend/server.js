require("dotenv").config();

const path = require("path");
const express = require("express");
const compression = require("compression");
const DataStore = require("./models/dataStore");
const createAuthMiddleware = require("./middleware/auth");
const authRoutes = require("./routes/auth");
const listingRoutes = require("./routes/listings");
const roommateRoutes = require("./routes/roommates");
const dashboardRoutes = require("./routes/dashboard");
const chatRoutes = require("./routes/chats");

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "pg-roommate-finder-secret";
const FRONTEND_DIR = path.resolve(__dirname, "../frontend");

function staticAssetHeaders(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === ".html") {
    res.setHeader("Cache-Control", "no-cache");
    return;
  }

  if ([".css", ".js", ".png", ".jpg", ".jpeg", ".webp", ".svg", ".ico"].includes(ext)) {
    res.setHeader("Cache-Control", "public, max-age=604800, immutable");
  }
}

async function start() {
  const app = express();
  const store = new DataStore();
  const authRequired = createAuthMiddleware(JWT_SECRET);

  await store.init();

  app.use(compression());
  app.use(express.json({ limit: "15mb" }));
  app.use(express.urlencoded({ extended: true, limit: "15mb" }));
  app.use(
    express.static(FRONTEND_DIR, {
      etag: true,
      lastModified: true,
      setHeaders: staticAssetHeaders,
    })
  );

  app.get("/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/auth", authRoutes(store, JWT_SECRET, authRequired));
  app.use("/api/listings", listingRoutes(store, authRequired));
  app.use("/api/roommates", roommateRoutes(store, authRequired));
  app.use("/api/dashboard", dashboardRoutes(store, authRequired));
  app.use("/api/chats", chatRoutes(store, authRequired));

  app.get("/", (req, res) => {
    res.sendFile(path.join(FRONTEND_DIR, "index.html"));
  });

  app.get(["/post", "/post.html"], (req, res) => {
    res.sendFile(path.join(FRONTEND_DIR, "post.html"));
  });

  app.get(["/details", "/details.html"], (req, res) => {
    res.sendFile(path.join(FRONTEND_DIR, "details.html"));
  });

  app.get(["/dashboard", "/dashboard.html"], (req, res) => {
    res.sendFile(path.join(FRONTEND_DIR, "dashboard.html"));
  });

  app.get(["/chats", "/chats.html"], (req, res) => {
    res.sendFile(path.join(FRONTEND_DIR, "chats.html"));
  });

  app.get(["/favorites", "/favorites.html"], (req, res) => {
    res.sendFile(path.join(FRONTEND_DIR, "favorites.html"));
  });

  app.get(["/profile", "/profile.html"], (req, res) => {
    res.sendFile(path.join(FRONTEND_DIR, "profile.html"));
  });

  app.use((err, req, res, next) => {
    console.error(err);
    if (err?.type === "entity.too.large" || err?.status === 413) {
      return res.status(413).json({
        message: "Uploaded image is too large. Please choose an image under 5MB.",
      });
    }

    const status = err?.status || 500;
    if (status >= 500) {
      return res.status(status).json({ message: "Something went wrong on the server." });
    }

    return res.status(status).json({ message: err?.message || "Request failed." });
  });

  app.listen(PORT, () => {
    console.log(`PG & Roommate Finder is running on http://localhost:${PORT}`);
  });
}

start().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
