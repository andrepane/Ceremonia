import { state } from "../state.js";

let toastRegion;
let dialogOverlay;
let activeDialog = null;

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])"
].join(", ");

function getUiLocaleCopy() {
  if (state.currentLanguage === "it") {
    return {
      close: "Chiudi",
      confirm: "Conferma",
      cancel: "Annulla",
      accept: "OK"
    };
  }

  return {
    close: "Cerrar",
    confirm: "Confirmar",
    cancel: "Cancelar",
    accept: "Aceptar"
  };
}

function ensureToastRegion() {
  if (toastRegion) return toastRegion;
  toastRegion = document.createElement("div");
  toastRegion.className = "toast-region";
  toastRegion.setAttribute("aria-live", "polite");
  toastRegion.setAttribute("aria-atomic", "false");
  document.body.append(toastRegion);
  return toastRegion;
}

function ensureDialogOverlay() {
  if (dialogOverlay) return dialogOverlay;
  dialogOverlay = document.createElement("div");
  dialogOverlay.className = "dialog-overlay";
  dialogOverlay.hidden = true;
  document.body.append(dialogOverlay);
  return dialogOverlay;
}

function closeActiveDialog(result) {
  if (!activeDialog) return;
  const { overlay, onResolve, opener } = activeDialog;
  overlay.hidden = true;
  overlay.innerHTML = "";
  document.body.classList.remove("body--dialog-open");
  document.removeEventListener("keydown", activeDialog.onDocumentKeydown);
  activeDialog = null;
  if (opener && typeof opener.focus === "function") opener.focus();
  onResolve(result);
}

function buildDialog({ title, message, renderBody, actions, onEscape }) {
  const overlay = ensureDialogOverlay();
  overlay.innerHTML = "";
  overlay.hidden = false;
  document.body.classList.add("body--dialog-open");

  const dialog = document.createElement("section");
  dialog.className = "dialog";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");

  const heading = document.createElement("h3");
  const headingId = `dialog-title-${Date.now()}`;
  const messageId = `dialog-message-${Date.now()}`;
  heading.className = "dialog__title";
  heading.id = headingId;
  heading.textContent = title;

  const messageBlock = document.createElement("p");
  messageBlock.className = "dialog__message";
  messageBlock.id = messageId;
  messageBlock.textContent = message;
  dialog.setAttribute("aria-labelledby", headingId);
  dialog.setAttribute("aria-describedby", messageId);

  const body = document.createElement("div");
  body.className = "dialog__body";
  if (typeof renderBody === "function") renderBody(body);

  const footer = document.createElement("div");
  footer.className = "dialog__actions";
  actions.forEach((action) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = action.variant === "primary" ? "primary-btn" : "secondary-btn";
    button.textContent = action.text;
    button.addEventListener("click", () => {
      const result = typeof action.getValue === "function" ? action.getValue() : action.value;
      closeActiveDialog(result);
    });
    footer.append(button);
    if (action.autofocus) window.requestAnimationFrame(() => button.focus());
  });

  dialog.append(heading, messageBlock, body, footer);
  overlay.append(dialog);

  const getFocusableElements = () => [...dialog.querySelectorAll(FOCUSABLE_SELECTOR)];
  const trapFocus = (event) => {
    if (event.key !== "Tab") return;
    const focusable = getFocusableElements();
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
      return;
    }
    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const onDocumentKeydown = (event) => {
    trapFocus(event);
    if (event.key !== "Escape") return;
    event.preventDefault();
    if (typeof onEscape === "function") onEscape();
  };

  document.addEventListener("keydown", onDocumentKeydown);

  return {
    overlay,
    onDocumentKeydown,
    focusFirst() {
      const focusable = getFocusableElements();
      if (focusable.length) focusable[0].focus();
      else dialog.focus();
    }
  };
}

export function showToast({ type = "info", message }) {
  if (!message) return;
  const region = ensureToastRegion();
  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;
  toast.setAttribute("role", type === "error" ? "alert" : "status");
  toast.textContent = message;
  region.append(toast);

  window.requestAnimationFrame(() => toast.classList.add("toast--visible"));
  window.setTimeout(() => {
    toast.classList.remove("toast--visible");
    window.setTimeout(() => toast.remove(), 220);
  }, 3000);
}

export function showConfirmDialog({
  title,
  message,
  confirmText,
  cancelText
}) {
  if (activeDialog) return Promise.resolve(false);
  const copy = getUiLocaleCopy();
  const opener = document.activeElement;

  return new Promise((resolve) => {
    const dialogParts = buildDialog({
      title,
      message,
      actions: [
        { text: cancelText || copy.cancel, value: false, variant: "secondary", autofocus: true },
        { text: confirmText || copy.confirm, value: true, variant: "primary" }
      ],
      onEscape: () => closeActiveDialog(false)
    });

    activeDialog = {
      opener,
      overlay: dialogParts.overlay,
      onResolve: resolve,
      onDocumentKeydown: dialogParts.onDocumentKeydown
    };

    dialogParts.focusFirst();
  });
}

export function showPromptDialog({
  title,
  message,
  placeholder = "",
  defaultValue = ""
}) {
  if (activeDialog) return Promise.resolve(null);
  const copy = getUiLocaleCopy();
  const opener = document.activeElement;
  let value = defaultValue;

  return new Promise((resolve) => {
    const dialogParts = buildDialog({
      title,
      message,
      renderBody: (container) => {
        const input = document.createElement("input");
        input.className = "dialog__input";
        input.type = "text";
        input.placeholder = placeholder;
        input.value = defaultValue;
        input.addEventListener("input", () => {
          value = input.value;
        });
        input.addEventListener("keydown", (event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          closeActiveDialog(value);
        });
        container.append(input);
        window.requestAnimationFrame(() => input.focus());
      },
      actions: [
        { text: copy.cancel, value: null, variant: "secondary" },
        { text: copy.accept, getValue: () => value, variant: "primary", autofocus: false }
      ],
      onEscape: () => closeActiveDialog(null)
    });

    activeDialog = {
      opener,
      overlay: dialogParts.overlay,
      onResolve: resolve,
      onDocumentKeydown: dialogParts.onDocumentKeydown
    };

    dialogParts.focusFirst();
  });
}
