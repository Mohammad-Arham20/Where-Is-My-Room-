const STORAGE_KEYS = {
  token: "pgFinderToken",
  user: "pgFinderUser",
};

const SESSION_KEYS = {
  suppressBackOnNextPage: "pgSuppressBackOnNextPage",
  navPageTransition: "pgNavPageTransition",
};

const appState = {
  token: localStorage.getItem(STORAGE_KEYS.token) || "",
  user: readStoredUser(),
  listings: [],
  favorites: new Set(),
  currentListing: null,
  dashboard: null,
  chatSummaries: [],
  activeChatId: "",
  chatPollTimer: null,
  profileData: null,
  profileEditing: true,
};

document.addEventListener("DOMContentLoaded", async () => {
  bindGlobalInteractions();
  updateBackButtonVisibility();
  bindAuthForms();
  updateAuthUI();
  await restoreSession();
  await initializeCurrentPage();
  applyNavPageTransition();
  window.setTimeout(() => {
    initAnimatedBackground();
  }, 160);
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
  stopChatPolling();
  appState.token = "";
  appState.user = null;
  appState.favorites = new Set();
  appState.chatSummaries = [];
  appState.activeChatId = "";
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

  for (let index = 0; index < 40; index += 1) {
    const bubble = document.createElement("span");
    bubble.className = "bubble";
    bubble.style.setProperty("--size", `${randomBetween(22, 90)}px`);
    bubble.style.setProperty("--left", `${randomBetween(0, 100)}%`);
    bubble.style.setProperty("--duration", `${randomBetween(18, 38)}s`);
    bubble.style.setProperty("--delay", `${randomBetween(-24, 0)}s`);
    bubble.style.setProperty("--opacity", `${randomBetween(0.16, 0.42)}`);
    field.appendChild(bubble);
  }

  document.body.appendChild(field);
}

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function bindGlobalInteractions() {
  document.addEventListener("click", async (event) => {
    const topNavLink = event.target.closest(".site-header .nav-links .nav-link");
    if (topNavLink) {
      sessionStorage.setItem(SESSION_KEYS.suppressBackOnNextPage, "1");
      sessionStorage.setItem(SESSION_KEYS.navPageTransition, "1");
    }

    const navBackButton = event.target.closest("[data-nav-back]");
    if (navBackButton) {
      navBackButton.classList.remove("is-clicked");
      void navBackButton.offsetWidth;
      navBackButton.classList.add("is-clicked");
      playBackButtonClickSound();
      navBackButton.disabled = true;

      window.setTimeout(() => {
        if (window.history.length > 1) {
          window.history.back();
        } else {
          window.location.href = "/";
        }
      }, 230);
      return;
    }

    const openProfileButton = event.target.closest("[data-open-profile]");
    if (openProfileButton) {
      if (!appState.user) {
        showToast("Please login to open your profile.", "error");
        openModal("authModal");
        switchAuthTab("login");
        return;
      }

      if (window.location.pathname !== "/profile" && window.location.pathname !== "/profile.html") {
        window.location.href = "/profile.html";
      }
      return;
    }

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

    const profileToggleButton = event.target.closest("[data-profile-edit-toggle]");
    if (profileToggleButton) {
      toggleProfileEditor();
      return;
    }

    const favoriteButton = event.target.closest("[data-favorite-id]");
    if (favoriteButton) {
      event.preventDefault();
      await toggleFavorite(favoriteButton.dataset.favoriteId);
      return;
    }

    const deleteListingButton = event.target.closest("[data-delete-listing-id]");
    if (deleteListingButton) {
      event.preventDefault();
      await handleDeleteListing(deleteListingButton.dataset.deleteListingId);
      return;
    }

    const openChatButton = event.target.closest("[data-open-chat]");
    if (openChatButton) {
      event.preventDefault();
      await handleOpenChat(openChatButton);
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
      return;
    }

    const chatThreadButton = event.target.closest("[data-chat-thread-id]");
    if (chatThreadButton) {
      event.preventDefault();
      await openChatThread(chatThreadButton.dataset.chatThreadId);
      return;
    }

    const descriptionToggleButton = event.target.closest("[data-toggle-description]");
    if (descriptionToggleButton) {
      toggleDescriptionTile(descriptionToggleButton);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeModal("authModal");
      closeModal("contactModal");
    }
  });
}

function applyNavPageTransition() {
  const shouldAnimate = sessionStorage.getItem(SESSION_KEYS.navPageTransition) === "1";
  if (!shouldAnimate || !document.body) {
    return;
  }

  sessionStorage.removeItem(SESSION_KEYS.navPageTransition);
  window.requestAnimationFrame(() => {
    document.body.classList.add("nav-enter-transition");
    window.setTimeout(() => {
      document.body.classList.remove("nav-enter-transition");
    }, 700);
  });
}

function updateBackButtonVisibility() {
  const backButtons = document.querySelectorAll("[data-nav-back]");
  if (!backButtons.length) {
    return;
  }

  const shouldSuppress = sessionStorage.getItem(SESSION_KEYS.suppressBackOnNextPage) === "1";
  const canGoBack = window.history.length > 1;
  const shouldShow = canGoBack && !shouldSuppress;

  backButtons.forEach((button) => {
    button.classList.toggle("hidden", !shouldShow);
    button.disabled = !shouldShow;
  });

  if (shouldSuppress) {
    sessionStorage.removeItem(SESSION_KEYS.suppressBackOnNextPage);
  }
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

  if (page === "chats") {
    await initializeChatsPage();
  }

  if (page === "favorites") {
    await initializeFavoritesPage();
  }

  if (page === "profile") {
    await initializeProfilePage();
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

function enhanceHomeFilterSelects(selectElements = []) {
  if (!document.body.dataset.customSelectDismissBound) {
    document.body.dataset.customSelectDismissBound = "true";
    document.addEventListener("click", (event) => {
      if (!event.target.closest(".custom-select")) {
        closeAllCustomSelects();
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeAllCustomSelects();
      }
    });
  }

  selectElements.forEach((selectElement) => {
    if (!selectElement || selectElement.dataset.customSelectBound) {
      return;
    }

    selectElement.dataset.customSelectBound = "true";
    selectElement.classList.add("custom-select-native");

    const wrapper = document.createElement("div");
    wrapper.className = "custom-select";

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "custom-select-trigger";
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");

    const label = document.createElement("span");
    label.className = "custom-select-label";
    trigger.appendChild(label);

    const menu = document.createElement("div");
    menu.className = "custom-select-menu";
    menu.setAttribute("role", "listbox");

    Array.from(selectElement.options).forEach((optionElement) => {
      const optionButton = document.createElement("button");
      optionButton.type = "button";
      optionButton.className = "custom-select-option";
      optionButton.dataset.value = optionElement.value;
      optionButton.textContent = optionElement.textContent || "";
      optionButton.setAttribute("role", "option");
      menu.appendChild(optionButton);
    });

    wrapper.append(trigger, menu);
    selectElement.insertAdjacentElement("afterend", wrapper);

    const syncCustomSelectState = () => {
      const selectedOption = selectElement.options[selectElement.selectedIndex];
      label.textContent = selectedOption?.textContent || "";

      menu.querySelectorAll(".custom-select-option").forEach((optionButton) => {
        const isActive = optionButton.dataset.value === selectElement.value;
        optionButton.classList.toggle("active", isActive);
        optionButton.setAttribute("aria-selected", String(isActive));
      });
    };

    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const shouldOpen = !wrapper.classList.contains("open");
      closeAllCustomSelects();
      if (shouldOpen) {
        wrapper.classList.add("open");
        trigger.setAttribute("aria-expanded", "true");
      }
    });

    menu.addEventListener("click", (event) => {
      const optionButton = event.target.closest(".custom-select-option");
      if (!optionButton) {
        return;
      }
      const { value } = optionButton.dataset;
      if (typeof value !== "string") {
        return;
      }

      selectElement.value = value;
      syncCustomSelectState();
      closeAllCustomSelects();
      selectElement.dispatchEvent(new Event("input", { bubbles: true }));
      selectElement.dispatchEvent(new Event("change", { bubbles: true }));
    });

    selectElement.addEventListener("change", syncCustomSelectState);
    selectElement.addEventListener("input", syncCustomSelectState);
    selectElement.addEventListener("custom-select-sync", syncCustomSelectState);
    syncCustomSelectState();
  });
}

function closeAllCustomSelects() {
  document.querySelectorAll(".custom-select.open").forEach((customSelect) => {
    customSelect.classList.remove("open");
    const trigger = customSelect.querySelector(".custom-select-trigger");
    trigger?.setAttribute("aria-expanded", "false");
  });
}

function syncCustomSelectUi(selectElement) {
  selectElement?.dispatchEvent(new Event("custom-select-sync"));
}

function bindHomeFilters() {
  const searchInput = document.getElementById("searchInput");
  const budgetRange = document.getElementById("budgetRange");
  const locationFilter = document.getElementById("locationFilter");
  const roomTypeFilter = document.getElementById("roomTypeFilter");
  const clearFiltersButton = document.getElementById("clearFiltersBtn");

  enhanceHomeFilterSelects([locationFilter, roomTypeFilter]);

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
      syncCustomSelectUi(locationFilter);
    }
    if (roomTypeFilter) {
      roomTypeFilter.value = "All";
      syncCustomSelectUi(roomTypeFilter);
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

function listingCardMarkup(listing, options = {}) {
  const showDelete = Boolean(options.showDelete);
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
          <div class="card-action-primary">
            <a class="btn btn-primary" href="/details?id=${listing.id}">View details</a>
            ${
              showDelete
                ? `<button class="btn btn-danger" type="button" data-delete-listing-id="${listing.id}">Remove</button>`
                : ""
            }
          </div>
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
  const listingImageFile = document.getElementById("listingImageFile");
  const listingImagePreviewWrap = document.getElementById("listingImagePreviewWrap");
  const listingImagePreview = document.getElementById("listingImagePreview");
  const listingImageUrlInput = listingForm?.querySelector('input[name="imageUrl"]');

  if (listingImageFile && !listingImageFile.dataset.bound) {
    listingImageFile.dataset.bound = "true";
    listingImageFile.addEventListener("change", () => {
      const [file] = listingImageFile.files || [];
      if (!file || !listingImagePreview || !listingImagePreviewWrap) {
        listingImagePreviewWrap?.classList.add("hidden");
        return;
      }

      const objectUrl = URL.createObjectURL(file);
      listingImagePreview.src = objectUrl;
      listingImagePreviewWrap.classList.remove("hidden");
    });
  }

  if (listingImageUrlInput && !listingImageUrlInput.dataset.bound) {
    listingImageUrlInput.dataset.bound = "true";
    listingImageUrlInput.addEventListener("input", () => {
      const url = listingImageUrlInput.value.trim();
      if (!url || !listingImagePreview || !listingImagePreviewWrap) {
        if (!listingImageFile?.files?.length) {
          listingImagePreviewWrap?.classList.add("hidden");
        }
        return;
      }

      if (!listingImageFile?.files?.length) {
        listingImagePreview.src = url;
        listingImagePreviewWrap.classList.remove("hidden");
      }
    });
  }

  if (listingForm && !listingForm.dataset.bound) {
    listingForm.dataset.bound = "true";
    listingForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      if (!requireAuth()) {
        return;
      }

      const formData = new FormData(listingForm);
      const payload = Object.fromEntries(formData.entries());
      const selectedImageFile = formData.get("imageFile");
      delete payload.imageFile;

      try {
        if (selectedImageFile instanceof File && selectedImageFile.size > 0) {
          if (selectedImageFile.size > 5 * 1024 * 1024) {
            showToast("Please upload an image smaller than 5MB.", "error");
            return;
          }

          payload.imageUrl = await fileToDataUrl(selectedImageFile);
        } else {
          payload.imageUrl = String(payload.imageUrl || "").trim();
        }

        const response = await api("/api/listings", {
          method: "POST",
          body: payload,
          auth: true,
        });
        listingForm.reset();
        if (listingImagePreviewWrap) {
          listingImagePreviewWrap.classList.add("hidden");
        }
        if (listingImagePreview) {
          listingImagePreview.src = "";
        }
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

  const detailDescription = String(listing.description || "").trim();
  const normalizedDescription = detailDescription || "No description provided.";
  const descriptionNeedsToggle = normalizedDescription.length > 130;

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
            <div class="glass-inset detail-extra-expenses">
              <span>Extra expenses</span>
              <strong class="meta-note">
                Depends on usage. Ex. - Electricity bill, Water bill, etc.
              </strong>
            </div>
          </div>

          <div class="glass-inset detail-description-tile" data-description-tile>
            <span>Description</span>
            <p class="detail-description-text ${descriptionNeedsToggle ? "is-clamped" : ""}" data-description-text>
              ${escapeHtml(normalizedDescription)}
            </p>
            ${
              descriptionNeedsToggle
                ? `
                  <button class="detail-read-toggle" type="button" data-toggle-description aria-expanded="false">
                    Read more
                  </button>
                `
                : ""
            }
          </div>

          <div class="detail-actions">
            <button class="btn btn-secondary" data-open-chat data-chat-listing-id="${listing.id}">
              Chat with owner
            </button>
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

        <div class="review-card">
          <span class="eyebrow">Facilities provided</span>
          <ul class="facilities-list">
            <li>Electricity (as per usage)</li>
            <li>Laundry</li>
            <li>Water supply</li>
            <li>Parking</li>
            <li>Wi-Fi</li>
            <li>Power backup</li>
          </ul>
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

function toggleDescriptionTile(button) {
  const tile = button.closest("[data-description-tile]");
  const descriptionText = tile?.querySelector("[data-description-text]");

  if (!tile || !descriptionText) {
    return;
  }

  const expanded = tile.classList.toggle("expanded");
  descriptionText.classList.toggle("is-clamped", !expanded);
  button.textContent = expanded ? "Show less" : "Read more";
  button.setAttribute("aria-expanded", String(expanded));
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

async function initializeProfilePage() {
  const authState = document.getElementById("profileAuthState");
  const profileContent = document.getElementById("profileContent");
  const greeting = document.getElementById("profileGreeting");
  const subtitle = document.getElementById("profileSubtitle");

  if (greeting) {
    greeting.textContent = appState.user ? `${appState.user.name}'s Profile` : "Your profile";
  }

  if (subtitle) {
    subtitle.textContent = "Keep your student and roommate preferences updated in one place.";
  }

  if (!appState.user) {
    appState.profileData = null;
    appState.profileEditing = true;
    if (authState) {
      authState.classList.remove("hidden");
      authState.innerHTML = `
        <h2>Profile unlocks after login</h2>
        <p>Your personal details are visible and editable only for your account.</p>
        <button class="btn btn-primary" data-open-auth data-auth-tab="login">Login / Register</button>
      `;
    }
    profileContent?.classList.add("hidden");
    return;
  }

  try {
    const response = await api("/api/auth/profile", { auth: true });
    const profile = response.profile || response.user?.profile || {};

    if (response.user) {
      appState.user = response.user;
      localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(response.user));
      updateAuthUI();
      if (greeting) {
        greeting.textContent = `${response.user.name}'s Profile`;
      }
    }

    appState.profileData = profile;
    appState.profileEditing = !isProfileComplete(profile);
    renderProfileSummary(profile);
    setProfileFormValues(profile);
    bindProfileForm();
    applyProfileLayoutState();

    authState?.classList.add("hidden");
    profileContent?.classList.remove("hidden");
  } catch (error) {
    appState.profileData = null;
    appState.profileEditing = true;
    if (authState) {
      authState.classList.remove("hidden");
      authState.innerHTML = `<p>${escapeHtml(error.message)}</p>`;
    }
    profileContent?.classList.add("hidden");
  }
}

function renderProfileSummary(profile) {
  const summaryCard = document.getElementById("profileSummaryCard");
  if (!summaryCard) {
    return;
  }

  const safeProfile = profile || {};
  const profileComplete = isProfileComplete(safeProfile);
  const budgetLabel =
    safeProfile.monthlyBudget || safeProfile.monthlyBudget === 0
      ? formatCurrency(Number(safeProfile.monthlyBudget))
      : "Not set";
  const lifestyleBits = [safeProfile.foodPreference, safeProfile.sleepSchedule, safeProfile.cleanlinessLevel]
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  summaryCard.innerHTML = `
    <div class="profile-summary-top">
      <div class="profile-head">
        <div class="profile-avatar">${escapeHtml(getNameInitials(appState.user?.name || "User"))}</div>
        <div>
          <h2>${escapeHtml(appState.user?.name || "Student User")}</h2>
          <p>${escapeHtml(appState.user?.email || "")}</p>
        </div>
      </div>
      ${
        profileComplete
          ? `
            <button class="btn btn-secondary profile-edit-toggle-btn" type="button" data-profile-edit-toggle>
              ${appState.profileEditing ? "Done" : "Edit"}
            </button>
          `
          : `<span class="soft-badge profile-pending-badge">Complete profile to lock layout</span>`
      }
    </div>

    <div class="profile-kv-grid">
      ${profileKvItemMarkup("Phone", safeProfile.phone)}
      ${profileKvItemMarkup("College", safeProfile.college)}
      ${profileKvItemMarkup("Course", safeProfile.course)}
      ${profileKvItemMarkup("Year", safeProfile.yearOfStudy)}
      ${profileKvItemMarkup("Preferred location", safeProfile.preferredLocation)}
      ${profileKvItemMarkup("Budget", budgetLabel)}
      ${profileKvItemMarkup("Gender", safeProfile.gender)}
      ${profileKvItemMarkup("Smoking", safeProfile.smokingPreference)}
      ${profileKvItemMarkup("Lifestyle", lifestyleBits.join(" · "))}
      ${profileKvItemMarkup("Hobbies", safeProfile.hobbies)}
      ${profileKvItemMarkup("Emergency contact", [safeProfile.emergencyContactName, safeProfile.emergencyContactPhone].filter(Boolean).join(" · "))}
    </div>

    ${
      profileComplete
        ? `<p class="profile-complete-text">Profile completed. Use Edit to update details anytime.</p>`
        : ""
    }

    <div class="profile-about glass-inset">
      <span class="eyebrow">About me</span>
      <p>${escapeHtml(profileDisplayValue(safeProfile.aboutMe, "Tell others a bit about your routine and preferences."))}</p>
    </div>
  `;
}

function hasProfileValue(value) {
  return String(value ?? "").trim().length > 0;
}

function isProfileComplete(profile) {
  const safeProfile = profile || {};
  const requiredFields = [
    "phone",
    "college",
    "course",
    "yearOfStudy",
    "preferredLocation",
    "gender",
    "foodPreference",
    "sleepSchedule",
    "smokingPreference",
    "cleanlinessLevel",
    "hobbies",
    "aboutMe",
    "emergencyContactName",
    "emergencyContactPhone",
  ];

  const allTextReady = requiredFields.every((field) => hasProfileValue(safeProfile[field]));
  const budgetReady = Number(safeProfile.monthlyBudget) > 0;
  const nameReady = hasProfileValue(appState.user?.name);

  return allTextReady && budgetReady && nameReady;
}

function applyProfileLayoutState() {
  const profileContent = document.getElementById("profileContent");
  if (!profileContent) {
    return;
  }

  const profileComplete = isProfileComplete(appState.profileData || {});
  const shouldCollapse = profileComplete && !appState.profileEditing;
  profileContent.classList.toggle("profile-collapsed", shouldCollapse);
}

function toggleProfileEditor() {
  const profileComplete = isProfileComplete(appState.profileData || {});
  if (!profileComplete) {
    showToast("Complete all profile fields first to enable compact profile mode.", "error");
    appState.profileEditing = true;
    applyProfileLayoutState();
    return;
  }

  appState.profileEditing = !appState.profileEditing;
  renderProfileSummary(appState.profileData || {});
  applyProfileLayoutState();
}

function profileKvItemMarkup(label, value) {
  return `
    <div class="profile-kv-item glass-inset">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(profileDisplayValue(value))}</strong>
    </div>
  `;
}

function setProfileFormValues(profile) {
  const form = document.getElementById("profileForm");
  if (!form) {
    return;
  }

  const safeProfile = profile || {};
  const fields = [
    "name",
    "phone",
    "college",
    "course",
    "yearOfStudy",
    "preferredLocation",
    "monthlyBudget",
    "gender",
    "foodPreference",
    "sleepSchedule",
    "smokingPreference",
    "cleanlinessLevel",
    "hobbies",
    "aboutMe",
    "emergencyContactName",
    "emergencyContactPhone",
  ];

  fields.forEach((field) => {
    const input = form.elements[field];
    if (!input) {
      return;
    }

    if (field === "name") {
      input.value = appState.user?.name || "";
      return;
    }

    if (field === "monthlyBudget") {
      input.value =
        safeProfile.monthlyBudget || safeProfile.monthlyBudget === 0
          ? String(safeProfile.monthlyBudget)
          : "";
      return;
    }

    input.value = safeProfile[field] ? String(safeProfile[field]) : "";
  });
}

function bindProfileForm() {
  const form = document.getElementById("profileForm");
  if (!form || form.dataset.bound) {
    return;
  }

  form.dataset.bound = "true";
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!requireAuth()) {
      return;
    }

    const payload = Object.fromEntries(new FormData(form).entries());
    payload.name = String(payload.name || "").trim();

    if (!payload.name) {
      showToast("Name is required to save your profile.", "error");
      return;
    }

    try {
      const response = await api("/api/auth/profile", {
        method: "PUT",
        body: payload,
        auth: true,
      });

      if (response.user) {
        setSession(appState.token, response.user);
      }

      const updatedProfile = response.profile || response.user?.profile || {};
      appState.profileData = updatedProfile;
      appState.profileEditing = !isProfileComplete(updatedProfile);
      setProfileFormValues(updatedProfile);
      renderProfileSummary(updatedProfile);
      applyProfileLayoutState();
      showToast(response.message || "Profile updated successfully.", "success");
    } catch (error) {
      showToast(error.message, "error");
    }
  });
}

function profileDisplayValue(value, fallback = "Not set") {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

function getNameInitials(name) {
  const words = String(name || "")
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean);

  if (!words.length) {
    return "U";
  }

  if (words.length === 1) {
    return words[0].slice(0, 1).toUpperCase();
  }

  return `${words[0].slice(0, 1)}${words[1].slice(0, 1)}`.toUpperCase();
}

async function initializeDashboardPage() {
  const authState = document.getElementById("dashboardAuthState");
  const dashboardContent = document.getElementById("dashboardContent");

  if (!appState.user) {
    if (authState) {
      authState.innerHTML = `
        <h2>Your dashboard unlocks after login</h2>
        <p>Track active posts, listing activity, and roommate matches in one place.</p>
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

async function initializeFavoritesPage() {
  const authState = document.getElementById("favoritesAuthState");
  const favoritesContent = document.getElementById("favoritesContent");
  const favoritesCount = document.getElementById("favoritesCount");

  if (!appState.user) {
    if (authState) {
      authState.innerHTML = `
        <h2>Your favorites unlock after login</h2>
        <p>Save listings you like and manage your shortlist from this page.</p>
        <button class="btn btn-primary" data-open-auth data-auth-tab="login">Login / Register</button>
      `;
      authState.classList.remove("hidden");
    }
    favoritesContent?.classList.add("hidden");
    if (favoritesCount) {
      favoritesCount.textContent = "0 saved";
    }
    return;
  }

  try {
    await renderFavoritesPage();
    authState?.classList.add("hidden");
    favoritesContent?.classList.remove("hidden");
  } catch (error) {
    if (authState) {
      authState.classList.remove("hidden");
      authState.innerHTML = `<p>${escapeHtml(error.message)}</p>`;
    }
    favoritesContent?.classList.add("hidden");
  }
}

async function renderFavoritesPage() {
  const favoritesGrid = document.getElementById("favoritesGrid");
  const favoritesCount = document.getElementById("favoritesCount");
  if (!favoritesGrid) {
    return;
  }

  const response = await api("/api/listings/favorites", { auth: true });
  const favorites = response.favorites || [];
  appState.favorites = new Set(favorites.map((listing) => listing.id));

  if (favoritesCount) {
    favoritesCount.textContent = `${favorites.length} saved`;
  }

  if (!favorites.length) {
    favoritesGrid.innerHTML = emptyStateMarkup(
      "No favorites yet",
      "Tap the heart icon on any listing to save it here."
    );
    return;
  }

  favoritesGrid.innerHTML = favorites.map((listing) => listingCardMarkup(listing)).join("");
}

function stopChatPolling() {
  if (appState.chatPollTimer) {
    window.clearInterval(appState.chatPollTimer);
    appState.chatPollTimer = null;
  }
}

async function handleOpenChat(triggerElement) {
  if (!requireAuth()) {
    return;
  }

  const listingId = String(triggerElement?.dataset?.chatListingId || "").trim();
  const recipientId = String(triggerElement?.dataset?.chatRecipientId || "").trim();

  if (!listingId && !recipientId) {
    showToast("Unable to determine who to chat with.", "error");
    return;
  }

  try {
    const response = await api("/api/chats/start", {
      method: "POST",
      body: {
        listingId: listingId || undefined,
        recipientId: recipientId || undefined,
      },
      auth: true,
    });

    const chatId = response.chat?.id;
    if (!chatId) {
      showToast("Could not start chat right now.", "error");
      return;
    }

    window.location.href = `/chats.html?chat=${encodeURIComponent(chatId)}`;
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function initializeChatsPage() {
  const authState = document.getElementById("chatsAuthState");
  const chatsContent = document.getElementById("chatsContent");
  const chatComposerForm = document.getElementById("chatComposerForm");

  stopChatPolling();

  if (!appState.user) {
    if (authState) {
      authState.innerHTML = `
        <h2>Chats unlock after login</h2>
        <p>Login to message PG owners and manage all conversations in one place.</p>
        <button class="btn btn-primary" data-open-auth data-auth-tab="login">Login / Register</button>
      `;
      authState.classList.remove("hidden");
    }
    chatsContent?.classList.add("hidden");
    return;
  }

  bindChatComposer(chatComposerForm);

  try {
    await loadChatSummaries();
    const queryChatId = new URLSearchParams(window.location.search).get("chat");
    const targetChatId =
      queryChatId && appState.chatSummaries.some((chat) => chat.id === queryChatId)
        ? queryChatId
        : "";

    if (targetChatId) {
      await openChatThread(targetChatId, { skipSummaryReload: true, forceScrollBottom: true });
    } else {
      renderActiveChatPanel(null);
    }

    authState?.classList.add("hidden");
    chatsContent?.classList.remove("hidden");

    appState.chatPollTimer = window.setInterval(async () => {
      if (document.hidden) {
        return;
      }

      const activeChatId = appState.activeChatId;
      await loadChatSummaries();
      if (activeChatId && appState.chatSummaries.some((chat) => chat.id === activeChatId)) {
        await openChatThread(activeChatId, { skipSummaryReload: true, preserveScrollPosition: true });
      }
    }, 4500);
  } catch (error) {
    if (authState) {
      authState.classList.remove("hidden");
      authState.innerHTML = `<p>${escapeHtml(error.message)}</p>`;
    }
    chatsContent?.classList.add("hidden");
  }
}

function bindChatComposer(form) {
  if (!form || form.dataset.bound) {
    return;
  }

  form.dataset.bound = "true";
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!requireAuth()) {
      return;
    }

    const chatInput = document.getElementById("chatInput");
    const sendButton = document.getElementById("chatSendBtn");
    const text = String(chatInput?.value || "").trim();

    if (!appState.activeChatId) {
      showToast("Select a chat before sending a message.", "error");
      return;
    }

    if (!text) {
      return;
    }

    try {
      if (sendButton) {
        sendButton.disabled = true;
      }

      await api(`/api/chats/${appState.activeChatId}/messages`, {
        method: "POST",
        body: { text },
        auth: true,
      });

      if (chatInput) {
        chatInput.value = "";
      }

      await loadChatSummaries();
      await openChatThread(appState.activeChatId, { skipSummaryReload: true, forceScrollBottom: true });
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      if (sendButton) {
        sendButton.disabled = false;
      }
    }
  });
}

async function loadChatSummaries() {
  const response = await api("/api/chats", { auth: true });
  appState.chatSummaries = response.chats || [];
  renderChatThreadList();
}

function renderChatThreadList() {
  const threadList = document.getElementById("chatThreadList");
  const chatThreadCount = document.getElementById("chatThreadCount");

  if (!threadList) {
    return;
  }

  if (chatThreadCount) {
    chatThreadCount.textContent = `${appState.chatSummaries.length} chat${appState.chatSummaries.length === 1 ? "" : "s"}`;
  }

  if (!appState.chatSummaries.length) {
    threadList.innerHTML = emptyStateMarkup(
      "No chats yet",
      "Open any listing and click chat with owner to start your first conversation."
    );
    return;
  }

  threadList.innerHTML = appState.chatSummaries
    .map((chat) => {
      const isActive = chat.id === appState.activeChatId;
      const previewText = chat.lastMessage?.text || "No messages yet";
      const previewLabel = chat.listingTitle ? `${chat.listingTitle} · ${previewText}` : previewText;
      return `
        <button type="button" class="chat-thread-btn ${isActive ? "active" : ""}" data-chat-thread-id="${chat.id}">
          <div class="chat-thread-top">
            <strong>${escapeHtml(chat.otherUser?.name || "Unknown user")}</strong>
            <span>${escapeHtml(formatChatTime(chat.lastMessage?.createdAt || chat.updatedAt))}</span>
          </div>
          <p>${escapeHtml(truncateText(previewLabel, 78) || "No messages yet")}</p>
          <div class="chat-thread-meta">
            <span class="soft-badge">${escapeHtml(chat.listingTitle ? "Listing chat" : "Direct chat")}</span>
            ${chat.unreadCount ? `<span class="chat-unread-badge">${chat.unreadCount}</span>` : ""}
          </div>
        </button>
      `;
    })
    .join("");
}

async function openChatThread(chatId, options = {}) {
  const targetChatId = String(chatId || "").trim();
  if (!targetChatId) {
    return;
  }

  if (!options.skipSummaryReload) {
    await loadChatSummaries();
  }

  const activeChatExists = appState.chatSummaries.some((chat) => chat.id === targetChatId);
  if (!activeChatExists) {
    renderActiveChatPanel(null);
    return;
  }

  const response = await api(`/api/chats/${targetChatId}`, { auth: true });
  appState.activeChatId = targetChatId;
  renderChatThreadList();
  renderActiveChatPanel(response.chat, options);
  setActiveChatQuery(targetChatId);
}

function setActiveChatQuery(chatId) {
  const nextUrl = new URL(window.location.href);
  if (chatId) {
    nextUrl.searchParams.set("chat", chatId);
  } else {
    nextUrl.searchParams.delete("chat");
  }
  window.history.replaceState({}, "", nextUrl);
}

function renderActiveChatPanel(chat, options = {}) {
  const chatLayout = document.getElementById("chatLayout");
  const emptyState = document.getElementById("chatEmptyState");
  const activeView = document.getElementById("chatActiveView");
  const chatHeader = document.getElementById("chatHeader");
  const chatMessages = document.getElementById("chatMessages");

  if (!activeView || !chatHeader || !chatMessages || !emptyState) {
    return;
  }

  if (!chat) {
    appState.activeChatId = "";
    setActiveChatQuery("");
    chatLayout?.classList.add("chat-layout-idle");
    chatLayout?.classList.remove("chat-layout-active");
    emptyState.classList.remove("hidden");
    activeView.classList.add("hidden");
    chatHeader.innerHTML = "";
    chatMessages.innerHTML = "";
    return;
  }

  chatLayout?.classList.remove("chat-layout-idle");
  chatLayout?.classList.add("chat-layout-active");
  emptyState.classList.add("hidden");
  activeView.classList.remove("hidden");

  chatHeader.innerHTML = `
    <div>
      <h3>${escapeHtml(chat.otherUser?.name || "Chat")}</h3>
      <p>${escapeHtml(chat.listingTitle || "Direct conversation")}</p>
    </div>
    <span class="soft-badge">${escapeHtml(chat.unreadCount ? `${chat.unreadCount} unread` : "All caught up")}</span>
  `;

  const isNearBottom =
    chatMessages.scrollHeight - chatMessages.scrollTop - chatMessages.clientHeight < 90;

  chatMessages.innerHTML = (chat.messages || [])
    .map(
      (message) => `
        <article class="chat-message ${message.isMine ? "mine" : "theirs"}">
          <p>${escapeHtml(message.text)}</p>
          <span>${escapeHtml(formatChatTime(message.createdAt, true))}</span>
        </article>
      `
    )
    .join("");

  if (!chat.messages?.length) {
    chatMessages.innerHTML = emptyStateMarkup(
      "No messages yet",
      "Say hello and ask about rent, location, and move-in details."
    );
  }

  if (options.forceScrollBottom || !options.preserveScrollPosition || isNearBottom) {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
}

function renderDashboard(summary) {
  const greeting = document.getElementById("dashboardGreeting");
  const subtitle = document.getElementById("dashboardSubtitle");
  const statsGrid = document.getElementById("statsGrid");
  const overviewPanel = document.getElementById("overviewPanel");
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

  if (listingsPanel) {
    listingsPanel.innerHTML = `
      <div class="dashboard-section-card">
        <span class="eyebrow">My active listings</span>
        <div class="compact-grid">
          ${
            summary.myListings.length
              ? summary.myListings
                  .map((listing) => listingCardMarkup(listing, { showDelete: true }))
                  .join("")
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
  const normalizedTab = ["overview", "listings", "roommates"].includes(tabName) ? tabName : "overview";

  document.querySelectorAll("[data-dashboard-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.dashboardTab === normalizedTab);
  });

  const panels = {
    overview: document.getElementById("overviewPanel"),
    listings: document.getElementById("listingsPanel"),
    roommates: document.getElementById("roommatesPanel"),
  };

  Object.entries(panels).forEach(([key, panel]) => {
    panel?.classList.toggle("active", key === normalizedTab);
  });

  const url = new URL(window.location.href);
  url.searchParams.set("tab", normalizedTab);
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

async function handleDeleteListing(listingId) {
  if (!requireAuth()) {
    return;
  }

  const targetId = String(listingId || "").trim();
  if (!targetId) {
    return;
  }

  const shouldDelete = window.confirm(
    "Do you want to remove this PG listing? This action cannot be undone."
  );
  if (!shouldDelete) {
    return;
  }

  try {
    const response = await api(`/api/listings/${targetId}`, {
      method: "DELETE",
      auth: true,
    });

    showToast(response.message || "Listing removed successfully.", "success");

    if (appState.currentListing?.id === targetId) {
      window.setTimeout(() => {
        window.location.href = "/dashboard?tab=listings";
      }, 300);
      return;
    }

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

function playBackButtonClickSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) {
      return;
    }

    const context = new AudioCtx();
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(780, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(520, context.currentTime + 0.075);

    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.028, context.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.085);

    oscillator.connect(gain);
    gain.connect(context.destination);

    oscillator.start(context.currentTime);
    oscillator.stop(context.currentTime + 0.09);
    oscillator.onended = () => {
      context.close().catch(() => {});
    };
  } catch (error) {
    // Sound is optional; fail silently if browser blocks or lacks support.
  }
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Unable to read the selected image file."));
    reader.readAsDataURL(file);
  });
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

function formatChatTime(value, includeTime = false) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (includeTime || sameDay) {
    return new Intl.DateTimeFormat("en-IN", {
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
  }).format(date);
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
