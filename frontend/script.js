const STORAGE_KEYS = {
  token: "pgFinderToken",
  user: "pgFinderUser",
};

const appState = {
  token: localStorage.getItem(STORAGE_KEYS.token) || "",
  user: readStoredUser(),
  listings: [],
  favorites: new Set(),
  currentListing: null,
  dashboard: null,
};

document.addEventListener("DOMContentLoaded", async () => {
  initAnimatedBackground();
  bindGlobalInteractions();
  bindAuthForms();
  updateAuthUI();
  await restoreSession();
  await initializeCurrentPage();
});

function readStoredUser() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.user);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}

function setSession(token, user) {
  appState.token = token;
  appState.user = user;
  localStorage.setItem(STORAGE_KEYS.token, token);
  localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
  updateAuthUI();
}

function clearSession() {
  appState.token = "";
  appState.user = null;
  appState.favorites = new Set();
  localStorage.removeItem(STORAGE_KEYS.token);
  localStorage.removeItem(STORAGE_KEYS.user);
  updateAuthUI();
}

function initAnimatedBackground() {
  if (document.querySelector(".bubble-field")) {
    return;
  }

  const field = document.createElement("div");
  field.className = "bubble-field";

  for (let index = 0; index < 22; index += 1) {
    const bubble = document.createElement("span");
    bubble.className = "bubble";
    bubble.style.setProperty("--size", `${randomBetween(48, 160)}px`);
    bubble.style.setProperty("--left", `${randomBetween(0, 100)}%`);
    bubble.style.setProperty("--duration", `${randomBetween(18, 38)}s`);
    bubble.style.setProperty("--delay", `${randomBetween(-24, 0)}s`);
    bubble.style.setProperty("--opacity", `${randomBetween(0.12, 0.32)}`);
    field.appendChild(bubble);
  }

  document.body.appendChild(field);
}

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function bindGlobalInteractions() {
  document.addEventListener("click", async (event) => {
    const openAuthButton = event.target.closest("[data-open-auth]");
    if (openAuthButton) {
      openModal("authModal");
      switchAuthTab(openAuthButton.dataset.authTab || "login");
      return;
    }

    const logoutButton = event.target.closest('[data-auth-action="logout"]');
    if (logoutButton) {
      clearSession();
      showToast("Logged out successfully.", "success");
      await initializeCurrentPage();
      return;
    }

    const modalClose = event.target.closest("[data-close-modal]");
    if (modalClose) {
      closeModal(modalClose.dataset.closeModal);
      return;
    }

    if (event.target.classList.contains("modal-backdrop")) {
      closeModal(event.target.id);
      return;
    }

    const authTabButton = event.target.closest("[data-auth-tab]");
    if (authTabButton) {
      switchAuthTab(authTabButton.dataset.authTab);
      return;
    }

    const favoriteButton = event.target.closest("[data-favorite-id]");
    if (favoriteButton) {
      event.preventDefault();
      await toggleFavorite(favoriteButton.dataset.favoriteId);
      return;
    }

    const contactButton = event.target.closest("[data-open-contact]");
    if (contactButton) {
      openContactModal();
      return;
    }

    const starButton = event.target.closest("[data-star-value]");
    if (starButton) {
      setReviewRating(Number(starButton.dataset.starValue));
      return;
    }

    const dashboardTabButton = event.target.closest("[data-dashboard-tab]");
    if (dashboardTabButton) {
      activateDashboardTab(dashboardTabButton.dataset.dashboardTab);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeModal("authModal");
      closeModal("contactModal");
    }
  });
}

function bindAuthForms() {
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");

  if (loginForm && !loginForm.dataset.bound) {
    loginForm.dataset.bound = "true";
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const payload = Object.fromEntries(new FormData(loginForm).entries());

      try {
        const response = await api("/api/auth/login", {
          method: "POST",
          body: payload,
        });
        setSession(response.token, response.user);
        closeModal("authModal");
        showToast(`Welcome back, ${response.user.name}.`, "success");
        await initializeCurrentPage();
      } catch (error) {
        showToast(error.message, "error");
      }
    });
  }

  if (registerForm && !registerForm.dataset.bound) {
    registerForm.dataset.bound = "true";
    registerForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const payload = Object.fromEntries(new FormData(registerForm).entries());

      try {
        const response = await api("/api/auth/register", {
          method: "POST",
          body: payload,
        });
        setSession(response.token, response.user);
        closeModal("authModal");
        showToast("Account created successfully.", "success");
        await initializeCurrentPage();
      } catch (error) {
        showToast(error.message, "error");
      }
    });
  }
}

async function restoreSession() {
  if (!appState.token) {
    return;
  }

  try {
    const response = await api("/api/auth/me", { auth: true });
    appState.user = response.user;
    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(response.user));
    updateAuthUI();
  } catch (error) {
    clearSession();
  }
}

function updateAuthUI() {
  const loginButtons = document.querySelectorAll(".auth-login-btn");
  const logoutButtons = document.querySelectorAll(".auth-logout-btn");
  const userChips = document.querySelectorAll("[data-auth-user]");

  loginButtons.forEach((button) => button.classList.toggle("hidden", Boolean(appState.user)));
  logoutButtons.forEach((button) => button.classList.toggle("hidden", !appState.user));
  userChips.forEach((chip) => {
    chip.classList.toggle("hidden", !appState.user);
    chip.textContent = appState.user ? `Hi, ${appState.user.name}` : "";
  });
}

async function initializeCurrentPage() {
  const page = document.body.dataset.page;

  if (page === "home") {
    await initializeHomePage();
  }

  if (page === "post") {
    initializePostPage();
  }

  if (page === "details") {
    await initializeDetailsPage();
  }

  if (page === "dashboard") {
    await initializeDashboardPage();
  }
}

async function initializeHomePage() {
  bindHomeFilters();

  try {
    const listingResponse = await api("/api/listings");
    appState.listings = listingResponse.listings || [];
    await refreshFavoriteIds();
    renderHomeListings();
    const heroCount = document.getElementById("heroListingsCount");
    if (heroCount) {
      heroCount.textContent = String(appState.listings.length);
    }
  } catch (error) {
    renderCollectionState("listingGrid", "Unable to load listings right now.");
    showToast(error.message, "error");
  }
}

function bindHomeFilters() {
  const searchInput = document.getElementById("searchInput");
  const budgetRange = document.getElementById("budgetRange");
  const locationFilter = document.getElementById("locationFilter");
  const roomTypeFilter = document.getElementById("roomTypeFilter");
  const clearFiltersButton = document.getElementById("clearFiltersBtn");

  if (!searchInput || searchInput.dataset.bound) {
    syncBudgetLabel();
    return;
  }

  searchInput.dataset.bound = "true";
  [searchInput, budgetRange, locationFilter, roomTypeFilter].forEach((element) => {
    element?.addEventListener("input", () => {
      syncBudgetLabel();
      renderHomeListings();
    });
    element?.addEventListener("change", () => {
      syncBudgetLabel();
      renderHomeListings();
    });
  });

  clearFiltersButton?.addEventListener("click", () => {
    if (searchInput) {
      searchInput.value = "";
    }
    if (budgetRange) {
      budgetRange.value = "25000";
    }
    if (locationFilter) {
      locationFilter.value = "All";
    }
    if (roomTypeFilter) {
      roomTypeFilter.value = "All";
    }
    syncBudgetLabel();
    renderHomeListings();
  });

  syncBudgetLabel();
}

function syncBudgetLabel() {
  const budgetRange = document.getElementById("budgetRange");
  const budgetValue = document.getElementById("budgetValue");

  if (!budgetRange || !budgetValue) {
    return;
  }

  budgetValue.textContent = formatCurrency(Number(budgetRange.value));
}

function getFilteredListings() {
  const searchValue = document.getElementById("searchInput")?.value.trim().toLowerCase() || "";
  const budgetCap = Number(document.getElementById("budgetRange")?.value || 25000);
  const locationValue = document.getElementById("locationFilter")?.value || "All";
  const roomTypeValue = document.getElementById("roomTypeFilter")?.value || "All";

  return appState.listings.filter((listing) => {
    const matchesSearch =
      !searchValue ||
      [listing.title, listing.location, listing.description]
        .join(" ")
        .toLowerCase()
        .includes(searchValue);

    return (
      matchesSearch &&
      Number(listing.rent) <= budgetCap &&
      (locationValue === "All" || listing.location === locationValue) &&
      (roomTypeValue === "All" || listing.roomType === roomTypeValue)
    );
  });
}

function renderHomeListings() {
  const filteredListings = getFilteredListings();
  const listingsCount = document.getElementById("listingsCount");

  if (listingsCount) {
    listingsCount.textContent = `${filteredListings.length} result${filteredListings.length === 1 ? "" : "s"} found`;
  }

  renderListingsGrid("listingGrid", filteredListings);
}

function renderListingsGrid(containerId, listings) {
  const container = document.getElementById(containerId);
  if (!container) {
    return;
  }

  if (!listings.length) {
    container.innerHTML = emptyStateMarkup(
      "No listings match your filters",
      "Try widening the budget or clearing a few filters to explore more stays."
    );
    return;
  }

  container.innerHTML = listings.map((listing) => listingCardMarkup(listing)).join("");
}

function listingCardMarkup(listing) {
  const favoriteActive = appState.favorites.has(listing.id) ? "active" : "";
  return `
    <article class="listing-card glass-card">
      <div class="listing-image">
        <img src="${listing.imageUrl}" alt="${escapeHtml(listing.title)}" />
      </div>
      <div class="listing-body">
        <div class="badge-row">
          <span class="badge">${escapeHtml(listing.availability)}</span>
          <span class="soft-badge">${escapeHtml(listing.roomType)}</span>
        </div>
        <div>
          <h3>${escapeHtml(listing.title)}</h3>
          <p>${escapeHtml(listing.location)} · ${escapeHtml(listing.furnished)}</p>
        </div>
        <div class="rating-summary">
          <span class="listing-price">${formatCurrency(Number(listing.rent))}</span>
          <p>${renderStars(listing.averageRating)} ${listing.averageRating || 0} (${listing.reviewCount || 0})</p>
        </div>
        <p>${escapeHtml(truncateText(listing.description, 110))}</p>
        <div class="card-action-row">
          <a class="btn btn-primary" href="/details?id=${listing.id}">View details</a>
          <button class="favorite-btn ${favoriteActive}" data-favorite-id="${listing.id}" aria-label="Toggle favorite">
            ❤
          </button>
        </div>
      </div>
    </article>
  `;
}

function initializePostPage() {
  const statusMessage = document.getElementById("postStatusMessage");
  if (statusMessage) {
    statusMessage.textContent = appState.user
      ? `Signed in as ${appState.user.name}. Your posts will go live instantly.`
      : "Login to publish listings and roommate requirements.";
  }

  const listingForm = document.getElementById("listingForm");
  const roommateForm = document.getElementById("roommateForm");

  if (listingForm && !listingForm.dataset.bound) {
    listingForm.dataset.bound = "true";
    listingForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      if (!requireAuth()) {
        return;
      }

      const payload = Object.fromEntries(new FormData(listingForm).entries());

      try {
        const response = await api("/api/listings", {
          method: "POST",
          body: payload,
          auth: true,
        });
        listingForm.reset();
        showToast(response.message || "Listing added successfully.", "success");
        window.setTimeout(() => {
          window.location.href = `/details?id=${response.listing.id}`;
        }, 500);
      } catch (error) {
        showToast(error.message, "error");
      }
    });
  }

  if (roommateForm && !roommateForm.dataset.bound) {
    roommateForm.dataset.bound = "true";
    roommateForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      if (!requireAuth()) {
        return;
      }

      const payload = Object.fromEntries(new FormData(roommateForm).entries());

      try {
        const response = await api("/api/roommates", {
          method: "POST",
          body: payload,
          auth: true,
        });
        roommateForm.reset();
        showToast(response.message || "Roommate preferences posted.", "success");
      } catch (error) {
        showToast(error.message, "error");
      }
    });
  }
}

async function initializeDetailsPage() {
  const listingId = new URLSearchParams(window.location.search).get("id");
  const shell = document.getElementById("listingDetails");

  if (!listingId) {
    if (shell) {
      shell.innerHTML = emptyStateMarkup(
        "Listing not found",
        "The listing link is missing an id. Head back home and choose a listing again."
      );
    }
    return;
  }

  try {
    const response = await api(`/api/listings/${listingId}`);
    appState.currentListing = response.listing;
    await refreshFavoriteIds();
    renderDetailsPage();
  } catch (error) {
    if (shell) {
      shell.innerHTML = emptyStateMarkup("Unable to load this listing", error.message);
    }
  }
}

function renderDetailsPage() {
  const shell = document.getElementById("listingDetails");
  const listing = appState.currentListing;

  if (!shell || !listing) {
    return;
  }

  const reviewFormMarkup = appState.user
    ? `
      <form id="reviewForm" class="review-form">
        <input type="hidden" id="reviewRating" value="0" />
        <div>
          <span class="eyebrow">Rate this stay</span>
          <div class="star-row">
            ${[1, 2, 3, 4, 5]
              .map(
                (value) => `
                  <button type="button" class="star-btn" data-star-value="${value}" aria-label="Rate ${value} stars">
                    ★
                  </button>
                `
              )
              .join("")}
          </div>
        </div>
        <label class="field-group">
          <span>Review</span>
          <textarea id="reviewComment" rows="4" placeholder="Share your experience with this PG." required></textarea>
        </label>
        <button class="btn btn-primary" type="submit">Submit review</button>
      </form>
    `
    : `
      <div class="empty-state">
        <h3>Want to leave a review?</h3>
        <p>Login or create an account to rate this listing and save it to your favorites.</p>
        <button class="btn btn-primary" data-open-auth data-auth-tab="login">Login to continue</button>
      </div>
    `;

  shell.innerHTML = `
    <div class="detail-layout">
      <div class="detail-stack">
        <div class="detail-gallery glass-inset">
          <img src="${listing.imageUrl}" alt="${escapeHtml(listing.title)}" />
        </div>
        <div class="detail-panel">
          <span class="eyebrow">Listing details</span>
          <div class="card-title-row">
            <div>
              <h2>${escapeHtml(listing.title)}</h2>
              <p>${escapeHtml(listing.location)} · ${escapeHtml(listing.roomType)}</p>
            </div>
            <span class="badge">${escapeHtml(listing.availability)}</span>
          </div>

          <div class="detail-meta-grid">
            <div class="glass-inset">
              <span>Monthly rent</span>
              <strong>${formatCurrency(Number(listing.rent))}</strong>
            </div>
            <div class="glass-inset">
              <span>Gender preference</span>
              <strong>${escapeHtml(listing.genderPreference)}</strong>
            </div>
            <div class="glass-inset">
              <span>Furnishing</span>
              <strong>${escapeHtml(listing.furnished)}</strong>
            </div>
          </div>

          <p>${escapeHtml(listing.description)}</p>

          <div class="detail-actions">
            <button class="btn btn-primary" data-open-contact>Contact owner</button>
            <button class="favorite-btn ${appState.favorites.has(listing.id) ? "active" : ""}" data-favorite-id="${listing.id}">
              ❤
            </button>
          </div>
        </div>
      </div>

      <aside class="detail-side detail-stack">
        <div class="review-card">
          <span class="eyebrow">Ratings & reviews</span>
          <div class="rating-summary">
            <span class="rating-chip">${listing.averageRating || 0}</span>
            <div>
              <p>${renderStars(listing.averageRating)}</p>
              <p>${listing.reviewCount} review${listing.reviewCount === 1 ? "" : "s"}</p>
            </div>
          </div>
        </div>

        <div class="review-card">
          <span class="eyebrow">Hosted by</span>
          <h3>${escapeHtml(listing.ownerName || "Property owner")}</h3>
          <p>Reach out directly to confirm availability, check amenities, and schedule a visit.</p>
        </div>
      </aside>
    </div>

    <div class="dashboard-section-card">
      <span class="eyebrow">Student reviews</span>
      <div class="review-list">
        ${
          listing.reviews?.length
            ? listing.reviews
                .map(
                  (review) => `
                    <article class="review-card">
                      <div class="card-title-row">
                        <strong>${escapeHtml(review.userName)}</strong>
                        <span>${renderStars(review.rating)}</span>
                      </div>
                      <p>${escapeHtml(review.comment)}</p>
                      <p>${formatDate(review.createdAt)}</p>
                    </article>
                  `
                )
                .join("")
            : emptyStateMarkup("No reviews yet", "Be the first student to review this listing.")
        }
      </div>
    </div>

    <div class="dashboard-section-card">
      <span class="eyebrow">Add your rating</span>
      ${reviewFormMarkup}
    </div>
  `;

  bindReviewForm();
}

function bindReviewForm() {
  const reviewForm = document.getElementById("reviewForm");
  if (!reviewForm || reviewForm.dataset.bound) {
    return;
  }

  reviewForm.dataset.bound = "true";
  reviewForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!requireAuth()) {
      return;
    }

    const rating = Number(document.getElementById("reviewRating")?.value || 0);
    const comment = document.getElementById("reviewComment")?.value.trim() || "";

    if (!rating) {
      showToast("Please choose a star rating before submitting.", "error");
      return;
    }

    try {
      const response = await api(`/api/listings/${appState.currentListing.id}/reviews`, {
        method: "POST",
        body: { rating, comment },
        auth: true,
      });
      appState.currentListing = response.listing;
      showToast(response.message || "Review added successfully.", "success");
      renderDetailsPage();
    } catch (error) {
      showToast(error.message, "error");
    }
  });
}

function setReviewRating(value) {
  const input = document.getElementById("reviewRating");
  if (!input) {
    return;
  }

  input.value = String(value);
  document.querySelectorAll("[data-star-value]").forEach((button) => {
    button.classList.toggle("active", Number(button.dataset.starValue) <= value);
  });
}

function openContactModal() {
  if (!appState.currentListing) {
    return;
  }

  const title = document.getElementById("contactModalTitle");
  const text = document.getElementById("contactModalText");

  if (title) {
    title.textContent = appState.currentListing.ownerName || "Property owner";
  }

  if (text) {
    text.textContent = `Contact: ${appState.currentListing.contact}`;
  }

  openModal("contactModal");
}

async function initializeDashboardPage() {
  const authState = document.getElementById("dashboardAuthState");
  const dashboardContent = document.getElementById("dashboardContent");

  if (!appState.user) {
    if (authState) {
      authState.innerHTML = `
        <h2>Your dashboard unlocks after login</h2>
        <p>Track favorites, active posts, and roommate matches in one place.</p>
        <button class="btn btn-primary" data-open-auth data-auth-tab="login">Login / Register</button>
      `;
      authState.classList.remove("hidden");
    }
    dashboardContent?.classList.add("hidden");
    return;
  }

  try {
    const response = await api("/api/dashboard/summary", { auth: true });
    appState.dashboard = response;
    renderDashboard(response);
    if (authState) {
      authState.classList.add("hidden");
    }
    dashboardContent?.classList.remove("hidden");
    activateDashboardTab(new URLSearchParams(window.location.search).get("tab") || "overview");
  } catch (error) {
    if (authState) {
      authState.classList.remove("hidden");
      authState.innerHTML = `<p>${escapeHtml(error.message)}</p>`;
    }
    dashboardContent?.classList.add("hidden");
  }
}

function renderDashboard(summary) {
  const greeting = document.getElementById("dashboardGreeting");
  const subtitle = document.getElementById("dashboardSubtitle");
  const statsGrid = document.getElementById("statsGrid");
  const overviewPanel = document.getElementById("overviewPanel");
  const favoritesPanel = document.getElementById("favoritesPanel");
  const listingsPanel = document.getElementById("listingsPanel");
  const roommatesPanel = document.getElementById("roommatesPanel");

  if (greeting) {
    greeting.textContent = `${summary.user.name}'s Dashboard`;
  }

  if (subtitle) {
    subtitle.textContent = "A quick view of your housing activity and roommate compatibility.";
  }

  if (statsGrid) {
    statsGrid.innerHTML = [
      statCardMarkup("Total listings", summary.stats.totalListings),
      statCardMarkup("Saved listings", summary.stats.savedListings),
      statCardMarkup("Active posts", summary.stats.activePosts),
    ].join("");
  }

  if (overviewPanel) {
    overviewPanel.innerHTML = `
      <div class="dashboard-section-card">
        <span class="eyebrow">Recent listings</span>
        <div class="compact-grid">
          ${
            summary.recentListings.length
              ? summary.recentListings.map((listing) => listingCardMarkup(listing)).join("")
              : emptyStateMarkup("No recent listings", "Add a new listing to get started.")
          }
        </div>
      </div>
    `;
  }

  if (favoritesPanel) {
    favoritesPanel.innerHTML = `
      <div class="dashboard-section-card">
        <span class="eyebrow">My favorites</span>
        <div class="compact-grid">
          ${
            summary.favorites.length
              ? summary.favorites.map((listing) => listingCardMarkup(listing)).join("")
              : emptyStateMarkup(
                  "No favorites yet",
                  "Save listings from the home page to build your shortlist."
                )
          }
        </div>
      </div>
    `;
  }

  if (listingsPanel) {
    listingsPanel.innerHTML = `
      <div class="dashboard-section-card">
        <span class="eyebrow">My active listings</span>
        <div class="compact-grid">
          ${
            summary.myListings.length
              ? summary.myListings.map((listing) => listingCardMarkup(listing)).join("")
              : emptyStateMarkup(
                  "No listings posted yet",
                  "Visit the post page to publish your first PG listing."
                )
          }
        </div>
      </div>
    `;
  }

  if (roommatesPanel) {
    roommatesPanel.innerHTML = `
      <div class="dashboard-section-card">
        <span class="eyebrow">My roommate posts</span>
        <div class="stacked-cards">
          ${
            summary.myRoommatePosts.length
              ? summary.myRoommatePosts
                  .map(
                    (post) => `
                      <article class="match-card">
                        <h3>${escapeHtml(post.location)} · ${formatCurrency(post.budget)}</h3>
                        <p>${escapeHtml(post.gender)} · ${escapeHtml(post.habits.join(", "))}</p>
                        <p>${escapeHtml(post.notes)}</p>
                      </article>
                    `
                  )
                  .join("")
              : emptyStateMarkup(
                  "No roommate requirements yet",
                  "Post your preferences to start getting compatibility matches."
                )
          }
        </div>
      </div>
      <div class="dashboard-section-card">
        <span class="eyebrow">Compatibility matches</span>
        <div class="stacked-cards">
          ${
            summary.roommateMatches.length
              ? summary.roommateMatches
                  .map(
                    (group) => `
                      <div class="match-group">
                        <div class="glass-inset match-source">
                          <h3>${escapeHtml(group.sourcePost.location)} · ${formatCurrency(group.sourcePost.budget)}</h3>
                          <p>${escapeHtml(group.sourcePost.gender)} · ${escapeHtml(group.sourcePost.habits.join(", "))}</p>
                        </div>
                        <div class="match-list">
                          ${
                            group.matches.length
                              ? group.matches
                                  .map(
                                    (match) => `
                                      <article class="match-card">
                                        <div class="card-title-row">
                                          <strong>${escapeHtml(match.userName)}</strong>
                                          <span class="soft-badge">${match.compatibilityLabel}</span>
                                        </div>
                                        <p>${escapeHtml(match.location)} · ${formatCurrency(match.budget)} · ${escapeHtml(match.gender)}</p>
                                        <p>${escapeHtml(match.notes)}</p>
                                        <p>Shared habits: ${escapeHtml(match.sharedHabits.join(", ") || "None yet")}</p>
                                        <p>Contact: ${escapeHtml(match.contact)}</p>
                                        <strong>${match.score}% compatibility</strong>
                                      </article>
                                    `
                                  )
                                  .join("")
                              : emptyStateMarkup(
                                  "No matches yet",
                                  "Try updating your budget or habits to widen the search."
                                )
                          }
                        </div>
                      </div>
                    `
                  )
                  .join("")
              : emptyStateMarkup(
                  "No roommate posts available",
                  "Your matches will appear here after you post a roommate preference."
                )
          }
        </div>
      </div>
    `;
  }
}

function activateDashboardTab(tabName) {
  document.querySelectorAll("[data-dashboard-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.dashboardTab === tabName);
  });

  const panels = {
    overview: document.getElementById("overviewPanel"),
    favorites: document.getElementById("favoritesPanel"),
    listings: document.getElementById("listingsPanel"),
    roommates: document.getElementById("roommatesPanel"),
  };

  Object.entries(panels).forEach(([key, panel]) => {
    panel?.classList.toggle("active", key === tabName);
  });

  const url = new URL(window.location.href);
  url.searchParams.set("tab", tabName);
  window.history.replaceState({}, "", url);
}

async function refreshFavoriteIds() {
  if (!appState.user) {
    appState.favorites = new Set();
    return;
  }

  try {
    const response = await api("/api/listings/favorites", { auth: true });
    appState.favorites = new Set((response.favorites || []).map((listing) => listing.id));
  } catch (error) {
    appState.favorites = new Set();
  }
}

async function toggleFavorite(listingId) {
  if (!requireAuth()) {
    return;
  }

  try {
    const response = await api(`/api/listings/${listingId}/favorite`, {
      method: "POST",
      auth: true,
    });
    if (response.favorite) {
      appState.favorites.add(listingId);
    } else {
      appState.favorites.delete(listingId);
    }
    showToast(response.message, "success");
    await initializeCurrentPage();
  } catch (error) {
    showToast(error.message, "error");
  }
}

function requireAuth() {
  if (appState.user) {
    return true;
  }

  showToast("Please login to continue.", "error");
  openModal("authModal");
  switchAuthTab("login");
  return false;
}

function openModal(id) {
  document.getElementById(id)?.classList.add("open");
}

function closeModal(id) {
  document.getElementById(id)?.classList.remove("open");
}

function switchAuthTab(tabName) {
  document.querySelectorAll("[data-auth-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.authTab === tabName);
  });

  document.querySelectorAll(".auth-form").forEach((form) => {
    form.classList.toggle("active", form.id === `${tabName}Form`);
  });
}

function showToast(message, variant = "success") {
  const container = document.getElementById("toastContainer");
  if (!container) {
    return;
  }

  const toast = document.createElement("div");
  toast.className = `toast ${variant}`;
  toast.textContent = message;
  container.appendChild(toast);

  window.setTimeout(() => {
    toast.remove();
  }, 3200);
}

async function api(url, options = {}) {
  const config = {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.auth && appState.token ? { Authorization: `Bearer ${appState.token}` } : {}),
    },
  };

  if (options.body) {
    config.body = JSON.stringify(options.body);
  }

  const response = await fetch(url, config);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401) {
      clearSession();
    }
    throw new Error(data.message || "Something went wrong.");
  }

  return data;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function truncateText(text, limit) {
  if (!text || text.length <= limit) {
    return text;
  }

  return `${text.slice(0, limit - 1)}...`;
}

function renderStars(value) {
  const rating = Math.round(Number(value) || 0);
  return "★★★★★".slice(0, rating) + "☆☆☆☆☆".slice(rating, 5);
}

function statCardMarkup(label, value) {
  return `
    <article class="stat-card glass-card">
      <p>${escapeHtml(label)}</p>
      <strong>${escapeHtml(String(value))}</strong>
    </article>
  `;
}

function emptyStateMarkup(title, description) {
  return `
    <div class="empty-state">
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(description)}</p>
    </div>
  `;
}

function renderCollectionState(containerId, message) {
  const container = document.getElementById(containerId);
  if (!container) {
    return;
  }

  container.innerHTML = emptyStateMarkup("Heads up", message);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
