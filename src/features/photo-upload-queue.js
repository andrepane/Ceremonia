import { uploadPhoto } from "../../firebase.js";
import { getHomeCopy, refs, state } from "../state.js";

const UPLOAD_TIMEOUT_MS = 90_000;

function updateUploadButtonStatus(status = "", progress = null) {
  if (!refs.uploadPhotoBtn) return;
  const labelEl = refs.uploadPhotoBtnLabel || refs.uploadPhotoBtn;
  if (!status) {
    refs.uploadPhotoBtn.dataset.uploadProgress = "";
    refs.uploadPhotoBtn.dataset.uploadStatus = "";
    if (refs.uploadPhotoBtnProgressText) refs.uploadPhotoBtnProgressText.textContent = "";
    return;
  }

  refs.uploadPhotoBtn.dataset.uploadProgress = String(progress ?? "");
  refs.uploadPhotoBtn.dataset.uploadStatus = status;
  if (labelEl) labelEl.textContent = status;
  if (refs.uploadPhotoBtnProgressText) refs.uploadPhotoBtnProgressText.textContent = progress === null ? status : `${status} ${Math.round((Number(progress) || 0) * 100)}%`;
}

function uuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function withUploadTimeout(taskPromise, timeoutMs) {
  let timeoutId = null;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error("upload_timeout")), timeoutMs);
  });
  return Promise.race([taskPromise, timeoutPromise]).finally(() => {
    if (timeoutId) window.clearTimeout(timeoutId);
  });
}

export async function enqueuePhotoUpload({ file, guestId }) {
  const uploadId = uuid();
  updateUploadButtonStatus(getHomeCopy().uploadLoading, 0);
  try {
    const optimizedPhotos = await buildPhotoVariants(file);
    await withUploadTimeout(
      uploadPhoto({
        file: optimizedPhotos.largeFile,
        thumbnailFile: optimizedPhotos.thumbFile,
        width: optimizedPhotos.width,
        height: optimizedPhotos.height,
        guestId,
        uploadId,
        onProgress: ({ overallProgress = 0 }) => {
          updateUploadButtonStatus(getHomeCopy().uploadLoading, overallProgress);
        }
      }),
      UPLOAD_TIMEOUT_MS
    );
    updateUploadButtonStatus("");
  } catch (error) {
    updateUploadButtonStatus(getHomeCopy().uploadFailed);
    throw error;
  } finally {
    updateUploadButtonStatus("");
  }
}

export function startPhotoUploadQueue() {
  updateUploadButtonStatus("");
  state.firebaseOnline = navigator.onLine;
}

const MOBILE_UPLOAD_PRESETS = {
  large: { maxEdge: 1600, quality: 0.78 },
  thumb: { maxEdge: 300, quality: 0.55 }
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
      if (result) resolve(result);
      else reject(new Error("image_encode_failed"));
    }, "image/jpeg", quality);
  });
  return {
    blob,
    width: target.width,
    height: target.height
  };
}

export async function buildPhotoVariants(file) {
  try {
    const largeVersion = await renderResizedBlob(file, MOBILE_UPLOAD_PRESETS.large);
    const thumbVersion = await renderResizedBlob(file, MOBILE_UPLOAD_PRESETS.thumb);
    return {
      largeFile: new File([largeVersion.blob], buildProcessedFileName(file.name), { type: "image/jpeg" }),
      thumbFile: new File([thumbVersion.blob], buildProcessedFileName(file.name, "_thumb"), { type: "image/jpeg" }),
      width: largeVersion.width,
      height: largeVersion.height
    };
  } catch (error) {
    console.warn("[UPLOAD] image transform failed, uploading original file", error);
    return {
      largeFile: file,
      thumbFile: file,
      width: 0,
      height: 0
    };
  }
}
