import {
  ensureAuth,
  getAuthUid,
  isFirebaseConfigured,
  lockGuestProfile,
  subscribeActivity,
  subscribeGuestPresence,
  subscribePhotos
} from "../../firebase.js";
import { refs, state, setState } from "../state.js";
import { renderGuestCards, renderHomeDashboard, renderPhotos, updateGuestHeaderMessage, updateProfileAvatar, updateWelcomeLabel } from "../ui/render.js";

let guestLockExpiryRefreshTimer = null;

function getTimestampMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.getTime();
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function scheduleLockExpiryRefresh(locks) {
  if (guestLockExpiryRefreshTimer) clearTimeout(guestLockExpiryRefreshTimer);
  const now = Date.now();
  const nextExpiry = Object.values(locks)
    .map((lock) => lock.lockExpiresAtMs || 0)
    .filter((expiresAtMs) => expiresAtMs > now)
    .sort((a, b) => a - b)[0];
  if (!nextExpiry) return;
  guestLockExpiryRefreshTimer = setTimeout(() => {
    renderGuestCards();
  }, Math.max(250, nextExpiry - now + 250));
}

export async function initFirebaseListeners(showScreenGuest, options = {}) {
  const { onGuestLockAcquired = () => {}, onGuestLockLost = () => {} } = options;
  if (!isFirebaseConfigured()) {
    setState({ firebaseOnline: false, homeActivityLoading: false, homePhotosLoading: false });
    renderHomeDashboard();
    renderPhotos();
    return;
  }

  state.unsubscribeActivity();
  state.unsubscribePhotos();
  state.unsubscribeGuestPresence();
  setState({ unsubscribeActivity: () => {}, unsubscribePhotos: () => {}, unsubscribeGuestPresence: () => {} });

  try {
    await ensureAuth();
    setState({ authUid: getAuthUid(), firebaseOnline: true, homeActivityLoading: true, homePhotosLoading: true });
    renderHomeDashboard();
    renderPhotos();

    setState({
      unsubscribeActivity: subscribeActivity((data) => {
        setState({ realtimeActivity: data, homeActivityLoading: false });
        renderHomeDashboard();
      }, () => {
        setState({ firebaseOnline: false, homeActivityLoading: false });
        renderHomeDashboard();
      })
    });

    setState({
      unsubscribeGuestPresence: subscribeGuestPresence((data) => {
        const locks = data.reduce((acc, guestDoc) => {
          acc[guestDoc.id] = {
            locked: Boolean(guestDoc.locked),
            lockedByUid: guestDoc.lockedByUid || null,
            lockExpiresAtMs: getTimestampMillis(guestDoc.lockExpiresAt),
            lastHeartbeatAtMs: getTimestampMillis(guestDoc.lastHeartbeatAt)
          };
          return acc;
        }, {});
        setState({ realtimeGuestLocks: locks });
        scheduleLockExpiryRefresh(locks);
        renderGuestCards();
      }, () => {
        setState({ firebaseOnline: false });
        renderGuestCards();
      })
    });

    setState({
      unsubscribePhotos: subscribePhotos((data) => {
        setState({ realtimePhotos: data, homePhotosLoading: false });
        renderPhotos();
      }, () => {
        setState({ firebaseOnline: false, homePhotosLoading: false });
        renderPhotos();
      })
    });

    if (state.currentGuestId) {
      try {
        await lockGuestProfile(state.currentGuestId);
        setState({ hasActiveGuestLock: true });
        onGuestLockAcquired(state.currentGuestId);
      } catch {
        setState({ hasActiveGuestLock: false, currentGuestId: null });
        onGuestLockLost();
        localStorage.removeItem("wedding_guest");
        updateWelcomeLabel();
        updateGuestHeaderMessage();
        updateProfileAvatar();
        showScreenGuest();
      }
    }
  } catch {
    setState({ firebaseOnline: false, homeActivityLoading: false, homePhotosLoading: false });
    renderHomeDashboard();
    renderPhotos();
  }
}
