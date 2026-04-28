import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  addDoc,
  deleteDoc,
  serverTimestamp,
  onSnapshot,
  query,
  orderBy,
  limit,
  increment,
  runTransaction,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";

const APP_DATA = window.WEDDING_APP_DATA || {};
const firebaseConfig = APP_DATA.firebaseConfig;
const eventId = APP_DATA.eventId || "main";

function isFirebaseConfigured() {
  return Boolean(
    firebaseConfig &&
      firebaseConfig.apiKey &&
      firebaseConfig.projectId &&
      firebaseConfig.appId
  );
}

let app = null;
let auth = null;
let db = null;
let storage = null;
let authUser = null;

if (isFirebaseConfigured()) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
}

async function ensureAuth() {
  if (!auth) return null;

  if (auth.currentUser) {
    authUser = auth.currentUser;
    return authUser;
  }

  await signInAnonymously(auth);

  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        authUser = user;
        unsub();
        resolve(user);
      }
    });
  });
}

function getAuthUid() {
  return auth?.currentUser?.uid || authUser?.uid || null;
}

function eventCollection(path) {
  return collection(db, "events", eventId, path);
}

function eventDoc(path, id) {
  return doc(db, "events", eventId, path, id);
}

async function linkGuestToAuth(guestId) {
  const user = await ensureAuth();
  if (!db || !user || !guestId) return;

  await setDoc(
    eventDoc("guests", guestId),
    {
      id: guestId,
      updatedAt: serverTimestamp(),
      updatedByUid: user.uid,
      lastAuthUid: user.uid
    },
    { merge: true }
  );
}

function subscribeActivity(onData, onError) {
  if (!db) return () => {};

  const q = query(eventCollection("activity"), orderBy("createdAt", "desc"), limit(30));
  return onSnapshot(
    q,
    (snapshot) => {
      onData(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    },
    onError
  );
}

function subscribePhotos(onData, onError) {
  if (!db) return () => {};

  const q = query(eventCollection("photos"), orderBy("createdAt", "desc"), limit(100));
  return onSnapshot(
    q,
    (snapshot) => {
      onData(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    },
    onError
  );
}

function subscribeGuestPresence(onData, onError) {
  if (!db) return () => {};

  const q = query(eventCollection("guests"));
  return onSnapshot(
    q,
    (snapshot) => {
      onData(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    },
    onError
  );
}

function subscribeGuestDictionary(guestId, onData, onError) {
  if (!db || !guestId) return () => {};

  return onSnapshot(
    eventDoc("guestDictionary", guestId),
    (snapshot) => onData(snapshot.exists() ? snapshot.data() : null),
    onError
  );
}

async function upsertGuestDictionary(guestId, payload = {}) {
  const user = await ensureAuth();
  if (!db || !user || !guestId) throw new Error("auth_required");

  await setDoc(
    eventDoc("guestDictionary", guestId),
    {
      guestId,
      history: Array.isArray(payload.history) ? payload.history : [],
      currentTranslation: payload.currentTranslation || null,
      updatedAt: serverTimestamp(),
      updatedByUid: user.uid
    },
    { merge: true }
  );
}

async function lockGuestProfile(guestId) {
  const user = await ensureAuth();
  if (!db || !user || !guestId) throw new Error("auth_required");

  const guestRef = eventDoc("guests", guestId);
  const result = await runTransaction(db, async (tx) => {
    const snap = await tx.get(guestRef);
    const data = snap.exists() ? snap.data() : {};
    const lockedByUid = data?.lockedByUid || null;

    if (lockedByUid && lockedByUid !== user.uid) return false;

    tx.set(
      guestRef,
      {
        id: guestId,
        locked: true,
        lockedByUid: user.uid,
        updatedAt: serverTimestamp(),
        updatedByUid: user.uid,
        lastAuthUid: user.uid
      },
      { merge: true }
    );
    return true;
  });

  if (!result) throw new Error("guest_locked");
}

async function switchGuestProfileLock(fromGuestId, toGuestId) {
  const user = await ensureAuth();
  if (!db || !user || !toGuestId) throw new Error("auth_required");

  if (!fromGuestId || fromGuestId === toGuestId) {
    await lockGuestProfile(toGuestId);
    return;
  }

  const fromRef = eventDoc("guests", fromGuestId);
  const toRef = eventDoc("guests", toGuestId);

  const result = await runTransaction(db, async (tx) => {
    const [fromSnap, toSnap] = await Promise.all([tx.get(fromRef), tx.get(toRef)]);
    const fromData = fromSnap.exists() ? fromSnap.data() : {};
    const toData = toSnap.exists() ? toSnap.data() : {};
    const toLockedByUid = toData?.lockedByUid || null;

    if (toLockedByUid && toLockedByUid !== user.uid) return false;

    if ((fromData?.lockedByUid || null) === user.uid) {
      tx.set(
        fromRef,
        {
          id: fromGuestId,
          locked: false,
          lockedByUid: null,
          updatedAt: serverTimestamp(),
          updatedByUid: user.uid,
          lastAuthUid: user.uid
        },
        { merge: true }
      );
    }

    tx.set(
      toRef,
      {
        id: toGuestId,
        locked: true,
        lockedByUid: user.uid,
        updatedAt: serverTimestamp(),
        updatedByUid: user.uid,
        lastAuthUid: user.uid
      },
      { merge: true }
    );

    return true;
  });

  if (!result) throw new Error("guest_locked");
}

async function releaseGuestProfileLock(guestId) {
  const user = await ensureAuth();
  if (!db || !user || !guestId) return;

  const guestRef = eventDoc("guests", guestId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(guestRef);
    if (!snap.exists()) return;
    const data = snap.data() || {};
    if (data.lockedByUid !== user.uid) return;

    tx.set(
      guestRef,
      {
        id: guestId,
        locked: false,
        lockedByUid: null,
        updatedAt: serverTimestamp(),
        updatedByUid: user.uid,
        lastAuthUid: user.uid
      },
      { merge: true }
    );
  });
}

async function emitActivity(type, guestId, metadata = {}) {
  const user = await ensureAuth();
  if (!db || !user) throw new Error("auth_required");

  await addDoc(eventCollection("activity"), {
    type,
    guestId,
    metadata,
    createdAt: serverTimestamp(),
    createdByUid: user.uid
  });
}

function uploadFileResumable(storageRef, file, onProgress) {
  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, file, {
      contentType: file.type || "image/jpeg"
    });

    task.on(
      "state_changed",
      (snapshot) => {
        if (typeof onProgress !== "function") return;
        const progress = snapshot.totalBytes > 0
          ? snapshot.bytesTransferred / snapshot.totalBytes
          : 0;
        onProgress(progress);
      },
      reject,
      () => resolve(task.snapshot)
    );
  });
}

async function uploadPhoto({ file, thumbnailFile, width, height, guestId, uploadId, onProgress }) {
  const user = await ensureAuth();
  if (!db || !storage || !user) throw new Error("auth_required");
  if (!guestId) throw new Error("guest_required");
  const safeUploadId = String(uploadId || `${Date.now()}_${user.uid}`).replace(/[^a-zA-Z0-9_-]/g, "_");
  const photoRef = eventDoc("photos", safeUploadId);
  const existingPhotoSnap = await getDoc(photoRef);
  const existingPhoto = existingPhotoSnap.exists() ? existingPhotoSnap.data() : null;

  if (existingPhoto?.uploadState === "ready" && existingPhoto.downloadURL && existingPhoto.thumbnailURL) {
    return safeUploadId;
  }

  const ext = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
  const safeExt = ext.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const baseName = `${safeUploadId}_${user.uid}`;
  const path = `events/${eventId}/photos/${baseName}.${safeExt}`;
  const thumbPath = `events/${eventId}/photos/${baseName}_thumb.jpg`;

  await setDoc(photoRef, {
    id: safeUploadId,
    uploadId: safeUploadId,
    authorGuestId: guestId,
    authorUid: user.uid,
    createdAt: existingPhoto?.createdAt || serverTimestamp(),
    likesCount: Number(existingPhoto?.likesCount) || 0,
    likedByGuestIds: Array.isArray(existingPhoto?.likedByGuestIds) ? existingPhoto.likedByGuestIds : [],
    reactionCounts: existingPhoto?.reactionCounts && typeof existingPhoto.reactionCounts === "object" ? existingPhoto.reactionCounts : {},
    reactionsByGuestIds: existingPhoto?.reactionsByGuestIds && typeof existingPhoto.reactionsByGuestIds === "object" ? existingPhoto.reactionsByGuestIds : {},
    uploadState: "uploading",
    uploadPhase: "thumbnail",
    uploadStartedAt: existingPhoto?.uploadStartedAt || serverTimestamp(),
    updatedAt: serverTimestamp(),
    storagePath: path,
    thumbnailPath: thumbnailFile ? thumbPath : null,
    width: Number(width) || null,
    height: Number(height) || null
  }, { merge: true });

  let thumbnailURL = existingPhoto?.thumbnailURL || existingPhoto?.downloadURL || null;
  if (thumbnailFile) {
    const thumbRef = ref(storage, thumbPath);
    await uploadFileResumable(thumbRef, thumbnailFile, (progress) => {
      if (typeof onProgress !== "function") return;
      onProgress({
        phase: "thumbnail",
        progress,
        overallProgress: progress * 0.4
      });
    });
    thumbnailURL = await getDownloadURL(thumbRef);
  }

  await setDoc(photoRef, {
    uploadPhase: "original",
    thumbnailURL: thumbnailURL || null,
    updatedAt: serverTimestamp()
  }, { merge: true });

  const storageRef = ref(storage, path);
  await uploadFileResumable(storageRef, file, (progress) => {
    if (typeof onProgress !== "function") return;
    onProgress({
      phase: "original",
      progress,
      overallProgress: 0.4 + (progress * 0.6)
    });
  });
  const downloadURL = await getDownloadURL(storageRef);

  await setDoc(photoRef, {
    id: safeUploadId,
    uploadId: safeUploadId,
    authorGuestId: guestId,
    authorUid: user.uid,
    likesCount: Number(existingPhoto?.likesCount) || 0,
    likedByGuestIds: Array.isArray(existingPhoto?.likedByGuestIds) ? existingPhoto.likedByGuestIds : [],
    reactionCounts: existingPhoto?.reactionCounts && typeof existingPhoto.reactionCounts === "object" ? existingPhoto.reactionCounts : {},
    reactionsByGuestIds: existingPhoto?.reactionsByGuestIds && typeof existingPhoto.reactionsByGuestIds === "object" ? existingPhoto.reactionsByGuestIds : {},
    createdAt: existingPhoto?.createdAt || serverTimestamp(),
    uploadCompletedAt: serverTimestamp(),
    uploadState: "ready",
    uploadPhase: "complete",
    storagePath: path,
    thumbnailPath: thumbnailFile ? thumbPath : null,
    downloadURL,
    thumbnailURL: thumbnailURL || downloadURL,
    width: Number(width) || null,
    height: Number(height) || null,
    updatedAt: serverTimestamp()
  }, { merge: true });

  if (!existingPhoto?.activityEmitted) {
    await emitActivity("upload_photo", guestId, { photoId: safeUploadId });
    await setDoc(photoRef, { activityEmitted: true, updatedAt: serverTimestamp() }, { merge: true });
  }

  return safeUploadId;
}

const PHOTO_REACTIONS = ["❤️", "😂", "😮", "🔥", "😍", "👏", "🤯", "🫶"];

async function setPhotoReaction(photoId, guestId, reaction) {
  const user = await ensureAuth();
  if (!db || !user) throw new Error("auth_required");
  if (!guestId) throw new Error("guest_required");
  if (!PHOTO_REACTIONS.includes(reaction)) throw new Error("reaction_invalid");

  const photoRef = eventDoc("photos", photoId);
  const likeRef = doc(db, "events", eventId, "photos", photoId, "likes", guestId);

  const changed = await runTransaction(db, async (tx) => {
    const [photoSnap, likeSnap] = await Promise.all([tx.get(photoRef), tx.get(likeRef)]);

    if (!photoSnap.exists()) return false;

    const photoData = photoSnap.data() || {};
    const currentLikedBy = Array.isArray(photoData.likedByGuestIds)
      ? photoData.likedByGuestIds
      : [];
    const currentReactionCounts = photoData.reactionCounts && typeof photoData.reactionCounts === "object"
      ? { ...photoData.reactionCounts }
      : {};
    const currentReactionsByGuest = photoData.reactionsByGuestIds && typeof photoData.reactionsByGuestIds === "object"
      ? { ...photoData.reactionsByGuestIds }
      : {};
    const fallbackPreviousReaction = currentLikedBy.includes(guestId) ? "❤️" : null;
    const previousReaction = currentReactionsByGuest[guestId] || fallbackPreviousReaction;

    if (previousReaction === reaction) {
      return false;
    }

    tx.set(likeRef, {
      uid: user.uid,
      guestId,
      reaction,
      createdAt: serverTimestamp()
    }, { merge: true });

    if (previousReaction && currentReactionCounts[previousReaction]) {
      currentReactionCounts[previousReaction] = Math.max(0, Number(currentReactionCounts[previousReaction]) - 1);
      if (!currentReactionCounts[previousReaction]) delete currentReactionCounts[previousReaction];
    }
    currentReactionCounts[reaction] = Number(currentReactionCounts[reaction] || 0) + 1;
    currentReactionsByGuest[guestId] = reaction;

    const nextLikedByGuestIds = currentLikedBy.includes(guestId)
      ? currentLikedBy
      : [...currentLikedBy, guestId];

    tx.update(photoRef, {
      likesCount: Number(photoData.likesCount || 0) + (previousReaction ? 0 : 1),
      likedByGuestIds: nextLikedByGuestIds,
      reactionCounts: currentReactionCounts,
      reactionsByGuestIds: currentReactionsByGuest
    });
    return true;
  });

  if (changed) {
    await emitActivity("react_photo", guestId, { photoId });
  }

  return changed;
}

async function deletePhoto(photoId) {
  const user = await ensureAuth();
  if (!db || !storage || !user) throw new Error("auth_required");

  const photoRef = eventDoc("photos", photoId);
  const photoSnap = await getDoc(photoRef);
  if (!photoSnap.exists()) throw new Error("photo_not_found");

  const photoData = photoSnap.data();
  if (photoData.authorUid !== user.uid) throw new Error("not_allowed");

  if (photoData.storagePath) {
    const storageRef = ref(storage, photoData.storagePath);
    try {
      await deleteObject(storageRef);
    } catch (error) {
      if (error?.code !== "storage/object-not-found") throw error;
    }
  }
  if (photoData.thumbnailPath) {
    const thumbStorageRef = ref(storage, photoData.thumbnailPath);
    try {
      await deleteObject(thumbStorageRef);
    } catch (error) {
      if (error?.code !== "storage/object-not-found") throw error;
    }
  }

  await deleteDoc(photoRef);
}

export {
  isFirebaseConfigured,
  ensureAuth,
  getAuthUid,
  linkGuestToAuth,
  subscribeGuestPresence,
  subscribeGuestDictionary,
  subscribeActivity,
  subscribePhotos,
  lockGuestProfile,
  switchGuestProfileLock,
  releaseGuestProfileLock,
  uploadPhoto,
  deletePhoto,
  setPhotoReaction,
  upsertGuestDictionary
};
