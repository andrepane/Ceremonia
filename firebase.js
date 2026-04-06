import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  updateDoc,
  addDoc,
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
  getDownloadURL
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

async function uploadPhoto({ file, guestId, caption }) {
  const user = await ensureAuth();
  if (!db || !storage || !user) throw new Error("auth_required");

  const ext = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
  const safeExt = ext.toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `events/${eventId}/photos/${Date.now()}_${user.uid}.${safeExt || "jpg"}`;

  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file, { contentType: file.type || "image/jpeg" });
  const downloadURL = await getDownloadURL(storageRef);

  const photoRef = await addDoc(eventCollection("photos"), {
    authorGuestId: guestId,
    authorUid: user.uid,
    caption: caption || "",
    likesCount: 0,
    createdAt: serverTimestamp(),
    storagePath: path,
    downloadURL
  });

  await emitActivity("upload_photo", guestId, { photoId: photoRef.id });
  return photoRef.id;
}

async function togglePhotoLike(photoId, guestId) {
  const user = await ensureAuth();
  if (!db || !user) throw new Error("auth_required");

  const photoRef = eventDoc("photos", photoId);
  const likeRef = doc(db, "events", eventId, "photos", photoId, "likes", user.uid);

  const changed = await runTransaction(db, async (tx) => {
    const [photoSnap, likeSnap] = await Promise.all([tx.get(photoRef), tx.get(likeRef)]);

    if (!photoSnap.exists()) return false;
    if (likeSnap.exists()) return false;

    tx.set(likeRef, {
      uid: user.uid,
      guestId,
      createdAt: serverTimestamp()
    });
    tx.update(photoRef, { likesCount: increment(1) });
    return true;
  });

  if (changed) {
    await emitActivity("react_photo", guestId, { photoId });
  }

  return changed;
}

async function setChallengeDone({ guestId, challengeId, done, points }) {
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
    tx.set(
      challengeRef,
      {
        guestId,
        completed: nextCompleted,
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

export {
  isFirebaseConfigured,
  ensureAuth,
  linkGuestToAuth,
  subscribeActivity,
  subscribePhotos,
  subscribeRanking,
  subscribeGuestChallenges,
  uploadPhoto,
  togglePhotoLike,
  setChallengeDone
};
