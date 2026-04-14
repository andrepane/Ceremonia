import { deletePhoto, togglePhotoLike, uploadPhoto } from "../../firebase.js";
import { refs, state, getHomeCopy } from "../state.js";

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
    const caption = window.prompt(getHomeCopy().uploadPrompt, "") || "";
    if (!state.firebaseOnline) {
      alert(getHomeCopy().uploadError);
      return;
    }

    const original = refs.uploadPhotoBtn.textContent;
    refs.uploadPhotoBtn.disabled = true;
    refs.uploadPhotoBtn.textContent = getHomeCopy().uploadLoading;
    try {
      await uploadPhoto({ file, guestId: state.currentGuestId, caption });
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
  if (!deleteBtn || !state.firebaseOnline) return;
  if (!window.confirm(getHomeCopy().deletePhotoConfirm)) return;
  try {
    await deletePhoto(deleteBtn.dataset.photoDelete);
  } catch {
    alert(getHomeCopy().deleteError);
  }
}
