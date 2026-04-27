import { deletePhoto, togglePhotoLike } from "../../firebase.js";
import { enqueuePhotoUpload } from "./photo-upload-queue.js";
import { refs, state, getHomeCopy } from "../state.js";

let photoViewerEl = null;

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
  if (likeBtn && state.currentGuestId && state.firebaseOnline) {
    const photoId = likeBtn.dataset.photoLike;
    if (!photoId || state.pendingPhotoLikes.has(photoId)) return;

    state.pendingPhotoLikes.add(photoId);
    likeBtn.disabled = true;
    likeBtn.classList.add("photo-like-btn--pulse");
    try {
      await togglePhotoLike(photoId, state.currentGuestId);
    } catch {
      alert(getHomeCopy().likeError);
    } finally {
      state.pendingPhotoLikes.delete(photoId);
      likeBtn.disabled = false;
      likeBtn.classList.remove("photo-like-btn--pulse");
    }
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
