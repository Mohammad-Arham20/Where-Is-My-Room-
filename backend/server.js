const path = require("path");
const express = require("express");
const DataStore = require("./models/dataStore");
const createAuthMiddleware = require("./middleware/auth");
const authRoutes = require("./routes/auth");
const listingRoutes = require("./routes/listings");
const roommateRoutes = require("./routes/roommates");
const dashboardRoutes = require("./routes/dashboard");

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "pg-roommate-finder-secret";
const FRONTEND_DIR = path.resolve(__dirname, "../frontend");

async function start() {
  const app = express();
  const store = new DataStore();
  const authRequired = createAuthMiddleware(JWT_SECRET);

  await store.init();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(express.static(FRONTEND_DIR));

  app.get("/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/auth", authRoutes(store, JWT_SECRET, authRequired));
  app.use("/api/listings", listingRoutes(store, authRequired));
  app.use("/api/roommates", roommateRoutes(store, authRequired));
  app.use("/api/dashboard", dashboardRoutes(store, authRequired));

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

  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ message: "Something went wrong on the server." });
  });

  app.listen(PORT, () => {
    console.log(`PG & Roommate Finder is running on http://localhost:${PORT}`);
  });
}

start().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
