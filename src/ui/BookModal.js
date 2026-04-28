import {
  getAuthUid,
  isFirebaseConfigured,
  upsertGuestbookEntry,
  getGuestbookEntry,
  subscribeGuestbookEntries
} from "../../firebase.js";
import { refs, state, setState, findGuestById } from "../state.js";

const AUTOSAVE_DEBOUNCE_MS = 500;
const COUPLE_GUEST_IDS = new Set(["cintia_novia", "andrea_novio"]);

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
    this.debounceId = null;
    this.isBootstrapping = false;
    this.liveFeedUnsub = null;
    this.entries = [];

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
      if (this.isReadOnlyViewer()) return;
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
    document.body.classList.add("body--menu-modal-open");
    window.requestAnimationFrame(() => {
      refs.guestbookModal?.classList.add("guestbook-modal--open");
    });

    this.applyEditingMode();
    await this.loadEntry();

    if (!this.isReadOnlyViewer()) {
      window.setTimeout(() => {
        this.contentEl?.focus({ preventScroll: true });
        this.placeCaretAtEnd(this.contentEl);
      }, 340);
    }
  }

  close() {
    if (!refs.guestbookModal || refs.guestbookModal.hidden) return;
    refs.guestbookModal.classList.remove("guestbook-modal--open");
    refs.guestbookModal.hidden = true;
    if (this.liveFeedUnsub) {
      this.liveFeedUnsub();
      this.liveFeedUnsub = null;
    }
    document.body.classList.remove("body--menu-modal-open");
  }

  isReadOnlyViewer() {
    return COUPLE_GUEST_IDS.has(state.currentGuestId);
  }

  applyEditingMode() {
    const readOnly = this.isReadOnlyViewer();
    this.authorEl.setAttribute("contenteditable", readOnly ? "false" : "true");
    this.contentEl.setAttribute("contenteditable", readOnly ? "false" : "true");
    this.authorEl.setAttribute("data-placeholder", readOnly ? "" : "Tu nombre");
    this.contentEl.setAttribute(
      "data-placeholder",
      readOnly ? "Aquí aparecerán las dedicatorias en tiempo real." : "Escribe aquí tu dedicatoria..."
    );
  }

  async loadEntry() {
    if (this.isReadOnlyViewer()) {
      this.authorEl.textContent = "Dedicatorias de los invitados";
      this.contentEl.innerHTML = "<p>Actualizando…</p>";
      this.startLiveGuestbookFeed();
      this.isBootstrapping = false;
      return;
    }

    const fallbackAuthor = findGuestById(state.currentGuestId)?.name || "";
    this.isBootstrapping = true;

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

  startLiveGuestbookFeed() {
    if (!isFirebaseConfigured()) {
      this.contentEl.innerHTML = "<p>No hay conexión con Firebase para mostrar dedicatorias.</p>";
      return;
    }

    if (this.liveFeedUnsub) this.liveFeedUnsub();
    this.liveFeedUnsub = subscribeGuestbookEntries(
      (entries) => {
        this.entries = entries;
        setState({ guestbookEntries: entries });
        this.renderReadOnlyFeed(entries);
      },
      () => {
        this.contentEl.innerHTML = "<p>No se pudieron cargar las dedicatorias.</p>";
      }
    );
  }

  renderReadOnlyFeed(entries) {
    if (!Array.isArray(entries) || entries.length === 0) {
      this.contentEl.innerHTML = "<p>Aún no hay dedicatorias.</p>";
      return;
    }

    this.contentEl.innerHTML = entries
      .map((entry) => {
        const author = normalizeEditableText(entry?.author || findGuestById(entry?.id)?.name || "Invitado");
        const content = normalizeEditableHtml(entry?.content || "");
        return `<p><strong>${author}:</strong></p><div>${content || "—"}</div><br/>`;
      })
      .join("");
  }

  scheduleAutosave() {
    window.clearTimeout(this.debounceId);
    this.debounceId = window.setTimeout(() => {
      this.persistCurrentEntry();
    }, AUTOSAVE_DEBOUNCE_MS);
  }

  async persistCurrentEntry() {
    if (this.isReadOnlyViewer()) return;
    if (!state.currentGuestId) return;

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
