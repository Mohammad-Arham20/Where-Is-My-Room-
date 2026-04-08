const express = require("express");

module.exports = function dashboardRoutes(store, authRequired) {
  const router = express.Router();

  router.get("/summary", authRequired, async (req, res) => {
    const summary = await store.getDashboardSummary(req.user.id);

    if (!summary) {
      return res.status(404).json({ message: "Dashboard data not found." });
    }

    return res.json(summary);
  });

  return router;
};
