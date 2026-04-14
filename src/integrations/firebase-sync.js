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

export async function initFirebaseListeners(showScreenGuest) {
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
          acc[guestDoc.id] = { locked: Boolean(guestDoc.locked), lockedByUid: guestDoc.lockedByUid || null };
          return acc;
        }, {});
        setState({ realtimeGuestLocks: locks });
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
      } catch {
        setState({ hasActiveGuestLock: false, currentGuestId: null });
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
