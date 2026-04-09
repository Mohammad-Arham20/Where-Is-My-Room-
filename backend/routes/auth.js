const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

function createToken(secret, userId) {
  return jwt.sign({ userId }, secret, { expiresIn: "7d" });
}

module.exports = function authRoutes(store, secret, authRequired) {
  const router = express.Router();

  router.post("/register", async (req, res) => {
    const { name, email, password } = req.body;

    if (!name?.trim() || !email?.trim() || !password?.trim()) {
      return res.status(400).json({ message: "Name, email, and password are required." });
    }

    if (password.trim().length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters." });
    }

    const existingUser = await store.findUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ message: "An account with that email already exists." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await store.createUser({ name, email, passwordHash });
    const token = createToken(secret, user.id);

    return res.status(201).json({ token, user });
  });

  router.post("/login", async (req, res) => {
    const { email, password } = req.body;

    if (!email?.trim() || !password?.trim()) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const user = await store.findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    return res.json({
      token: createToken(secret, user.id),
      user: store.sanitizeUser(user),
    });
  });

  router.get("/me", authRequired, async (req, res) => {
    const user = await store.findUserById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    return res.json({ user: store.sanitizeUser(user) });
  });

  router.get("/profile", authRequired, async (req, res) => {
    const user = await store.findUserById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    return res.json({
      user: store.sanitizeUser(user),
      profile: user.profile,
    });
  });

  router.put("/profile", authRequired, async (req, res) => {
    const nextName = String(req.body?.name ?? "").trim();
    if (!nextName) {
      return res.status(400).json({ message: "Name is required." });
    }

    const updatedUser = await store.updateUserProfile(req.user.id, req.body || {});
    if (!updatedUser) {
      return res.status(404).json({ message: "User not found." });
    }

    return res.json({
      message: "Profile updated successfully.",
      user: updatedUser,
      profile: updatedUser.profile,
    });
  });

  return router;
};
