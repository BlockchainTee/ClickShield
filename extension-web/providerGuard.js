const CLICKSHIELD_PROVIDER_SOURCE = "clickshield-layer3-provider-guard";
const CLICKSHIELD_EXTENSION_SOURCE = "clickshield-layer3-extension";
const CLICKSHIELD_RELEASE_MESSAGE_TYPE = "L3_RPC_RELEASE";
const LAYER3_RPC_METHODS = new Set([
  "eth_sendTransaction",
  "eth_signTypedData",
  "eth_signTypedData_v4",
]);
const USER_REJECTED_ERROR_CODE = 4001;
const INTERNAL_ERROR_CODE = -32603;

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isLayer3RpcMethod(method) {
  return typeof method === "string" && LAYER3_RPC_METHODS.has(method);
}

function sanitizeJsonValue(value) {
  if (typeof value === "bigint") {
    return value.toString(10);
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeJsonValue(entry));
  }

  if (isRecord(value)) {
    const output = {};
    for (const [key, entry] of Object.entries(value)) {
      if (typeof entry === "undefined") {
        continue;
      }
      output[key] = sanitizeJsonValue(entry);
    }
    return output;
  }

  return value;
}

function cloneValue(value) {
  if (typeof value === "bigint") {
    return BigInt(value.toString(10));
  }

  if (Array.isArray(value)) {
    return value.map((entry) => cloneValue(entry));
  }

  if (isRecord(value)) {
    const output = {};
    for (const [key, entry] of Object.entries(value)) {
      if (typeof entry === "undefined") {
        continue;
      }
      output[key] = cloneValue(entry);
    }
    return output;
  }

  return value;
}

function deepFreezeValue(value) {
  if (Array.isArray(value)) {
    for (const entry of value) {
      deepFreezeValue(entry);
    }
    return Object.freeze(value);
  }

  if (isRecord(value)) {
    for (const entry of Object.values(value)) {
      deepFreezeValue(entry);
    }
    return Object.freeze(value);
  }

  return value;
}

function readNullableString(value) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function detectWalletProvider(provider) {
  if (!provider || typeof provider !== "object") {
    return {
      walletProvider: "unknown_injected",
      walletMetadata: {
        providerType: "injected",
        walletName: "Unknown Wallet",
        walletVersion: null,
        platform: "web",
      },
    };
  }

  if (provider.isRabby === true) {
    return {
      walletProvider: "rabby",
      walletMetadata: {
        providerType: "injected",
        walletName: "Rabby",
        walletVersion: readNullableString(provider?.version),
        platform: "web",
      },
    };
  }

  if (provider.isCoinbaseWallet === true) {
    return {
      walletProvider: "coinbase_wallet",
      walletMetadata: {
        providerType: "injected",
        walletName: "Coinbase Wallet",
        walletVersion: readNullableString(provider?.version),
        platform: "web",
      },
    };
  }

  if (provider.isMetaMask === true) {
    return {
      walletProvider: "metamask",
      walletMetadata: {
        providerType: "injected",
        walletName: "MetaMask",
        walletVersion: readNullableString(provider?._metamask?.version ?? provider?.version),
        platform: "web",
      },
    };
  }

  if (provider.isTrust === true || provider.isTrustWallet === true) {
    return {
      walletProvider: "trust_wallet",
      walletMetadata: {
        providerType: "injected",
        walletName: "Trust Wallet",
        walletVersion: readNullableString(provider?.version),
        platform: "web",
      },
    };
  }

  return {
    walletProvider: "unknown_injected",
    walletMetadata: {
      providerType: "injected",
      walletName: "Unknown Wallet",
      walletVersion: readNullableString(provider?.version),
      platform: "web",
    },
  };
}

function createRpcError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function createProviderGuardController(options = {}) {
  const pendingRequests = new Map();
  const wrappedProviders = new WeakSet();
  const timeoutMs = typeof options.timeoutMs === "number" ? options.timeoutMs : 30_000;
  const windowRef =
    options.window ??
    globalThis.window ?? {
      location: {
        href: "https://example.test/",
        hostname: "example.test",
        origin: "https://example.test",
      },
    };
  let sequence = 0;

  function makeRequestId() {
    if (typeof options.makeRequestId === "function") {
      return options.makeRequestId();
    }

    sequence += 1;
    return `clickshield-l3-${Date.now()}-${sequence}`;
  }

  function postMessageToExtension(message) {
    if (typeof options.postMessage === "function") {
      options.postMessage(message);
      return;
    }

    windowRef.postMessage(message, windowRef.location?.origin || "*");
  }

  function buildRequestPayload(provider, requestArgs, requestId) {
    const descriptor = detectWalletProvider(provider);
    return {
      requestId,
      rpcMethod: requestArgs.method,
      rpcParams: sanitizeJsonValue(Array.isArray(requestArgs.params) ? requestArgs.params : []),
      originUrl: windowRef.location?.href ?? "",
      originDomain: String(windowRef.location?.hostname ?? "").toLowerCase(),
      walletProvider: descriptor.walletProvider,
      walletMetadata: descriptor.walletMetadata,
      selectedAddress:
        typeof provider?.selectedAddress === "string" ? provider.selectedAddress : null,
      chainId:
        typeof provider?.chainId === "string" || typeof provider?.chainId === "number"
          ? provider.chainId
          : null,
    };
  }

  function forwardOriginalRequest(entry) {
    return Promise.resolve(entry.originalRequest(entry.requestArgsSnapshot)).then(
      (result) => {
        entry.resolve(result);
      },
      (error) => {
        entry.reject(error);
      },
    );
  }

  function takePendingRequest(requestId) {
    const entry = pendingRequests.get(requestId);
    if (!entry) {
      return null;
    }

    pendingRequests.delete(requestId);
    clearTimeout(entry.timeoutId);
    return entry;
  }

  function releasePendingRequest(requestId, resolution) {
    const entry = takePendingRequest(requestId);
    if (!entry) {
      return false;
    }

    if (resolution?.action === "forward") {
      void forwardOriginalRequest(entry);
      return true;
    }

    const errorCode =
      typeof resolution?.error?.code === "number"
        ? resolution.error.code
        : USER_REJECTED_ERROR_CODE;
    const errorMessage =
      typeof resolution?.error?.message === "string"
        ? resolution.error.message
        : "User rejected the request.";
    entry.reject(createRpcError(errorCode, errorMessage));
    return true;
  }

  function dispatchPendingRequest(provider, requestArgsSnapshot, requestId) {
    const request = buildRequestPayload(provider, requestArgsSnapshot, requestId);

    if (typeof options.dispatchRequest === "function") {
      return options.dispatchRequest(request);
    }

    postMessageToExtension({
      source: CLICKSHIELD_PROVIDER_SOURCE,
      type: "CLICKSHIELD_L3_RPC_REQUEST",
      request,
    });
    return undefined;
  }

  function interceptRequest(provider, requestArgs, originalRequest) {
    const requestId = makeRequestId();
    const requestArgsSnapshot = deepFreezeValue(cloneValue(requestArgs));

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        pendingRequests.delete(requestId);
        reject(
          createRpcError(
            INTERNAL_ERROR_CODE,
            "ClickShield timed out while evaluating this request.",
          ),
        );
      }, timeoutMs);

      pendingRequests.set(requestId, {
        requestArgsSnapshot,
        originalRequest,
        resolve,
        reject,
        timeoutId,
      });

      void Promise.resolve(dispatchPendingRequest(provider, requestArgsSnapshot, requestId)).then(
        (response) => {
          if (response?.ok === false) {
            const entry = takePendingRequest(requestId);
            if (!entry) {
              return;
            }

            entry.reject(
              createRpcError(
                INTERNAL_ERROR_CODE,
                typeof response.error === "string"
                  ? response.error
                  : "ClickShield could not start Layer 3 evaluation.",
              ),
            );
          }
        },
        (error) => {
          const entry = takePendingRequest(requestId);
          if (!entry) {
            return;
          }

          entry.reject(error);
        },
      );
    });
  }

  function wrapProvider(provider) {
    if (!provider || typeof provider.request !== "function" || wrappedProviders.has(provider)) {
      return provider;
    }

    const originalRequest = provider.request.bind(provider);

    Object.defineProperty(provider, "request", {
      configurable: true,
      enumerable: true,
      writable: true,
      value(requestArgs) {
        if (!isRecord(requestArgs) || !isLayer3RpcMethod(requestArgs.method)) {
          return originalRequest(requestArgs);
        }

        return interceptRequest(provider, requestArgs, originalRequest);
      },
    });

    wrappedProviders.add(provider);
    return provider;
  }

  function handleDecisionMessage(message) {
    if (
      !isRecord(message) ||
      message.source !== CLICKSHIELD_EXTENSION_SOURCE ||
      message.type !== CLICKSHIELD_RELEASE_MESSAGE_TYPE ||
      typeof message.requestId !== "string"
    ) {
      return false;
    }

    return releasePendingRequest(message.requestId, message);
  }

  return {
    pendingRequests,
    wrapProvider,
    handleDecisionMessage,
  };
}

function createRuntimeRpcDispatcher(options = {}) {
  const runtimeRef = options.runtime ?? globalThis.chrome?.runtime;

  return function dispatchRequest(request) {
    return new Promise((resolve, reject) => {
      if (!runtimeRef?.sendMessage) {
        reject(new Error("ClickShield runtime messaging is unavailable."));
        return;
      }

      runtimeRef.sendMessage(
        {
          type: "L3_HANDLE_RPC",
          request,
        },
        (response) => {
          if (runtimeRef.lastError) {
            reject(new Error(runtimeRef.lastError.message));
            return;
          }

          if (!response || response.ok !== true) {
            reject(
              createRpcError(
                INTERNAL_ERROR_CODE,
                typeof response?.error === "string"
                  ? response.error
                  : "ClickShield did not receive a valid Layer 3 acknowledgement.",
              ),
            );
            return;
          }

          resolve(response);
        },
      );
    });
  };
}

function initializeProviderGuard() {
  const controller = createProviderGuardController({
    dispatchRequest: createRuntimeRpcDispatcher(),
  });

  function wrapKnownProviders() {
    if (window.ethereum) {
      controller.wrapProvider(window.ethereum);
    }

    if (Array.isArray(window.ethereum?.providers)) {
      for (const provider of window.ethereum.providers) {
        controller.wrapProvider(provider);
      }
    }
  }

  wrapKnownProviders();
  const intervalId = window.setInterval(wrapKnownProviders, 500);

  window.addEventListener("ethereum#initialized", wrapKnownProviders);
  chrome.runtime.onMessage.addListener((message) => controller.handleDecisionMessage(message));
  window.addEventListener("beforeunload", () => {
    window.clearInterval(intervalId);
  });
}

if (globalThis.__CLICKSHIELD_ENABLE_TEST_HOOKS__ === true) {
  globalThis.__CLICKSHIELD_LAYER3_PROVIDER_GUARD_TEST_HOOKS__ = {
    CLICKSHIELD_PROVIDER_SOURCE,
    CLICKSHIELD_EXTENSION_SOURCE,
    USER_REJECTED_ERROR_CODE,
    INTERNAL_ERROR_CODE,
    CLICKSHIELD_RELEASE_MESSAGE_TYPE,
    createProviderGuardController,
    createRuntimeRpcDispatcher,
    createRpcError,
    detectWalletProvider,
    isLayer3RpcMethod,
  };
}

if (
  typeof window !== "undefined" &&
  typeof chrome !== "undefined" &&
  chrome?.runtime &&
  globalThis.__CLICKSHIELD_DISABLE_AUTO_INIT__ !== true
) {
  initializeProviderGuard();
}
