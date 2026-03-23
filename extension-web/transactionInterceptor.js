const CLICKSHIELD_PROVIDER_SOURCE = "clickshield-layer3-provider-guard";
const CLICKSHIELD_MODAL_REQUEST = "L3_PRESENT_RPC_MODAL";
const USER_REJECTED_ERROR = Object.freeze({
  code: 4001,
  message: "User rejected the request.",
});

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function joinList(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return "<li>No additional details available.</li>";
  }

  return items
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");
}

function createTransactionModalPresenter(options = {}) {
  const documentRef = options.document ?? document;
  const queue = [];
  let active = false;

  function pumpQueue() {
    if (active || queue.length === 0) {
      return;
    }

    active = true;
    const next = queue.shift();
    renderModal(next.decision)
      .then(next.resolve)
      .finally(() => {
        active = false;
        pumpQueue();
      });
  }

  function renderModal(decision) {
    const modal = decision.modal;

    return new Promise((resolve) => {
      let confirmationAccepted = false;
      let typedAcknowledgement = "";

      const root = documentRef.createElement("div");
      root.id = `clickshield-layer3-modal-${decision.requestId}`;

      function close(result) {
        root.remove();
        resolve(result);
      }

      function render() {
        const confirmation = modal.confirmation;
        const showConfirmStep = confirmationAccepted === true || typedAcknowledgement !== "";
        const confirmDisabled =
          confirmation.kind === "typed_acknowledgement"
            ? typedAcknowledgement !== confirmation.expectedText
            : confirmationAccepted !== true;

        root.innerHTML = `
          <style>
            #${root.id} {
              position: fixed;
              inset: 0;
              z-index: 2147483647;
              background: rgba(17, 24, 39, 0.7);
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 20px;
              font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            }
            #${root.id} .cs-l3-card {
              width: min(720px, 100%);
              background: #fffaf2;
              color: #1f2937;
              border: 1px solid rgba(146, 64, 14, 0.24);
              border-radius: 20px;
              box-shadow: 0 32px 60px rgba(15, 23, 42, 0.28);
              overflow: hidden;
            }
            #${root.id} .cs-l3-header {
              padding: 20px 24px 16px;
              background: ${modal.verdictLabel === "Blocked" ? "#7f1d1d" : "#9a3412"};
              color: white;
            }
            #${root.id} .cs-l3-title {
              margin: 0 0 6px;
              font-size: 24px;
              font-weight: 700;
            }
            #${root.id} .cs-l3-summary {
              margin: 0;
              font-size: 15px;
              line-height: 1.5;
            }
            #${root.id} .cs-l3-body {
              padding: 20px 24px;
              display: grid;
              gap: 18px;
            }
            #${root.id} .cs-l3-meta {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
              gap: 12px;
            }
            #${root.id} .cs-l3-meta-card,
            #${root.id} .cs-l3-section,
            #${root.id} .cs-l3-confirmation {
              background: white;
              border: 1px solid rgba(148, 163, 184, 0.25);
              border-radius: 14px;
              padding: 14px 16px;
            }
            #${root.id} .cs-l3-label {
              margin: 0 0 4px;
              font-size: 11px;
              font-weight: 700;
              letter-spacing: 0.08em;
              text-transform: uppercase;
              color: #9a3412;
            }
            #${root.id} .cs-l3-value {
              margin: 0;
              font-size: 14px;
              line-height: 1.45;
              word-break: break-word;
            }
            #${root.id} .cs-l3-badges {
              display: flex;
              flex-wrap: wrap;
              gap: 8px;
            }
            #${root.id} .cs-l3-badge {
              border-radius: 999px;
              padding: 6px 10px;
              background: rgba(154, 52, 18, 0.12);
              color: #9a3412;
              font-size: 12px;
              font-weight: 700;
            }
            #${root.id} .cs-l3-list {
              margin: 10px 0 0;
              padding-left: 18px;
              font-size: 14px;
              line-height: 1.5;
            }
            #${root.id} .cs-l3-confirmation textarea,
            #${root.id} .cs-l3-confirmation input[type="text"] {
              width: 100%;
              border: 1px solid rgba(148, 163, 184, 0.45);
              border-radius: 12px;
              padding: 10px 12px;
              font-size: 14px;
              box-sizing: border-box;
            }
            #${root.id} .cs-l3-confirmation code {
              display: block;
              margin-top: 8px;
              padding: 10px 12px;
              border-radius: 12px;
              background: #111827;
              color: #f9fafb;
              font-size: 12px;
              word-break: break-word;
            }
            #${root.id} .cs-l3-actions {
              display: flex;
              justify-content: flex-end;
              gap: 10px;
              padding: 0 24px 24px;
            }
            #${root.id} button {
              border: none;
              border-radius: 999px;
              padding: 11px 18px;
              font-size: 14px;
              font-weight: 700;
              cursor: pointer;
            }
            #${root.id} .cs-l3-cancel {
              background: #e5e7eb;
              color: #111827;
            }
            #${root.id} .cs-l3-override {
              background: ${modal.verdictLabel === "Blocked" ? "#7f1d1d" : "#9a3412"};
              color: white;
            }
            #${root.id} .cs-l3-override[disabled] {
              cursor: not-allowed;
              opacity: 0.45;
            }
            #${root.id} .cs-l3-checkbox {
              display: flex;
              gap: 10px;
              align-items: flex-start;
              font-size: 14px;
              line-height: 1.5;
            }
          </style>
          <div class="cs-l3-card" role="dialog" aria-modal="true" aria-labelledby="${root.id}-title">
            <div class="cs-l3-header">
              <p class="cs-l3-label">${escapeHtml(modal.verdictLabel)}</p>
              <h1 id="${root.id}-title" class="cs-l3-title">${escapeHtml(modal.headline)}</h1>
              <p class="cs-l3-summary">${escapeHtml(modal.summary)}</p>
            </div>
            <div class="cs-l3-body">
              <div class="cs-l3-badges">
                ${modal.reasonBadges
                  .map((badge) => `<span class="cs-l3-badge">${escapeHtml(badge.label)}</span>`)
                  .join("")}
              </div>
              <div class="cs-l3-meta">
                <div class="cs-l3-meta-card">
                  <p class="cs-l3-label">Origin</p>
                  <p class="cs-l3-value">${escapeHtml(modal.originDomain)}</p>
                </div>
                <div class="cs-l3-meta-card">
                  <p class="cs-l3-label">Chain</p>
                  <p class="cs-l3-value">${escapeHtml(modal.chainLabel)}</p>
                </div>
                <div class="cs-l3-meta-card">
                  <p class="cs-l3-label">Wallet Account</p>
                  <p class="cs-l3-value">${escapeHtml(modal.walletAccount)}</p>
                </div>
                <div class="cs-l3-meta-card">
                  <p class="cs-l3-label">${escapeHtml(modal.primaryAddressLabel)}</p>
                  <p class="cs-l3-value">${escapeHtml(modal.primaryAddress ?? "Unavailable")}</p>
                </div>
                <div class="cs-l3-meta-card">
                  <p class="cs-l3-label">${escapeHtml(modal.selectorLabel)}</p>
                  <p class="cs-l3-value">${escapeHtml(modal.selectorValue ?? "Unavailable")}</p>
                </div>
                <div class="cs-l3-meta-card">
                  <p class="cs-l3-label">Scope</p>
                  <p class="cs-l3-value">${escapeHtml(modal.approvalScope)}</p>
                </div>
              </div>
              <div class="cs-l3-section">
                <p class="cs-l3-label">Top Risk Details</p>
                <ul class="cs-l3-list">${joinList(modal.details)}</ul>
              </div>
              ${
                Array.isArray(modal.unknowns) && modal.unknowns.length > 0
                  ? `
                <div class="cs-l3-section">
                  <p class="cs-l3-label">Unknowns</p>
                  <ul class="cs-l3-list">${joinList(modal.unknowns)}</ul>
                </div>`
                  : ""
              }
              <div class="cs-l3-confirmation">
                <p class="cs-l3-label">${escapeHtml(modal.confirmation.title)}</p>
                <p class="cs-l3-value">${escapeHtml(modal.confirmation.prompt)}</p>
                <p class="cs-l3-value" style="margin-top: 10px;">${escapeHtml(modal.confirmation.consequence)}</p>
                ${
                  modal.confirmation.kind === "typed_acknowledgement"
                    ? `
                  <code>${escapeHtml(modal.confirmation.expectedText)}</code>
                  <input id="${root.id}-typed-input" type="text" value="${escapeHtml(typedAcknowledgement)}" placeholder="Type the acknowledgement exactly" />`
                    : `
                  <label class="cs-l3-checkbox">
                    <input id="${root.id}-confirm-checkbox" type="checkbox" ${
                      confirmationAccepted ? "checked" : ""
                    } />
                    <span>I understand the risk and want to continue.</span>
                  </label>`
                }
              </div>
            </div>
            <div class="cs-l3-actions">
              <button id="${root.id}-cancel" class="cs-l3-cancel">Cancel</button>
              <button id="${root.id}-override" class="cs-l3-override" ${
                confirmDisabled ? "disabled" : ""
              }>${escapeHtml(modal.confirmation.confirmLabel)}</button>
            </div>
          </div>`;

        const cancelButton = documentRef.getElementById(`${root.id}-cancel`);
        const overrideButton = documentRef.getElementById(`${root.id}-override`);
        const checkbox = documentRef.getElementById(`${root.id}-confirm-checkbox`);
        const typedInput = documentRef.getElementById(`${root.id}-typed-input`);

        cancelButton?.addEventListener("click", () => {
          close({ action: "cancel" });
        });

        overrideButton?.addEventListener("click", () => {
          if (confirmDisabled) {
            return;
          }
          close({ action: "override" });
        });

        checkbox?.addEventListener("change", () => {
          confirmationAccepted = checkbox.checked === true;
          render();
        });

        typedInput?.addEventListener("input", () => {
          typedAcknowledgement = typedInput.value;
          render();
        });
      }

      render();
      documentRef.documentElement.appendChild(root);
    });
  }

  return function presentModal(decision) {
    return new Promise((resolve) => {
      queue.push({ decision, resolve });
      pumpQueue();
    });
  };
}

function createRuntimeMessenger() {
  return function sendMessage(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(response);
      });
    });
  };
}

function createTransactionInterceptorController(options = {}) {
  const presentModal =
    options.presentModal ?? createTransactionModalPresenter({ document: options.document });

  async function resolveDecision(decision) {
    if (!decision || !decision.verdict || typeof decision.requestId !== "string") {
      return {
        action: "reject",
        error: {
          code: -32603,
          message: "ClickShield did not receive a valid Layer 3 decision.",
        },
      };
    }

    if (decision.verdict.status === "ALLOW") {
      return {
        action: "forward",
        audit: decision.audit,
      };
    }

    try {
      const modalResult = await presentModal(decision);
      if (modalResult.action === "override") {
        return {
          action: "forward",
          audit: {
            ...decision.audit,
            finalUserAction: "overridden",
          },
        };
      }

      return {
        action: "reject",
        error: {
          ...USER_REJECTED_ERROR,
        },
        audit: {
          ...decision.audit,
          finalUserAction: "cancelled",
        },
      };
    } catch {
      return {
        action: "reject",
        error: {
          code: -32603,
          message: "ClickShield could not present the transaction security modal.",
        },
      };
    }
  }

  async function handleModalRequest(message) {
    if (message?.type !== CLICKSHIELD_MODAL_REQUEST) {
      return false;
    }

    return {
      ok: true,
      resolution: await resolveDecision(message.decision),
    };
  }

  return {
    handleModalRequest,
    resolveDecision,
  };
}

function initializeTransactionInterceptor() {
  if (!window.location.href.startsWith("http://") && !window.location.href.startsWith("https://")) {
    return;
  }

  const controller = createTransactionInterceptorController();

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type !== CLICKSHIELD_MODAL_REQUEST) {
      return false;
    }

    void controller.handleModalRequest(message).then(sendResponse, (error) => {
      sendResponse({
        ok: true,
        resolution: {
          action: "reject",
          error: {
            code: -32603,
            message: error?.message || "ClickShield could not present the transaction security modal.",
          },
        },
      });
    });

    return true;
  });
}

if (globalThis.__CLICKSHIELD_ENABLE_TEST_HOOKS__ === true) {
  globalThis.__CLICKSHIELD_LAYER3_INTERCEPTOR_TEST_HOOKS__ = {
    CLICKSHIELD_PROVIDER_SOURCE,
    CLICKSHIELD_MODAL_REQUEST,
    USER_REJECTED_ERROR,
    createTransactionInterceptorController,
    createRuntimeMessenger,
  };
}

if (
  typeof window !== "undefined" &&
  typeof document !== "undefined" &&
  typeof chrome !== "undefined" &&
  chrome?.runtime &&
  globalThis.__CLICKSHIELD_DISABLE_AUTO_INIT__ !== true
) {
  initializeTransactionInterceptor();
}
