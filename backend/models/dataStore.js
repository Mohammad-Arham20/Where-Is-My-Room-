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
    };
  }

  async init() {
    await Promise.all([
      ensureJsonFile(this.files.users, []),
      ensureJsonFile(this.files.listings, []),
      ensureJsonFile(this.files.roommatePosts, []),
    ]);
  }

  sanitizeUser(user) {
    if (!user) {
      return null;
    }

    const { passwordHash, ...safeUser } = user;
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

  async findUserByEmail(email) {
    const users = await this.getUsers();
    return users.find((user) => user.email.toLowerCase() === email.toLowerCase()) || null;
  }

  async findUserById(userId) {
    const users = await this.getUsers();
    return users.find((user) => user.id === userId) || null;
  }

  async createUser({ name, email, passwordHash }) {
    const users = await this.getUsers();
    const user = {
      id: crypto.randomUUID(),
      name: name.trim(),
      email: email.trim().toLowerCase(),
      passwordHash,
      favoriteListings: [],
      createdAt: new Date().toISOString(),
    };

    users.push(user);
    await this.saveUsers(users);

    return this.sanitizeUser(user);
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
