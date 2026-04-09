const express = require("express");

module.exports = function chatRoutes(store, authRequired) {
  const router = express.Router();

  router.get("/", authRequired, async (req, res) => {
    const chats = await store.getChatSummaries(req.user.id);
    return res.json({ chats });
  });

  router.post("/start", authRequired, async (req, res) => {
    const requesterId = req.user.id;
    const listingId = String(req.body?.listingId || "").trim();
    let recipientId = String(req.body?.recipientId || "").trim();
    let listingTitle = "";

    if (listingId) {
      const listing = await store.getListingById(listingId);
      if (!listing) {
        return res.status(404).json({ message: "Listing not found." });
      }
      recipientId = listing.ownerId;
      listingTitle = listing.title;
    }

    if (!recipientId) {
      return res.status(400).json({ message: "Recipient is required to start a chat." });
    }

    if (recipientId === requesterId) {
      return res.status(400).json({ message: "You cannot start a chat with yourself." });
    }

    const recipient = await store.findUserById(recipientId);
    if (!recipient) {
      return res.status(404).json({ message: "Recipient not found." });
    }

    const chat = await store.startChat({
      requesterId,
      recipientId,
      listingId: listingId || null,
      listingTitle,
    });

    const detail = await store.getChatDetailForUser(chat.id, requesterId, { markRead: true });
    return res.status(201).json({ chat: detail, message: "Chat is ready." });
  });

  router.get("/:id", authRequired, async (req, res) => {
    const chat = await store.getChatDetailForUser(req.params.id, req.user.id, { markRead: true });
    if (!chat) {
      return res.status(404).json({ message: "Chat not found." });
    }

    return res.json({ chat });
  });

  router.post("/:id/messages", authRequired, async (req, res) => {
    const text = String(req.body?.text || "").trim();
    if (!text) {
      return res.status(400).json({ message: "Message text cannot be empty." });
    }

    if (text.length > 1200) {
      return res.status(400).json({ message: "Please keep each message under 1200 characters." });
    }

    const sentMessage = await store.addChatMessage({
      chatId: req.params.id,
      senderId: req.user.id,
      text,
    });

    if (!sentMessage) {
      return res.status(404).json({ message: "Chat not found." });
    }

    const chat = await store.getChatDetailForUser(req.params.id, req.user.id, { markRead: true });
    return res.status(201).json({
      message: "Message sent.",
      sentMessage,
      chat,
    });
  });

  return router;
};
