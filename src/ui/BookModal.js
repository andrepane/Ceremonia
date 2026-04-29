import { getAuthUid, isFirebaseConfigured, upsertGuestbookEntry, getGuestbookEntry, subscribeCoupleGuestbook } from "../../firebase.js";
import { refs, state, setState, findGuestById } from "../state.js";

const AUTOSAVE_DEBOUNCE_MS = 500;

function isCoupleGuest(guestId) {
  return guestId === "cintia_novia" || guestId === "andrea_novio";
}

function renderCoupleGuestbookContent(entries = []) {
  if (!entries.length) return "";

  return entries
    .map((entry) => `<article class="book-modal__dedication"><p class="book-modal__dedication-from">De: ${entry.fromName || "Invitado"}</p><p class="book-modal__dedication-text">${entry.content || ""}</p></article>`)
    .join("");
}

function hasVisibleDedication(entry) {
  if (!entry) return false;
  const normalizedContent = normalizeEditableHtml(entry.content || "");
  return Boolean(normalizedContent && normalizedContent.replace(/<br\s*\/?>/gi, "").trim());
}


function normalizeEditableText(value = "") {
  return String(value)
    .replace(/\u00A0/g, " ")
    .replace(/\r/g, "")
    .trim();
}

function normalizeEditableHtml(value = "") {
  return String(value || "")
    .replace(/<(?!\/?(br|p|div)\b)[^>]*>/gi, "")
    .trim();
}

export class BookModal {
  constructor() {
    this.authorEl = refs.guestbookModal?.querySelector("[data-book-author]") || null;
    this.contentEl = refs.guestbookModal?.querySelector("[data-book-content]") || null;
    this.bookEl = refs.guestbookModal?.querySelector("[data-book-shell]") || null;
    this.backdropEl = refs.guestbookModal?.querySelector("[data-book-backdrop]") || null;
    this.closeEl = refs.guestbookClose || null;
    this.coverEl = refs.guestbookModal?.querySelector("[data-book-cover]") || null;
    this.fromLabelEl = refs.guestbookModal?.querySelector('[data-i18n="guestbookFromLabel"]') || null;
    this.debounceId = null;
    this.coverTimeoutId = null;
    this.isBootstrapping = false;
    this.entries = [];
    this.coupleGuestbookUnsub = null;

    if (!refs.guestbookModal || !this.authorEl || !this.contentEl) return;
    this.bindEvents();
  }

  bindEvents() {
    this.closeEl?.addEventListener("click", () => this.close());
    this.backdropEl?.addEventListener("click", () => this.close());

    refs.guestbookModal.addEventListener("click", (event) => {
      if (event.target === refs.guestbookModal) this.close();
    });

    this.authorEl.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        this.contentEl.focus();
      }
    });

    const onEdit = () => {
      if (this.isBootstrapping) return;
      this.scheduleAutosave();
      this.bookEl?.classList.add("book--writing");
      window.clearTimeout(this.writingFxTimeout);
      this.writingFxTimeout = window.setTimeout(() => {
        this.bookEl?.classList.remove("book--writing");
      }, 260);
    };

    this.authorEl.addEventListener("input", onEdit);
    this.contentEl.addEventListener("input", onEdit);
  }

  async open() {
    if (!refs.guestbookModal) return;

    refs.guestbookModal.hidden = false;
    refs.guestbookModal.classList.remove("guestbook-modal--open");
    this.showCover();
    document.body.classList.add("body--menu-modal-open");
    window.requestAnimationFrame(() => {
      refs.guestbookModal?.classList.add("guestbook-modal--open");
    });

    await this.loadEntry();

    window.setTimeout(() => {
      this.contentEl?.focus({ preventScroll: true });
      this.placeCaretAtEnd(this.contentEl);
    }, 340);
  }

  close() {
    if (!refs.guestbookModal || refs.guestbookModal.hidden) return;
    this.stopCoupleGuestbookSubscription();
    window.clearTimeout(this.coverTimeoutId);
    refs.guestbookModal.classList.remove("guestbook-modal--open");
    refs.guestbookModal.hidden = true;
    document.body.classList.remove("body--menu-modal-open");
  }



  showCover() {
    if (!this.coverEl) return;
    window.clearTimeout(this.coverTimeoutId);
    this.coverEl.classList.remove("book-modal__cover--hidden");
    this.coverTimeoutId = window.setTimeout(() => {
      this.coverEl?.classList.add("book-modal__cover--hidden");
    }, 3000);
  }


  stopCoupleGuestbookSubscription() {
    if (this.coupleGuestbookUnsub) {
      this.coupleGuestbookUnsub();
      this.coupleGuestbookUnsub = null;
    }
  }

  startCoupleGuestbookSubscription() {
    this.stopCoupleGuestbookSubscription();
    this.coupleGuestbookUnsub = subscribeCoupleGuestbook((entries) => {
      const normalizedEntries = (Array.isArray(entries) ? entries : []).filter(hasVisibleDedication);
      this.entries = normalizedEntries;
      setState({ guestbookEntries: normalizedEntries });
      this.authorEl.textContent = "";
      this.setReadOnlyMode(true);
      this.toggleCoupleHeader(false);
      this.contentEl.innerHTML = renderCoupleGuestbookContent(normalizedEntries);
    });
  }

  setReadOnlyMode(isReadOnly) {
    this.authorEl.setAttribute("contenteditable", isReadOnly ? "false" : "true");
    this.contentEl.setAttribute("contenteditable", isReadOnly ? "false" : "true");
    this.authorEl.classList.toggle("book-modal__author--readonly", isReadOnly);
    this.contentEl.classList.toggle("book-modal__content--readonly", isReadOnly);
  }

  toggleCoupleHeader(show) {
    if (this.fromLabelEl) this.fromLabelEl.hidden = !show;
    this.authorEl.hidden = !show;
  }

  async loadEntry() {
    const fallbackAuthor = findGuestById(state.currentGuestId)?.name || "";
    this.isBootstrapping = true;

    if (isCoupleGuest(state.currentGuestId)) {
      this.authorEl.textContent = "";
      this.setReadOnlyMode(true);
      this.toggleCoupleHeader(false);
      this.contentEl.innerHTML = "";
      this.startCoupleGuestbookSubscription();
      this.isBootstrapping = false;
      return;
    }

    this.stopCoupleGuestbookSubscription();
    this.setReadOnlyMode(false);
    this.toggleCoupleHeader(true);

    let entry = null;
    if (isFirebaseConfigured() && state.currentGuestId) {
      try {
        entry = await getGuestbookEntry(state.currentGuestId);
      } catch {
        entry = null;
      }
    }

    const author = normalizeEditableText(entry?.author || fallbackAuthor);
    const content = normalizeEditableHtml(entry?.content || "");

    this.authorEl.textContent = author;
    this.contentEl.innerHTML = content;

    const nextEntries = entry
      ? [{ id: state.currentGuestId, ...entry }]
      : [];

    this.entries = nextEntries;
    setState({ guestbookEntries: nextEntries });
    this.isBootstrapping = false;
  }

  scheduleAutosave() {
    window.clearTimeout(this.debounceId);
    this.debounceId = window.setTimeout(() => {
      this.persistCurrentEntry();
    }, AUTOSAVE_DEBOUNCE_MS);
  }

  async persistCurrentEntry() {
    if (!state.currentGuestId || isCoupleGuest(state.currentGuestId)) return;

    const payload = {
      id: state.currentGuestId,
      author: normalizeEditableText(this.authorEl.textContent),
      content: normalizeEditableHtml(this.contentEl.innerHTML),
      timestamp: Date.now(),
      userId: getAuthUid() || null
    };

    setState({ guestbookEntries: [payload] });
    this.entries = [payload];

    if (!isFirebaseConfigured()) return;

    try {
      await upsertGuestbookEntry(state.currentGuestId, payload);
    } catch {
      // Silencioso: mantenemos la experiencia de escritura sin interrupciones.
    }
  }

  placeCaretAtEnd(node) {
    if (!node) return;
    const range = document.createRange();
    const selection = window.getSelection();
    range.selectNodeContents(node);
    range.collapse(false);
    selection?.removeAllRanges();
    selection?.addRange(range);
  }
}

let bookModalInstance = null;

export function getBookModal() {
  if (!bookModalInstance) bookModalInstance = new BookModal();
  return bookModalInstance;
}
