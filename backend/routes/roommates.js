const express = require("express");

const ALLOWED_GENDERS = ["Male", "Female", "Any"];

module.exports = function roommateRoutes(store, authRequired) {
  const router = express.Router();

  router.get("/", async (req, res) => {
    const posts = await store.getRoommatePosts();
    return res.json({ posts });
  });

  router.post("/", authRequired, async (req, res) => {
    const { location, budget, gender, habits, notes, contact } = req.body;

    if (!location || !budget || !gender || !habits || !notes?.trim() || !contact?.trim()) {
      return res.status(400).json({ message: "Please complete all roommate preference fields." });
    }

    if (!ALLOWED_GENDERS.includes(gender)) {
      return res.status(400).json({ message: "Please choose a valid gender preference." });
    }

    const user = await store.findUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const habitList = Array.isArray(habits)
      ? habits
      : String(habits)
          .split(",")
          .map((habit) => habit.trim())
          .filter(Boolean);

    const roommatePost = await store.createRoommatePost({
      userId: user.id,
      userName: user.name,
      location,
      budget,
      gender,
      habits: habitList,
      notes,
      contact,
    });

    return res.status(201).json({
      roommatePost,
      message: "Roommate preferences posted successfully.",
    });
  });

  router.get("/matches", authRequired, async (req, res) => {
    const matches = await store.getRoommateMatches(req.user.id);
    return res.json({ matches });
  });

  return router;
};
