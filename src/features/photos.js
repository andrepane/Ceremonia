import { deletePhoto, togglePhotoLike, uploadPhoto } from "../../firebase.js";
import { refs, state, getHomeCopy } from "../state.js";

const MOBILE_UPLOAD_PRESETS = {
  large: { maxEdge: 1920, quality: 0.84 },
  thumb: { maxEdge: 480, quality: 0.74 }
};

function buildProcessedFileName(fileName = "", suffix = "") {
  const base = fileName.includes(".") ? fileName.slice(0, fileName.lastIndexOf(".")) : fileName || "photo";
  const safeBase = base.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40) || "photo";
  return `${safeBase}${suffix}.jpg`;
}

function getResizedDimensions(width, height, maxEdge) {
  if (!width || !height) return { width: maxEdge, height: maxEdge };
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };
  const ratio = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio))
  };
}

async function loadImageElement(file) {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("image_load_failed"));
      img.src = objectUrl;
    });
    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function renderResizedBlob(file, { maxEdge, quality }) {
  const image = await loadImageElement(file);
  const target = getResizedDimensions(image.naturalWidth, image.naturalHeight, maxEdge);
  const canvas = document.createElement("canvas");
  canvas.width = target.width;
  canvas.height = target.height;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("canvas_not_supported");
  ctx.drawImage(image, 0, 0, target.width, target.height);
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) {
        resolve(result);
      } else {
        reject(new Error("image_encode_failed"));
      }
    }, "image/jpeg", quality);
  });
  return {
    blob,
    width: target.width,
    height: target.height
  };
}

async function buildPhotoVariants(file) {
  const [largeVersion, thumbVersion] = await Promise.all([
    renderResizedBlob(file, MOBILE_UPLOAD_PRESETS.large),
    renderResizedBlob(file, MOBILE_UPLOAD_PRESETS.thumb)
  ]);
  return {
    largeFile: new File([largeVersion.blob], buildProcessedFileName(file.name), { type: "image/jpeg" }),
    thumbFile: new File([thumbVersion.blob], buildProcessedFileName(file.name, "_thumb"), { type: "image/jpeg" }),
    width: largeVersion.width,
    height: largeVersion.height
  };
}

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

    const original = refs.uploadPhotoBtn.textContent;
    refs.uploadPhotoBtn.disabled = true;
    refs.uploadPhotoBtn.textContent = getHomeCopy().uploadLoading;
    try {
      const optimizedPhotos = await buildPhotoVariants(file);
      await uploadPhoto({
        file: optimizedPhotos.largeFile,
        thumbnailFile: optimizedPhotos.thumbFile,
        width: optimizedPhotos.width,
        height: optimizedPhotos.height,
        guestId: state.currentGuestId
      });
    } catch {
      alert(getHomeCopy().uploadError);
    } finally {
      refs.uploadPhotoBtn.disabled = false;
      refs.uploadPhotoBtn.textContent = original;
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
