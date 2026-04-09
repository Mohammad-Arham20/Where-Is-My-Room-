const path = require("path");
const crypto = require("crypto");
const { ensureJsonFile, readJson, writeJson } = require("./storage");

const DATA_DIR = path.resolve(__dirname, "../../data");

class DataStore {
  constructor() {
    this.files = {
      users: path.join(DATA_DIR, "users.json"),
      listings: path.join(DATA_DIR, "listings.json"),
      roommatePosts: path.join(DATA_DIR, "roommatePosts.json"),
      chats: path.join(DATA_DIR, "chats.json"),
    };
  }

  async init() {
    await Promise.all([
      ensureJsonFile(this.files.users, []),
      ensureJsonFile(this.files.listings, []),
      ensureJsonFile(this.files.roommatePosts, []),
      ensureJsonFile(this.files.chats, []),
    ]);
    await this.ensureUserSchema();
  }

  buildDefaultProfile(name = "", email = "") {
    const safeName = String(name || "").trim();
    const fallbackAbout = safeName
      ? `Hi, I am ${safeName}. I am currently looking for the right PG and roommate match.`
      : "Student looking for the right PG and roommate match.";

    return {
      phone: "",
      college: "",
      course: "",
      yearOfStudy: "",
      preferredLocation: "",
      monthlyBudget: null,
      gender: "",
      foodPreference: "",
      sleepSchedule: "",
      smokingPreference: "",
      cleanlinessLevel: "",
      hobbies: "",
      aboutMe: fallbackAbout,
      emergencyContactName: "",
      emergencyContactPhone: "",
      updatedAt: new Date().toISOString(),
      accountEmail: String(email || "").trim().toLowerCase(),
    };
  }

  withUserDefaults(user) {
    if (!user) {
      return null;
    }

    const baseProfile = this.buildDefaultProfile(user.name, user.email);
    const profile =
      user.profile && typeof user.profile === "object"
        ? { ...baseProfile, ...user.profile }
        : baseProfile;

    return {
      ...user,
      favoriteListings: Array.isArray(user.favoriteListings) ? user.favoriteListings : [],
      profile,
    };
  }

  async ensureUserSchema() {
    const users = await this.getUsers();
    let changed = false;

    const normalizedUsers = users.map((user) => {
      const normalized = this.withUserDefaults(user);

      if (
        !Array.isArray(user.favoriteListings) ||
        !user.profile ||
        typeof user.profile !== "object"
      ) {
        changed = true;
      } else {
        const currentProfile = JSON.stringify(user.profile);
        const normalizedProfile = JSON.stringify(normalized.profile);
        if (currentProfile !== normalizedProfile) {
          changed = true;
        }
      }

      return normalized;
    });

    if (changed) {
      await this.saveUsers(normalizedUsers);
    }
  }

  normalizeProfileInput(payload = {}, user = {}) {
    const text = (value, max = 180) => String(value ?? "").trim().slice(0, max);
    const currentProfile = this.withUserDefaults(user)?.profile || this.buildDefaultProfile();
    const nextText = (key, max) =>
      Object.prototype.hasOwnProperty.call(payload, key)
        ? text(payload[key], max)
        : currentProfile[key];

    let monthlyBudget = currentProfile.monthlyBudget;
    if (Object.prototype.hasOwnProperty.call(payload, "monthlyBudget")) {
      const rawBudget = String(payload.monthlyBudget ?? "").trim();
      if (!rawBudget) {
        monthlyBudget = null;
      } else {
        const parsed = Number(rawBudget);
        monthlyBudget = Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : null;
      }
    }

    return {
      phone: nextText("phone", 24),
      college: nextText("college", 120),
      course: nextText("course", 120),
      yearOfStudy: nextText("yearOfStudy", 50),
      preferredLocation: nextText("preferredLocation", 80),
      monthlyBudget,
      gender: nextText("gender", 40),
      foodPreference: nextText("foodPreference", 80),
      sleepSchedule: nextText("sleepSchedule", 80),
      smokingPreference: nextText("smokingPreference", 80),
      cleanlinessLevel: nextText("cleanlinessLevel", 80),
      hobbies: nextText("hobbies", 220),
      aboutMe: nextText("aboutMe", 800),
      emergencyContactName: nextText("emergencyContactName", 120),
      emergencyContactPhone: nextText("emergencyContactPhone", 24),
      updatedAt: new Date().toISOString(),
      accountEmail: String(user.email || "").trim().toLowerCase(),
    };
  }

  sanitizeUser(user) {
    if (!user) {
      return null;
    }

    const normalizedUser = this.withUserDefaults(user);
    const { passwordHash, ...safeUser } = normalizedUser;
    return safeUser;
  }

  withListingMeta(listing) {
    const reviews = Array.isArray(listing.reviews) ? listing.reviews : [];
    const reviewCount = reviews.length;
    const averageRating = reviewCount
      ? Number(
          (
            reviews.reduce((total, review) => total + Number(review.rating || 0), 0) /
            reviewCount
          ).toFixed(1)
        )
      : 0;

    return {
      ...listing,
      reviews,
      reviewCount,
      averageRating,
    };
  }

  async getUsers() {
    return readJson(this.files.users, []);
  }

  async saveUsers(users) {
    return writeJson(this.files.users, users);
  }

  async getListings() {
    const listings = await readJson(this.files.listings, []);
    return listings.map((listing) => this.withListingMeta(listing));
  }

  async getRawListings() {
    return readJson(this.files.listings, []);
  }

  async saveListings(listings) {
    return writeJson(this.files.listings, listings);
  }

  async getRoommatePosts() {
    return readJson(this.files.roommatePosts, []);
  }

  async saveRoommatePosts(posts) {
    return writeJson(this.files.roommatePosts, posts);
  }

  async getChats() {
    return readJson(this.files.chats, []);
  }

  async saveChats(chats) {
    return writeJson(this.files.chats, chats);
  }

  normalizeParticipantIds(participantIds = []) {
    return [...new Set(participantIds.map((id) => String(id || "").trim()).filter(Boolean))].sort();
  }

  buildChatPreview(chat, currentUserId, usersById) {
    const participantIds = this.normalizeParticipantIds(chat.participantIds || []);
    const otherUserId = participantIds.find((id) => id !== currentUserId) || participantIds[0] || "";
    const otherUser = usersById.get(otherUserId);
    const messages = Array.isArray(chat.messages) ? chat.messages : [];
    const lastMessage = messages[messages.length - 1] || null;
    const unreadCount = messages.reduce((count, message) => {
      const readBy = Array.isArray(message.readBy) ? message.readBy : [];
      if (message.senderId !== currentUserId && !readBy.includes(currentUserId)) {
        return count + 1;
      }
      return count;
    }, 0);

    return {
      id: chat.id,
      otherUser: otherUser
        ? {
            id: otherUser.id,
            name: otherUser.name,
          }
        : {
            id: otherUserId,
            name: "Unknown user",
          },
      participantIds,
      listingId: chat.listingId || null,
      listingTitle: chat.listingTitle || "",
      updatedAt: chat.updatedAt || chat.createdAt,
      createdAt: chat.createdAt,
      unreadCount,
      lastMessage: lastMessage
        ? {
            id: lastMessage.id,
            text: lastMessage.text,
            senderId: lastMessage.senderId,
            createdAt: lastMessage.createdAt,
          }
        : null,
    };
  }

  markChatMessagesAsRead(chat, userId) {
    let changed = false;
    const messages = Array.isArray(chat.messages) ? chat.messages : [];

    messages.forEach((message) => {
      message.readBy = Array.isArray(message.readBy) ? message.readBy : [];
      if (message.senderId !== userId && !message.readBy.includes(userId)) {
        message.readBy.push(userId);
        changed = true;
      }
    });

    return changed;
  }

  async findUserByEmail(email) {
    const users = await this.getUsers();
    const user = users.find((item) => item.email.toLowerCase() === email.toLowerCase()) || null;
    return this.withUserDefaults(user);
  }

  async findUserById(userId) {
    const users = await this.getUsers();
    const user = users.find((item) => item.id === userId) || null;
    return this.withUserDefaults(user);
  }

  async createUser({ name, email, passwordHash }) {
    const users = await this.getUsers();
    const trimmedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const user = {
      id: crypto.randomUUID(),
      name: trimmedName,
      email: normalizedEmail,
      passwordHash,
      favoriteListings: [],
      profile: this.buildDefaultProfile(trimmedName, normalizedEmail),
      createdAt: new Date().toISOString(),
    };

    users.push(user);
    await this.saveUsers(users);

    return this.sanitizeUser(user);
  }

  async getUserProfile(userId) {
    const user = await this.findUserById(userId);
    if (!user) {
      return null;
    }

    return this.withUserDefaults(user).profile;
  }

  async syncUserNameAcrossData(userId, userName) {
    const [listings, roommatePosts] = await Promise.all([
      this.getRawListings(),
      this.getRoommatePosts(),
    ]);

    let listingsChanged = false;
    let roommatePostsChanged = false;

    listings.forEach((listing) => {
      if (listing.ownerId === userId && listing.ownerName !== userName) {
        listing.ownerName = userName;
        listingsChanged = true;
      }

      if (Array.isArray(listing.reviews)) {
        listing.reviews.forEach((review) => {
          if (review.userId === userId && review.userName !== userName) {
            review.userName = userName;
            listingsChanged = true;
          }
        });
      }
    });

    roommatePosts.forEach((post) => {
      if (post.userId === userId && post.userName !== userName) {
        post.userName = userName;
        roommatePostsChanged = true;
      }
    });

    if (listingsChanged) {
      await this.saveListings(listings);
    }

    if (roommatePostsChanged) {
      await this.saveRoommatePosts(roommatePosts);
    }
  }

  async updateUserProfile(userId, payload = {}) {
    const users = await this.getUsers();
    const userIndex = users.findIndex((user) => user.id === userId);

    if (userIndex < 0) {
      return null;
    }

    const currentUser = this.withUserDefaults(users[userIndex]);
    const nextName = String(payload.name ?? currentUser.name).trim();
    if (!nextName) {
      return null;
    }

    const updatedUser = {
      ...currentUser,
      name: nextName.slice(0, 90),
      profile: {
        ...currentUser.profile,
        ...this.normalizeProfileInput(payload, currentUser),
      },
    };

    users[userIndex] = updatedUser;
    await this.saveUsers(users);

    if (updatedUser.name !== currentUser.name) {
      await this.syncUserNameAcrossData(userId, updatedUser.name);
    }

    return this.sanitizeUser(updatedUser);
  }

  async createListing({
    title,
    rent,
    location,
    roomType,
    genderPreference,
    furnished,
    description,
    contact,
    imageUrl,
    ownerId,
    ownerName,
  }) {
    const listings = await this.getRawListings();
    const listing = {
      id: crypto.randomUUID(),
      title: title.trim(),
      rent: Number(rent),
      location,
      roomType,
      genderPreference,
      furnished,
      description: description.trim(),
      contact: contact.trim(),
      imageUrl:
        imageUrl?.trim() ||
        "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80",
      availability: "Available now",
      ownerId,
      ownerName,
      createdAt: new Date().toISOString(),
      reviews: [],
    };

    listings.unshift(listing);
    await this.saveListings(listings);

    return this.withListingMeta(listing);
  }

  async getListingById(listingId) {
    const listings = await this.getRawListings();
    const listing = listings.find((item) => item.id === listingId);
    return listing ? this.withListingMeta(listing) : null;
  }

  async toggleFavorite(userId, listingId) {
    const users = await this.getUsers();
    const user = users.find((item) => item.id === userId);

    if (!user) {
      return null;
    }

    const favorites = new Set(user.favoriteListings || []);
    let favorite = false;

    if (favorites.has(listingId)) {
      favorites.delete(listingId);
      favorite = false;
    } else {
      favorites.add(listingId);
      favorite = true;
    }

    user.favoriteListings = [...favorites];
    await this.saveUsers(users);

    return {
      favorite,
      favorites: user.favoriteListings,
    };
  }

  async getUserFavoriteListings(userId) {
    const user = await this.findUserById(userId);

    if (!user) {
      return [];
    }

    const favoriteIds = new Set(user.favoriteListings || []);
    const listings = await this.getListings();
    return listings.filter((listing) => favoriteIds.has(listing.id));
  }

  async addReview(listingId, review) {
    const listings = await this.getRawListings();
    const listing = listings.find((item) => item.id === listingId);

    if (!listing) {
      return null;
    }

    const nextReview = {
      id: crypto.randomUUID(),
      userId: review.userId,
      userName: review.userName,
      rating: Number(review.rating),
      comment: review.comment.trim(),
      createdAt: new Date().toISOString(),
    };

    listing.reviews = Array.isArray(listing.reviews) ? listing.reviews : [];
    listing.reviews.unshift(nextReview);

    await this.saveListings(listings);
    return this.withListingMeta(listing);
  }

  async deleteListing(listingId, ownerId) {
    const listings = await this.getRawListings();
    const listingIndex = listings.findIndex((item) => item.id === listingId);

    if (listingIndex < 0) {
      return { status: "not_found" };
    }

    const listing = listings[listingIndex];
    if (listing.ownerId !== ownerId) {
      return { status: "forbidden" };
    }

    const [removedListing] = listings.splice(listingIndex, 1);
    await this.saveListings(listings);

    const users = await this.getUsers();
    let usersChanged = false;
    users.forEach((user) => {
      const favorites = Array.isArray(user.favoriteListings) ? user.favoriteListings : [];
      if (favorites.includes(listingId)) {
        user.favoriteListings = favorites.filter((favoriteId) => favoriteId !== listingId);
        usersChanged = true;
      }
    });

    if (usersChanged) {
      await this.saveUsers(users);
    }

    return {
      status: "deleted",
      listing: this.withListingMeta(removedListing),
    };
  }

  async createRoommatePost({
    userId,
    userName,
    location,
    budget,
    gender,
    habits,
    notes,
    contact,
  }) {
    const posts = await this.getRoommatePosts();
    const roommatePost = {
      id: crypto.randomUUID(),
      userId,
      userName,
      location,
      budget: Number(budget),
      gender,
      habits,
      notes: notes.trim(),
      contact: contact.trim(),
      createdAt: new Date().toISOString(),
    };

    posts.unshift(roommatePost);
    await this.saveRoommatePosts(posts);

    return roommatePost;
  }

  calculateCompatibility(sourcePost, candidatePost) {
    let score = 0;

    if (sourcePost.location === candidatePost.location) {
      score += 35;
    }

    const budgetGap = Math.abs(Number(sourcePost.budget) - Number(candidatePost.budget));
    if (budgetGap <= 2000) {
      score += 30;
    } else if (budgetGap <= 4000) {
      score += 18;
    } else if (budgetGap <= 6000) {
      score += 8;
    }

    const normalizedGenderA = String(sourcePost.gender || "").toLowerCase();
    const normalizedGenderB = String(candidatePost.gender || "").toLowerCase();
    if (
      normalizedGenderA === normalizedGenderB ||
      normalizedGenderA === "any" ||
      normalizedGenderB === "any"
    ) {
      score += 20;
    }

    const habitsA = new Set((sourcePost.habits || []).map((habit) => habit.toLowerCase()));
    const sharedHabits = (candidatePost.habits || []).filter((habit) =>
      habitsA.has(habit.toLowerCase())
    );

    score += Math.min(sharedHabits.length * 6, 15);

    return {
      score,
      sharedHabits,
      compatibilityLabel:
        score >= 75 ? "Excellent fit" : score >= 55 ? "Strong fit" : score >= 35 ? "Good fit" : "Possible fit",
    };
  }

  async getRoommateMatches(userId) {
    const posts = await this.getRoommatePosts();
    const ownPosts = posts.filter((post) => post.userId === userId);
    const others = posts.filter((post) => post.userId !== userId);

    return ownPosts.map((post) => {
      const matches = others
        .map((candidate) => {
          const compatibility = this.calculateCompatibility(post, candidate);
          return {
            ...candidate,
            ...compatibility,
          };
        })
        .filter((candidate) => candidate.score >= 35)
        .sort((left, right) => right.score - left.score)
        .slice(0, 6);

      return {
        sourcePost: post,
        matches,
      };
    });
  }

  async getChatSummaries(userId) {
    const [chats, users] = await Promise.all([this.getChats(), this.getUsers()]);
    const usersById = new Map(users.map((user) => [user.id, user]));

    return chats
      .filter((chat) => (chat.participantIds || []).includes(userId))
      .sort(
        (left, right) =>
          new Date(right.updatedAt || right.createdAt || 0).getTime() -
          new Date(left.updatedAt || left.createdAt || 0).getTime()
      )
      .map((chat) => this.buildChatPreview(chat, userId, usersById));
  }

  async startChat({
    requesterId,
    recipientId,
    listingId = null,
    listingTitle = "",
  }) {
    const participantIds = this.normalizeParticipantIds([requesterId, recipientId]);
    const targetListingId = listingId || null;
    const chats = await this.getChats();

    const existingChat = chats.find((chat) => {
      const chatParticipants = this.normalizeParticipantIds(chat.participantIds || []);
      if (chatParticipants.length !== participantIds.length) {
        return false;
      }

      const sameParticipants = chatParticipants.every((id, index) => id === participantIds[index]);
      return sameParticipants && (chat.listingId || null) === targetListingId;
    });

    if (existingChat) {
      return existingChat;
    }

    const now = new Date().toISOString();
    const nextChat = {
      id: crypto.randomUUID(),
      participantIds,
      listingId: targetListingId,
      listingTitle: String(listingTitle || "").trim(),
      createdAt: now,
      updatedAt: now,
      messages: [],
    };

    chats.unshift(nextChat);
    await this.saveChats(chats);
    return nextChat;
  }

  async getChatDetailForUser(chatId, userId, options = {}) {
    const shouldMarkRead = Boolean(options.markRead);
    const chats = await this.getChats();
    const chatIndex = chats.findIndex((chat) => chat.id === chatId);

    if (chatIndex < 0) {
      return null;
    }

    const chat = chats[chatIndex];
    const participantIds = this.normalizeParticipantIds(chat.participantIds || []);

    if (!participantIds.includes(userId)) {
      return null;
    }

    let changed = false;
    if (shouldMarkRead) {
      changed = this.markChatMessagesAsRead(chat, userId);
    }

    if (changed) {
      chats[chatIndex] = chat;
      await this.saveChats(chats);
    }

    const users = await this.getUsers();
    const usersById = new Map(users.map((user) => [user.id, user]));
    const preview = this.buildChatPreview(chat, userId, usersById);
    const messages = (Array.isArray(chat.messages) ? chat.messages : []).map((message) => ({
      id: message.id,
      text: message.text,
      senderId: message.senderId,
      senderName: usersById.get(message.senderId)?.name || "User",
      createdAt: message.createdAt,
      isMine: message.senderId === userId,
    }));

    return {
      ...preview,
      messages,
    };
  }

  async addChatMessage({ chatId, senderId, text }) {
    const chats = await this.getChats();
    const chatIndex = chats.findIndex((chat) => chat.id === chatId);

    if (chatIndex < 0) {
      return null;
    }

    const chat = chats[chatIndex];
    const participantIds = this.normalizeParticipantIds(chat.participantIds || []);
    if (!participantIds.includes(senderId)) {
      return null;
    }

    const trimmedText = String(text || "").trim();
    if (!trimmedText) {
      return null;
    }

    const now = new Date().toISOString();
    const nextMessage = {
      id: crypto.randomUUID(),
      senderId,
      text: trimmedText.slice(0, 1200),
      createdAt: now,
      readBy: [senderId],
    };

    chat.messages = Array.isArray(chat.messages) ? chat.messages : [];
    chat.messages.push(nextMessage);
    chat.updatedAt = now;
    chats[chatIndex] = chat;

    await this.saveChats(chats);
    return nextMessage;
  }

  async getDashboardSummary(userId) {
    const [listings, favorites, roommatePosts, user] = await Promise.all([
      this.getListings(),
      this.getUserFavoriteListings(userId),
      this.getRoommatePosts(),
      this.findUserById(userId),
    ]);

    if (!user) {
      return null;
    }

    const myListings = listings.filter((listing) => listing.ownerId === userId);
    const myRoommatePosts = roommatePosts.filter((post) => post.userId === userId);
    const roommateMatches = await this.getRoommateMatches(userId);

    return {
      user: this.sanitizeUser(user),
      stats: {
        totalListings: listings.length,
        savedListings: favorites.length,
        activePosts: myListings.length + myRoommatePosts.length,
      },
      favorites,
      myListings,
      myRoommatePosts,
      roommateMatches,
      recentListings: listings.slice(0, 4),
    };
  }
}

module.exports = DataStore;
