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
  uploadBytes,
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

function subscribeRanking(onData, onError) {
  if (!db) return () => {};

  const q = query(eventCollection("ranking"), orderBy("points", "desc"), limit(50));
  return onSnapshot(
    q,
    (snapshot) => {
      onData(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    },
    onError
  );
}

function subscribeGuestChallenges(guestId, onData, onError) {
  if (!db || !guestId) return () => {};

  return onSnapshot(
    eventDoc("challenges", guestId),
    (snapshot) => onData(snapshot.exists() ? snapshot.data() : null),
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

async function uploadPhoto({ file, thumbnailFile, width, height, guestId }) {
  const user = await ensureAuth();
  if (!db || !storage || !user) throw new Error("auth_required");

  const ext = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
  const safeExt = ext.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const baseName = `${Date.now()}_${user.uid}`;
  const path = `events/${eventId}/photos/${baseName}.${safeExt}`;
  const thumbPath = `events/${eventId}/photos/${baseName}_thumb.jpg`;

  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file, { contentType: file.type || "image/jpeg" });
  const downloadURL = await getDownloadURL(storageRef);
  let thumbnailURL = downloadURL;
  if (thumbnailFile) {
    const thumbRef = ref(storage, thumbPath);
    await uploadBytes(thumbRef, thumbnailFile, { contentType: thumbnailFile.type || "image/jpeg" });
    thumbnailURL = await getDownloadURL(thumbRef);
  }

  const photoRef = await addDoc(eventCollection("photos"), {
    authorGuestId: guestId,
    authorUid: user.uid,
    likesCount: 0,
    createdAt: serverTimestamp(),
    storagePath: path,
    thumbnailPath: thumbnailFile ? thumbPath : null,
    downloadURL,
    thumbnailURL,
    width: Number(width) || null,
    height: Number(height) || null
  });

  await emitActivity("upload_photo", guestId, { photoId: photoRef.id });
  return photoRef.id;
}

async function togglePhotoLike(photoId, guestId) {
  const user = await ensureAuth();
  if (!db || !user) throw new Error("auth_required");
  if (!guestId) throw new Error("guest_required");

  const photoRef = eventDoc("photos", photoId);
  const likeRef = doc(db, "events", eventId, "photos", photoId, "likes", guestId);

  const changed = await runTransaction(db, async (tx) => {
    const [photoSnap, likeSnap] = await Promise.all([tx.get(photoRef), tx.get(likeRef)]);

    if (!photoSnap.exists()) return false;

    const photoData = photoSnap.data() || {};
    const currentLikedBy = Array.isArray(photoData.likedByGuestIds)
      ? photoData.likedByGuestIds
      : [];

    if (likeSnap.exists()) {
      tx.delete(likeRef);
      tx.update(photoRef, {
        likesCount: increment(-1),
        likedByGuestIds: currentLikedBy.filter((id) => id !== guestId)
      });
      return true;
    }

    tx.set(likeRef, {
      uid: user.uid,
      guestId,
      createdAt: serverTimestamp()
    });
    tx.update(photoRef, {
      likesCount: increment(1),
      likedByGuestIds: currentLikedBy.includes(guestId)
        ? currentLikedBy
        : [...currentLikedBy, guestId]
    });
    return true;
  });

  if (changed) {
    await emitActivity("react_photo", guestId, { photoId });
  }

  return changed;
}

async function setChallengeDone({
  guestId,
  challengeId,
  done,
  points,
  activeIds = [],
  completedIds = [],
  seenIds = [],
  maxActiveChallenges = 5
}) {
  const user = await ensureAuth();
  if (!db || !user) throw new Error("auth_required");

  const challengeRef = eventDoc("challenges", guestId);
  const rankingRef = eventDoc("ranking", guestId);

  const shouldEmit = await runTransaction(db, async (tx) => {
    const challengeSnap = await tx.get(challengeRef);
    const rankingSnap = await tx.get(rankingRef);
    const existing = challengeSnap.exists() ? challengeSnap.data() : { completed: {} };
    const prevDone = Boolean(existing.completed?.[challengeId]);

    if (prevDone === done) return false;

    const nextCompleted = { ...(existing.completed || {}), [challengeId]: done };
    const nextCompletedIds = Array.from(new Set(completedIds.filter((id) => Boolean(id))));
    const nextSeenIds = Array.from(new Set(seenIds.filter((id) => Boolean(id))));
    const normalizedActiveIds = Array.from(new Set(activeIds.filter((id) => Boolean(id)))).slice(0, maxActiveChallenges);
    tx.set(
      challengeRef,
      {
        guestId,
        completed: nextCompleted,
        completedIds: nextCompletedIds,
        seenIds: nextSeenIds,
        activeIds: normalizedActiveIds,
        updatedAt: serverTimestamp(),
        updatedByUid: user.uid
      },
      { merge: true }
    );

    const currentPoints = rankingSnap.exists() ? Number(rankingSnap.data().points || 0) : 0;
    const delta = done ? points : -points;
    const newPoints = Math.max(0, currentPoints + delta);

    tx.set(
      rankingRef,
      {
        guestId,
        points: newPoints,
        updatedAt: serverTimestamp(),
        updatedByUid: user.uid
      },
      { merge: true }
    );

    return done;
  });

  if (shouldEmit) {
    await emitActivity("complete_challenge", guestId, { challengeId });
  }
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
  subscribeActivity,
  subscribePhotos,
  subscribeRanking,
  subscribeGuestChallenges,
  lockGuestProfile,
  switchGuestProfileLock,
  releaseGuestProfileLock,
  uploadPhoto,
  deletePhoto,
  togglePhotoLike,
  setChallengeDone
};
