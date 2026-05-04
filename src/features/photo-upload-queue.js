import { uploadPhoto } from "../../firebase.js";
import { getHomeCopy, refs, state } from "../state.js";

const DB_NAME = "ceremonia-photo-uploads";
const DB_VERSION = 1;
const STORE_NAME = "uploadJobs";
const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [2000, 5000, 10000];
const UPLOAD_TIMEOUT_MS = 20_000;

let isProcessing = false;
let queueStarted = false;
let dbPromise = null;

function supportsIndexedDb() {
  return typeof indexedDB !== "undefined";
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function openQueueDb() {
  if (!supportsIndexedDb()) return Promise.resolve(null);
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error || new Error("idb_open_failed"));
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("by_status", "status", { unique: false });
        store.createIndex("by_createdAt", "createdAt", { unique: false });
        store.createIndex("by_nextAttemptAt", "nextAttemptAt", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });

  return dbPromise;
}

function idbRequestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onerror = () => reject(request.error || new Error("idb_request_failed"));
    request.onsuccess = () => resolve(request.result);
  });
}

function idbTransactionToPromise(tx) {
  return new Promise((resolve, reject) => {
    tx.onerror = () => reject(tx.error || new Error("idb_tx_failed"));
    tx.onabort = () => reject(tx.error || new Error("idb_tx_aborted"));
    tx.oncomplete = () => resolve();
  });
}

async function putJob(job) {
  const db = await openQueueDb();
  if (!db) return;
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).put(job);
  await idbTransactionToPromise(tx);
}

async function deleteJob(jobId) {
  const db = await openQueueDb();
  if (!db) return;
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).delete(jobId);
  await idbTransactionToPromise(tx);
}

async function listJobs() {
  const db = await openQueueDb();
  if (!db) return [];
  const tx = db.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);
  const jobs = await idbRequestToPromise(store.getAll());
  return Array.isArray(jobs)
    ? jobs.sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0))
    : [];
}

function buildRetryDelay(attempts) {
  const index = Math.max(0, Math.min((Number(attempts) || 1) - 1, RETRY_DELAYS_MS.length - 1));
  return RETRY_DELAYS_MS[index];
}

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

async function uploadQueueJob(job) {
  const currentAttempts = Number(job.attempts) || 0;
  const nextJob = {
    ...job,
    status: "uploading",
    attempts: currentAttempts,
    updatedAt: Date.now(),
    nextAttemptAt: Date.now()
  };
  await putJob(nextJob);

  console.log("[UPLOAD] start", job.id);
  updateUploadButtonStatus(getHomeCopy().uploadLoading, 0);

  const optimizedPhotos = await buildPhotoVariants(job.file);

  await withUploadTimeout(
    uploadPhoto({
      file: optimizedPhotos.largeFile,
      thumbnailFile: optimizedPhotos.thumbFile,
      width: optimizedPhotos.width,
      height: optimizedPhotos.height,
      guestId: job.guestId,
      uploadId: job.id,
      onProgress: ({ overallProgress = 0 }) => {
        updateUploadButtonStatus(getHomeCopy().uploadLoading, overallProgress);
      }
    }),
    UPLOAD_TIMEOUT_MS
  );

  await deleteJob(job.id);
  console.log("[UPLOAD] success", job.id);
}

export async function processUploadQueue() {
  if (isProcessing) return;
  if (!state.firebaseOnline || !navigator.onLine) return;
  isProcessing = true;

  try {
    const now = Date.now();
    const jobs = await listJobs();
    for (const job of jobs) {
      if (!state.currentGuestId && !job.guestId) continue;
      if (!state.firebaseOnline || !navigator.onLine) break;
      if (Number(job.nextAttemptAt || 0) > now) continue;

      try {
        await uploadQueueJob(job);
      } catch (error) {
        const attempts = (Number(job.attempts) || 0) + 1;
        const isTerminal = attempts >= MAX_RETRIES;
        if (!isTerminal) {
          updateUploadButtonStatus(getHomeCopy().uploadRetrying);
          console.log("[UPLOAD] retry", attempts);
        } else {
          updateUploadButtonStatus(getHomeCopy().uploadFailed);
        }
        console.error("[UPLOAD] fail", error);
        await putJob({
          ...job,
          status: isTerminal ? "failed" : "pending",
          attempts,
          lastError: error?.message || "upload_failed",
          updatedAt: Date.now(),
          nextAttemptAt: Date.now() + buildRetryDelay(attempts)
        });
      }
    }
  } finally {
    const shouldClearStatus = !refs.uploadPhotoBtn?.dataset.uploadStatus || refs.uploadPhotoBtn.dataset.uploadStatus !== getHomeCopy().uploadFailed;
    if (shouldClearStatus) updateUploadButtonStatus("");
    isProcessing = false;
  }
}

export async function enqueuePhotoUpload({ file, guestId }) {
  const job = {
    id: uuid(),
    guestId,
    file,
    status: "pending",
    attempts: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    nextAttemptAt: Date.now(),
    source: "manual"
  };

  if (!supportsIndexedDb() || isIOS()) {
    const optimizedPhotos = await buildPhotoVariants(file);
    await withUploadTimeout(
      uploadPhoto({
        file: optimizedPhotos.largeFile,
        thumbnailFile: optimizedPhotos.thumbFile,
        width: optimizedPhotos.width,
        height: optimizedPhotos.height,
        guestId,
        uploadId: job.id,
        onProgress: ({ overallProgress = 0 }) => {
          updateUploadButtonStatus(getHomeCopy().uploadLoading, overallProgress);
        }
      }),
      UPLOAD_TIMEOUT_MS
    );
    updateUploadButtonStatus("");
    return;
  }

  await putJob(job);
  console.log("[UPLOAD] enqueued", job.id);
  void processUploadQueue();
}

export function startPhotoUploadQueue() {
  if (queueStarted) return;
  queueStarted = true;

  window.addEventListener("online", () => {
    processUploadQueue().catch(() => {});
  });

  window.setInterval(() => {
    processUploadQueue().catch(() => {});
  }, 4000);

  processUploadQueue().catch(() => {});
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
