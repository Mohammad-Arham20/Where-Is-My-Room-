const express = require("express");

const ALLOWED_LOCATIONS = ["Delhi", "Pune", "Bengaluru", "Hyderabad", "Jaipur", "Kota", "Rourkela"];
const ALLOWED_ROOM_TYPES = ["Single", "Double Sharing", "Triple Sharing", "Studio"];

module.exports = function listingRoutes(store, authRequired) {
  const router = express.Router();

  router.get("/", async (req, res) => {
    const listings = await store.getListings();
    return res.json({ listings });
  });

  router.get("/favorites", authRequired, async (req, res) => {
    const favorites = await store.getUserFavoriteListings(req.user.id);
    return res.json({ favorites });
  });

  router.get("/favorites/ids", authRequired, async (req, res) => {
    const favoriteIds = await store.getUserFavoriteIds(req.user.id);
    return res.json({ favoriteIds });
  });

  router.get("/:id", async (req, res) => {
    const listing = await store.getListingById(req.params.id);

    if (!listing) {
      return res.status(404).json({ message: "Listing not found." });
    }

    return res.json({ listing });
  });

  router.post("/", authRequired, async (req, res) => {
    const {
      title,
      rent,
      location,
      roomType,
      genderPreference,
      furnished,
      description,
      contact,
      imageUrl,
    } = req.body;

    if (
      !title?.trim() ||
      !rent ||
      !location ||
      !roomType ||
      !genderPreference ||
      !furnished ||
      !description?.trim() ||
      !contact?.trim()
    ) {
      return res.status(400).json({ message: "Please complete all required listing fields." });
    }

    if (!ALLOWED_LOCATIONS.includes(location) || !ALLOWED_ROOM_TYPES.includes(roomType)) {
      return res.status(400).json({ message: "Please choose valid location and room type values." });
    }

    const user = await store.findUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const listing = await store.createListing({
      title,
      rent,
      location,
      roomType,
      genderPreference,
      furnished,
      description,
      contact,
      imageUrl,
      ownerId: user.id,
      ownerName: user.name,
    });

    return res.status(201).json({ listing, message: "Listing published successfully." });
  });

  router.post("/:id/favorite", authRequired, async (req, res) => {
    const listing = await store.getListingById(req.params.id);

    if (!listing) {
      return res.status(404).json({ message: "Listing not found." });
    }

    const result = await store.toggleFavorite(req.user.id, req.params.id);
    return res.json({
      ...result,
      message: result.favorite ? "Saved to favorites." : "Removed from favorites.",
    });
  });

  router.post("/:id/reviews", authRequired, async (req, res) => {
    const { rating, comment } = req.body;

    if (!rating || !comment?.trim()) {
      return res.status(400).json({ message: "Rating and comment are required." });
    }

    const user = await store.findUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const listing = await store.addReview(req.params.id, {
      userId: user.id,
      userName: user.name,
      rating,
      comment,
    });

    if (!listing) {
      return res.status(404).json({ message: "Listing not found." });
    }

    return res.status(201).json({ listing, message: "Review added successfully." });
  });

  router.delete("/:id", authRequired, async (req, res) => {
    const deletion = await store.deleteListing(req.params.id, req.user.id);

    if (deletion.status === "not_found") {
      return res.status(404).json({ message: "Listing not found." });
    }

    if (deletion.status === "forbidden") {
      return res
        .status(403)
        .json({ message: "You can remove only those listings that you posted." });
    }

    return res.json({
      listing: deletion.listing,
      message: "Listing removed successfully.",
    });
  });

  return router;
};
