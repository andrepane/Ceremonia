import {
  getAuthUid,
  isFirebaseConfigured,
  upsertGuestbookEntry,
  getGuestbookEntry,
  subscribeGuestbookEntries
} from "../../firebase.js";
import { refs, state, setState, findGuestById, getLocale } from "../state.js";

const AUTOSAVE_DEBOUNCE_MS = 500;
const COUPLE_GUEST_IDS = new Set(["cintia_novia", "andrea_novio"]);
const BOOK_BASE_WIDTH = 960;
const BOOK_BASE_HEIGHT = 640;

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

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatEntryDate(timestamp) {
  if (!timestamp) return "";
  const d = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(state.currentLanguage === "it" ? "it-IT" : "es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(d);
}

export class BookModal {
  constructor() {
    this.authorEl = refs.guestbookModal?.querySelector("[data-book-author]") || null;
    this.contentEl = refs.guestbookModal?.querySelector("[data-book-content]") || null;
    this.bookEl = refs.guestbookModal?.querySelector("[data-book-shell]") || null;
    this.viewportEl = refs.guestbookModal?.querySelector("[data-book-viewport]") || null;
    this.backdropEl = refs.guestbookModal?.querySelector("[data-book-backdrop]") || null;
    this.closeEl = refs.guestbookClose || null;
    this.entriesEl = refs.guestbookModal?.querySelector("[data-book-entries]") || null;
    this.authorLabelEl = refs.guestbookModal?.querySelector("[data-book-author-label]") || null;
    this.titleEl = refs.guestbookModal?.querySelector("[data-book-title]") || null;
    this.subtitleEl = refs.guestbookModal?.querySelector("[data-book-subtitle]") || null;
    this.debounceId = null;
    this.isBootstrapping = false;
    this.entries = [];
    this.selectedEntryId = null;
    this.unsubscribeEntries = () => {};

    if (!refs.guestbookModal || !this.authorEl || !this.contentEl) return;
    this.bindEvents();
  }

  isCoupleUser() {
    return COUPLE_GUEST_IDS.has(state.currentGuestId);
  }

  getBookCopy() {
    const labels = getLocale().labels || {};
    return {
      fromLabel: labels.guestbookFromLabel || "De:",
      placeholder: labels.guestbookPlaceholder || "Escribe aquí tu dedicatoria",
      title: labels.guestbookTitle || "Libro de dedicatorias",
      subtitleGuest: labels.guestbookSubtitleGuest || "Déjanos unas palabras para recordar este fin de semana.",
      subtitleCouple: labels.guestbookSubtitleCouple || "Todas las dedicatorias del fin de semana en un solo libro.",
      noEntries: labels.guestbookNoEntries || "Todavía no hay dedicatorias.",
      pageLabel: labels.guestbookPageLabel || "Página",
      untitledAuthor: labels.guestbookUntitledAuthor || "Invitado"
    };
  }

  bindEvents() {
    this.closeEl?.addEventListener("click", () => this.close());
    this.backdropEl?.addEventListener("click", () => this.close());

    refs.guestbookModal.addEventListener("click", (event) => {
      if (event.target === refs.guestbookModal) this.close();
    });

    this.entriesEl?.addEventListener("click", (event) => {
      const entryButton = event.target.closest("[data-entry-id]");
      if (!entryButton || !this.isCoupleUser()) return;
      this.selectedEntryId = entryButton.dataset.entryId;
      this.renderSelectedEntry();
      this.renderEntriesList();
    });

    const onEdit = () => {
      if (this.isBootstrapping || this.isCoupleUser()) return;
      this.scheduleAutosave();
      this.bookEl?.classList.add("book--writing");
      window.clearTimeout(this.writingFxTimeout);
      this.writingFxTimeout = window.setTimeout(() => {
        this.bookEl?.classList.remove("book--writing");
      }, 260);
    };

    this.contentEl.addEventListener("input", onEdit);
    window.addEventListener("resize", this.updateBookScale);
  }

  updateBookScale = () => {
    if (!this.bookEl || !this.viewportEl) return;
    const availableWidth = window.innerWidth - 24;
    const availableHeight = window.innerHeight - 72;
    const scaleByWidth = availableWidth / BOOK_BASE_WIDTH;
    const scaleByHeight = availableHeight / BOOK_BASE_HEIGHT;
    const scale = Math.max(0.45, Math.min(1, scaleByWidth, scaleByHeight));
    this.bookEl.style.transform = `scale(${scale})`;
  };

  applyLocalizedUi() {
    const copy = this.getBookCopy();
    if (this.authorLabelEl) this.authorLabelEl.textContent = copy.fromLabel;
    if (this.contentEl) this.contentEl.dataset.placeholder = copy.placeholder;
    if (this.titleEl) this.titleEl.textContent = copy.title;
    if (this.subtitleEl) {
      this.subtitleEl.textContent = this.isCoupleUser() ? copy.subtitleCouple : copy.subtitleGuest;
    }
  }

  async open() {
    if (!refs.guestbookModal) return;

    refs.guestbookModal.hidden = false;
    refs.guestbookModal.classList.remove("guestbook-modal--open");
    document.body.classList.add("body--menu-modal-open");
    this.applyLocalizedUi();
    this.updateBookScale();
    window.requestAnimationFrame(() => {
      refs.guestbookModal?.classList.add("guestbook-modal--open");
      this.updateBookScale();
    });

    await this.loadEntry();

    window.setTimeout(() => {
      if (!this.isCoupleUser()) {
        this.contentEl?.focus({ preventScroll: true });
        this.placeCaretAtEnd(this.contentEl);
      }
    }, 340);
  }

  close() {
    if (!refs.guestbookModal || refs.guestbookModal.hidden) return;
    refs.guestbookModal.classList.remove("guestbook-modal--open");
    refs.guestbookModal.hidden = true;
    document.body.classList.remove("body--menu-modal-open");
    this.unsubscribeEntries?.();
    this.unsubscribeEntries = () => {};
  }

  async loadEntry() {
    const fallbackAuthor = findGuestById(state.currentGuestId)?.name || "";
    const copy = this.getBookCopy();
    this.isBootstrapping = true;

    if (this.isCoupleUser()) {
      this.authorEl.textContent = "";
      this.contentEl.innerHTML = "";
      this.contentEl.setAttribute("contenteditable", "false");
      this.authorEl.setAttribute("contenteditable", "false");
      await this.loadEntriesForCouple();
      this.isBootstrapping = false;
      return;
    }

    let entry = null;
    if (isFirebaseConfigured() && state.currentGuestId) {
      try {
        entry = await getGuestbookEntry(state.currentGuestId);
      } catch {
        entry = null;
      }
    }

    const author = normalizeEditableText(entry?.authorName || entry?.author || fallbackAuthor);
    const content = normalizeEditableHtml(entry?.content || "");

    this.authorEl.textContent = author;
    this.contentEl.innerHTML = content;
    this.authorEl.setAttribute("contenteditable", "false");
    this.contentEl.setAttribute("contenteditable", "true");

    const payload = {
      id: state.currentGuestId,
      userId: entry?.userId || state.currentGuestId,
      authorName: author,
      content,
      timestamp: entry?.timestamp || Date.now()
    };

    const nextEntries = content ? [payload] : [];
    this.entries = nextEntries;
    this.selectedEntryId = state.currentGuestId;
    this.renderEntriesList();
    setState({ guestbookEntries: nextEntries });
    if (!content) this.contentEl.dataset.placeholder = copy.placeholder;
    this.isBootstrapping = false;
  }

  async loadEntriesForCouple() {
    const setEntries = (incomingEntries = []) => {
      const normalized = incomingEntries
        .map((entry) => ({
          id: entry.id || entry.userId,
          userId: entry.userId || entry.id || "",
          authorName: normalizeEditableText(entry.authorName || entry.author || ""),
          content: normalizeEditableHtml(entry.content || ""),
          timestamp: entry.timestamp || Date.now()
        }))
        .filter((entry) => entry.content)
        .sort((a, b) => Number(a.timestamp || 0) - Number(b.timestamp || 0));

      this.entries = normalized;
      this.selectedEntryId = normalized.find((entry) => entry.id === this.selectedEntryId)?.id
        || normalized[normalized.length - 1]?.id
        || null;
      setState({ guestbookEntries: normalized });
      this.renderEntriesList();
      this.renderSelectedEntry();
    };

    if (!isFirebaseConfigured()) {
      setEntries(state.guestbookEntries || []);
      return;
    }

    this.unsubscribeEntries?.();
    this.unsubscribeEntries = subscribeGuestbookEntries(
      (entries) => setEntries(entries),
      () => setEntries(state.guestbookEntries || [])
    );
  }

  renderSelectedEntry() {
    const copy = this.getBookCopy();
    const entry = this.entries.find((candidate) => candidate.id === this.selectedEntryId) || null;
    this.authorEl.textContent = entry?.authorName || copy.untitledAuthor;
    this.contentEl.innerHTML = entry?.content || "";
  }

  renderEntriesList() {
    if (!this.entriesEl) return;
    const copy = this.getBookCopy();

    if (!this.isCoupleUser()) {
      this.entriesEl.innerHTML = "";
      return;
    }

    if (!this.entries.length) {
      this.entriesEl.innerHTML = `<p class="book-modal__entries-empty">${escapeHtml(copy.noEntries)}</p>`;
      return;
    }

    this.entriesEl.innerHTML = this.entries.map((entry, index) => {
      const isActive = entry.id === this.selectedEntryId;
      const authorName = escapeHtml(entry.authorName || copy.untitledAuthor);
      const date = escapeHtml(formatEntryDate(entry.timestamp));
      return `<button class="book-entry-chip ${isActive ? "book-entry-chip--active" : ""}" type="button" data-entry-id="${escapeHtml(entry.id || `entry-${index}`)}"><span class="book-entry-chip__page">${escapeHtml(copy.pageLabel)} ${index + 1}</span><span class="book-entry-chip__author">${authorName}</span><span class="book-entry-chip__date">${date}</span></button>`;
    }).join("");
  }

  scheduleAutosave() {
    window.clearTimeout(this.debounceId);
    this.debounceId = window.setTimeout(() => {
      this.persistCurrentEntry();
    }, AUTOSAVE_DEBOUNCE_MS);
  }

  async persistCurrentEntry() {
    if (!state.currentGuestId || this.isCoupleUser()) return;

    const payload = {
      id: state.currentGuestId,
      userId: state.currentGuestId,
      authorName: normalizeEditableText(this.authorEl.textContent),
      content: normalizeEditableHtml(this.contentEl.innerHTML),
      timestamp: Date.now(),
      authUid: getAuthUid() || null
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
