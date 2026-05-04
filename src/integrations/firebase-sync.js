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
import { stopGuestDictionarySync } from "../features/dictionary-store.js";

export async function initFirebaseListeners(showScreenGuest) {
  const activityCacheKey = window.OFFLINE_CACHE_KEYS?.activity;
  const photosCacheKey = window.OFFLINE_CACHE_KEYS?.photos;
  const cachedActivity = activityCacheKey ? window.readOfflineSnapshot?.(activityCacheKey) : null;
  const cachedPhotos = photosCacheKey ? window.readOfflineSnapshot?.(photosCacheKey) : null;
  if (Array.isArray(cachedActivity)) setState({ realtimeActivity: cachedActivity, homeActivityLoading: false });
  if (Array.isArray(cachedPhotos)) setState({ realtimePhotos: cachedPhotos, homePhotosLoading: false });

  if (!isFirebaseConfigured()) {
    setState({ firebaseOnline: false, homeActivityLoading: false, homePhotosLoading: false });
    renderHomeDashboard();
    renderPhotos();
    return;
  }

  state.unsubscribeActivity();
  state.unsubscribePhotos();
  state.unsubscribeGuestPresence();
  state.unsubscribeDictionary();
  setState({ unsubscribeActivity: () => {}, unsubscribePhotos: () => {}, unsubscribeGuestPresence: () => {}, unsubscribeDictionary: () => {} });

  try {
    await ensureAuth();
    setState({ authUid: getAuthUid(), firebaseOnline: true, homeActivityLoading: true, homePhotosLoading: true });
    renderHomeDashboard();
    renderPhotos();

    setState({
      unsubscribeActivity: subscribeActivity((data) => {
        setState({ realtimeActivity: data, homeActivityLoading: false });
        if (activityCacheKey) window.saveOfflineSnapshot?.(activityCacheKey, data);
        renderHomeDashboard();
      }, () => {
        setState({ firebaseOnline: false, homeActivityLoading: false });
        window.setOfflineUiState?.();
        renderHomeDashboard();
      })
    });

    setState({
      unsubscribeGuestPresence: subscribeGuestPresence((data) => {
        const locks = data.reduce((acc, guestDoc) => {
          acc[guestDoc.id] = { locked: Boolean(guestDoc.locked), lockedByUid: guestDoc.lockedByUid || null };
          return acc;
        }, {});
        setState({ realtimeGuestLocks: locks });
        renderGuestCards();
      }, () => {
        setState({ firebaseOnline: false });
        window.setOfflineUiState?.();
        renderGuestCards();
      })
    });

    setState({
      unsubscribePhotos: subscribePhotos((data) => {
        setState({ realtimePhotos: data, homePhotosLoading: false });
        if (photosCacheKey) window.saveOfflineSnapshot?.(photosCacheKey, data);
        renderPhotos();
      }, () => {
        setState({ firebaseOnline: false, homePhotosLoading: false });
        window.setOfflineUiState?.();
        renderPhotos();
      })
    });

    if (state.currentGuestId) {
      try {
        await lockGuestProfile(state.currentGuestId);
        setState({ hasActiveGuestLock: true });
      } catch {
        setState({ hasActiveGuestLock: false, currentGuestId: null });
        localStorage.removeItem("wedding_guest");
        stopGuestDictionarySync();
        updateWelcomeLabel();
        updateGuestHeaderMessage();
        updateProfileAvatar();
        showScreenGuest();
      }
    }
  } catch {
    setState({ firebaseOnline: false, homeActivityLoading: false, homePhotosLoading: false });
    window.setOfflineUiState?.();
    renderHomeDashboard();
    renderPhotos();
  }
}
