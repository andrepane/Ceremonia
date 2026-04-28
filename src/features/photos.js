import { deletePhoto, setPhotoReaction } from "../../firebase.js";
import { enqueuePhotoUpload } from "./photo-upload-queue.js";
import { refs, state, getHomeCopy } from "../state.js";

let photoViewerEl = null;
let highlightCleanupTimeoutId = null;
let reactionMenuEl = null;
let reactionMenuPhotoId = "";
const PHOTO_REACTIONS = ["❤️", "😂", "😮", "🔥", "😍", "👏", "🤯", "🫶"];

function getPhotoViewer() {
  if (photoViewerEl) return photoViewerEl;
  photoViewerEl = document.createElement("div");
  photoViewerEl.className = "photo-viewer";
  photoViewerEl.hidden = true;
  photoViewerEl.innerHTML = `<button type="button" class="photo-viewer__close" data-photo-viewer-close aria-label="Cerrar">×</button><img class="photo-viewer__img" alt="" />`;
  document.body.appendChild(photoViewerEl);

  photoViewerEl.addEventListener("click", (event) => {
    if (event.target === photoViewerEl || event.target.closest("[data-photo-viewer-close]")) {
      closePhotoViewer();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closePhotoViewer();
  });
  return photoViewerEl;
}

function openPhotoViewer(url) {
  if (!url) return;
  const viewer = getPhotoViewer();
  const image = viewer.querySelector(".photo-viewer__img");
  image.src = url;
  image.alt = "Foto";
  viewer.hidden = false;
  document.body.classList.add("photo-viewer-open");
}

function closePhotoViewer() {
  if (!photoViewerEl || photoViewerEl.hidden) return;
  const image = photoViewerEl.querySelector(".photo-viewer__img");
  image.src = "";
  photoViewerEl.hidden = true;
  document.body.classList.remove("photo-viewer-open");
}

function focusAndHighlightPhotoCard(photoId, activityType) {
  const photoCard = document.querySelector(`[data-photo-card-id="${photoId}"]`);
  if (!photoCard) return false;

  if (highlightCleanupTimeoutId) {
    window.clearTimeout(highlightCleanupTimeoutId);
    highlightCleanupTimeoutId = null;
  }

  document
    .querySelectorAll(".photo-card--activity-highlight, .photo-card--reaction-highlight")
    .forEach((card) => card.classList.remove("photo-card--activity-highlight", "photo-card--reaction-highlight"));

  photoCard.scrollIntoView({ behavior: "smooth", block: "center" });
  photoCard.classList.add("photo-card--activity-highlight");
  if (activityType === "react_photo") {
    photoCard.classList.add("photo-card--reaction-highlight");
  }
  highlightCleanupTimeoutId = window.setTimeout(() => {
    photoCard.classList.remove("photo-card--activity-highlight", "photo-card--reaction-highlight");
    highlightCleanupTimeoutId = null;
  }, 1900);
  return true;
}

export function highlightPhotoFromActivity(photoId, activityType) {
  if (!photoId) return;
  let attempts = 0;
  const maxAttempts = 12;
  const tick = () => {
    const found = focusAndHighlightPhotoCard(photoId, activityType);
    if (found || attempts >= maxAttempts) return;
    attempts += 1;
    window.setTimeout(tick, 180);
  };
  tick();
}

export async function handleUploadPhoto() {
  if (!state.currentGuestId) return;
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert("Máximo 10MB");
      return;
    }
    if (!state.firebaseOnline) {
      alert(getHomeCopy().uploadError);
      return;
    }

    const labelEl = refs.uploadPhotoBtnLabel || refs.uploadPhotoBtn;
    const original = labelEl.textContent;
    refs.uploadPhotoBtn.disabled = true;
    labelEl.textContent = getHomeCopy().uploadLoading;
    try {
      await enqueuePhotoUpload({
        file,
        guestId: state.currentGuestId
      });
    } catch {
      alert(getHomeCopy().uploadError);
    } finally {
      refs.uploadPhotoBtn.disabled = false;
      labelEl.textContent = original;
    }
  };
  input.click();
}

export async function handlePhotoGridClick(event) {
  const likeBtn = event.target.closest("[data-photo-like]");
  if (likeBtn) {
    if (!state.currentGuestId || !state.firebaseOnline) return;
    const photoId = likeBtn.dataset.photoLike;
    if (!photoId || state.pendingPhotoLikes.has(photoId)) return;
    openReactionMenu(likeBtn, photoId);
    return;
  }

  const deleteBtn = event.target.closest("[data-photo-delete]");
  if (deleteBtn && state.firebaseOnline) {
    if (!window.confirm(getHomeCopy().deletePhotoConfirm)) return;
    try {
      await deletePhoto(deleteBtn.dataset.photoDelete);
    } catch {
      alert(getHomeCopy().deleteError);
    }
    return;
  }

  const openPhotoEl = event.target.closest("[data-photo-open]");
  if (openPhotoEl) {
    openPhotoViewer(openPhotoEl.dataset.photoOpen);
  }
}

function getReactionMenu() {
  if (reactionMenuEl) return reactionMenuEl;
  reactionMenuEl = document.createElement("div");
  reactionMenuEl.className = "reaction-menu";
  reactionMenuEl.hidden = true;
  reactionMenuEl.setAttribute("role", "menu");
  reactionMenuEl.innerHTML = PHOTO_REACTIONS.map(
    (emoji) => `<button type="button" class="reaction-menu__item" data-photo-reaction="${emoji}" aria-label="${emoji}">${emoji}</button>`
  ).join("");
  document.body.appendChild(reactionMenuEl);

  reactionMenuEl.addEventListener("click", async (event) => {
    const reactionBtn = event.target.closest("[data-photo-reaction]");
    if (!reactionBtn) return;
    const reaction = reactionBtn.dataset.photoReaction;
    if (!reaction || !reactionMenuPhotoId || !state.currentGuestId || !state.firebaseOnline) {
      closeReactionMenu();
      return;
    }

    const currentLikeBtn = document.querySelector(`[data-photo-like="${reactionMenuPhotoId}"]`);
    if (!currentLikeBtn || state.pendingPhotoLikes.has(reactionMenuPhotoId)) {
      closeReactionMenu();
      return;
    }

    state.pendingPhotoLikes.add(reactionMenuPhotoId);
    currentLikeBtn.disabled = true;
    currentLikeBtn.classList.add("photo-like-btn--pulse");
    try {
      await setPhotoReaction(reactionMenuPhotoId, state.currentGuestId, reaction);
    } catch {
      alert(getHomeCopy().likeError);
    } finally {
      state.pendingPhotoLikes.delete(reactionMenuPhotoId);
      currentLikeBtn.disabled = false;
      currentLikeBtn.classList.remove("photo-like-btn--pulse");
      closeReactionMenu();
    }
  });

  document.addEventListener("click", (event) => {
    if (!reactionMenuEl || reactionMenuEl.hidden) return;
    if (event.target.closest("[data-photo-like]")) return;
    if (event.target.closest(".reaction-menu")) return;
    closeReactionMenu();
  });
  document.addEventListener("scroll", () => closeReactionMenu(), true);
  window.addEventListener("resize", () => closeReactionMenu());
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeReactionMenu();
  });
  return reactionMenuEl;
}

function openReactionMenu(anchorEl, photoId) {
  const menu = getReactionMenu();
  reactionMenuPhotoId = photoId;
  const rect = anchorEl.getBoundingClientRect();
  const centerX = rect.left + (rect.width / 2);
  const centerY = rect.top + (rect.height / 2);

  menu.style.left = `${centerX}px`;
  menu.style.top = `${centerY}px`;
  menu.hidden = false;
}

function closeReactionMenu() {
  if (!reactionMenuEl) return;
  reactionMenuPhotoId = "";
  reactionMenuEl.hidden = true;
}
