import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.__CLICKSHIELD_ENABLE_TEST_HOOKS__ = true;
globalThis.__CLICKSHIELD_DISABLE_AUTO_INIT__ = true;

await import('../providerGuard.js');
await import('../transactionInterceptor.js');

const providerGuardHooks = globalThis.__CLICKSHIELD_LAYER3_PROVIDER_GUARD_TEST_HOOKS__;
const interceptorHooks = globalThis.__CLICKSHIELD_LAYER3_INTERCEPTOR_TEST_HOOKS__;
const RELEASE_MESSAGE = {
  source: providerGuardHooks.CLICKSHIELD_EXTENSION_SOURCE,
  type: providerGuardHooks.CLICKSHIELD_RELEASE_MESSAGE_TYPE,
};

test('provider guard intercepts Layer 3 RPC methods and waits for the extension-owned release message', async () => {
  const requests = [];
  const provider = {
    requestCalls: [],
    request(args) {
      this.requestCalls.push(args);
      return Promise.resolve({ ok: true });
    },
  };

  const controller = providerGuardHooks.createProviderGuardController({
    dispatchRequest(request) {
      requests.push(request);
      return Promise.resolve({
        ok: true,
        resolution: {
          action: 'forward',
        },
      });
    },
    makeRequestId() {
      return 'req-1';
    },
  });

  controller.wrapProvider(provider);

  const pending = provider.request({
    method: 'eth_sendTransaction',
    params: [
      {
        from: '0x1111111111111111111111111111111111111111',
        to: '0x2222222222222222222222222222222222222222',
        value: '0x0',
        data: '0x',
      },
    ],
  });

  assert.equal(requests.length, 1);
  assert.equal(provider.requestCalls.length, 0);
  assert.equal(requests[0].requestId, 'req-1');
  assert.equal(controller.pendingRequests.has('req-1'), true);

  await Promise.resolve();
  assert.equal(provider.requestCalls.length, 0);

  controller.handleDecisionMessage({
    ...RELEASE_MESSAGE,
    requestId: 'req-1',
    action: 'forward',
    audit: { finalUserAction: 'auto-allowed' },
  });

  const result = await pending;
  assert.deepEqual(result, { ok: true });
  assert.equal(provider.requestCalls.length, 1);
});

test('page cannot read an authorization capability from the intercepted request payload', async () => {
  const requests = [];
  const controller = providerGuardHooks.createProviderGuardController({
    dispatchRequest(request) {
      requests.push(request);
      return Promise.resolve({
        ok: true,
      });
    },
    makeRequestId() {
      return 'req-capability';
    },
  });

  const provider = {
    request() {
      return Promise.resolve({ ok: true });
    },
  };

  controller.wrapProvider(provider);
  const pending = provider.request({
    method: 'eth_sendTransaction',
    params: [
      {
        from: '0x1111111111111111111111111111111111111111',
        to: '0x2222222222222222222222222222222222222222',
        value: '0x0',
        data: '0x',
      },
    ],
  });

  controller.handleDecisionMessage({
    ...RELEASE_MESSAGE,
    requestId: 'req-capability',
    action: 'reject',
    error: {
      code: 4001,
      message: 'blocked for test',
    },
  });

  await assert.rejects(pending, /blocked for test/);

  assert.equal(requests.length, 1);
  assert.equal('bridgeSecret' in requests[0], false);
  assert.equal(
    Object.hasOwn(globalThis, '__CLICKSHIELD_PROVIDER_GUARD_SECRET__'),
    false,
  );
});

test('forged page decision attempts with observed metadata cannot release a pending request', async () => {
  const requests = [];
  const provider = {
    requestCalls: [],
    request(args) {
      this.requestCalls.push(args);
      return Promise.resolve({ ok: true });
    },
  };

  const controller = providerGuardHooks.createProviderGuardController({
    dispatchRequest(request) {
      requests.push(request);
      return Promise.resolve({ ok: true });
    },
    makeRequestId() {
      return 'req-forge';
    },
  });

  controller.wrapProvider(provider);

  const pending = provider.request({
    method: 'eth_sendTransaction',
    params: [
      {
        from: '0x1111111111111111111111111111111111111111',
        to: '0x2222222222222222222222222222222222222222',
        value: '0x0',
        data: '0x',
      },
    ],
  });

  assert.equal(requests.length, 1);
  assert.equal(
    controller.handleDecisionMessage({
      source: providerGuardHooks.CLICKSHIELD_EXTENSION_SOURCE,
      requestId: 'req-forge',
      action: 'forward',
    }),
    false,
  );
  assert.equal(provider.requestCalls.length, 0);
  assert.equal(controller.pendingRequests.has('req-forge'), true);

  controller.handleDecisionMessage({
    ...RELEASE_MESSAGE,
    requestId: 'req-forge',
    action: 'forward',
    audit: { finalUserAction: 'overridden' },
  });

  await pending;
  assert.equal(provider.requestCalls.length, 1);
});

test('mutating the original request object after interception does not change the forwarded payload', async () => {
  const provider = {
    requestCalls: [],
    request(args) {
      this.requestCalls.push(args);
      return Promise.resolve({ ok: true });
    },
  };

  const controller = providerGuardHooks.createProviderGuardController({
    dispatchRequest() {
      return Promise.resolve({ ok: true });
    },
    makeRequestId() {
      return 'req-snapshot';
    },
  });

  controller.wrapProvider(provider);

  const requestArgs = {
    method: 'eth_sendTransaction',
    params: [
      {
        from: '0x1111111111111111111111111111111111111111',
        to: '0x2222222222222222222222222222222222222222',
        value: '0x0',
        data: '0x095ea7b30000000000000000000000003333333333333333333333333333333333333333',
      },
    ],
  };

  const pending = provider.request(requestArgs);
  requestArgs.params[0].to = '0x9999999999999999999999999999999999999999';
  requestArgs.params[0].data = '0xdeadbeef';

  controller.handleDecisionMessage({
    ...RELEASE_MESSAGE,
    requestId: 'req-snapshot',
    action: 'forward',
  });

  await pending;
  assert.equal(provider.requestCalls.length, 1);
  assert.notEqual(provider.requestCalls[0], requestArgs);
  assert.deepEqual(provider.requestCalls[0], {
    method: 'eth_sendTransaction',
    params: [
      {
        from: '0x1111111111111111111111111111111111111111',
        to: '0x2222222222222222222222222222222222222222',
        value: '0x0',
        data: '0x095ea7b30000000000000000000000003333333333333333333333333333333333333333',
      },
    ],
  });
});

test('provider guard forwards non-Layer 3 methods without interception', async () => {
  const provider = {
    requestCalls: [],
    request(args) {
      this.requestCalls.push(args);
      return Promise.resolve({ method: args.method });
    },
  };

  const controller = providerGuardHooks.createProviderGuardController({
    dispatchRequest() {
      throw new Error('should not intercept');
    },
  });

  controller.wrapProvider(provider);
  const result = await provider.request({
    method: 'eth_chainId',
    params: [],
  });

  assert.deepEqual(result, { method: 'eth_chainId' });
  assert.equal(provider.requestCalls.length, 1);
});

test('interceptor forwards ALLOW decisions without opening a modal', async () => {
  const controller = interceptorHooks.createTransactionInterceptorController({
    async presentModal() {
      throw new Error('modal should not open');
    },
  });

  const response = await controller.handleModalRequest({
    type: interceptorHooks.CLICKSHIELD_MODAL_REQUEST,
    decision: {
      requestId: 'allow-1',
      verdict: { status: 'ALLOW' },
      audit: { finalUserAction: 'auto-allowed' },
    },
  });

  assert.deepEqual(response, {
    ok: true,
    resolution: {
      action: 'forward',
      audit: { finalUserAction: 'auto-allowed' },
    },
  });
});

test('interceptor rejects WARN decisions when the user cancels the modal', async () => {
  const controller = interceptorHooks.createTransactionInterceptorController({
    async presentModal() {
      return { action: 'cancel' };
    },
  });

  const response = await controller.handleModalRequest({
    type: interceptorHooks.CLICKSHIELD_MODAL_REQUEST,
    decision: {
      requestId: 'warn-cancel',
      verdict: { status: 'WARN' },
      audit: { finalUserAction: 'pending' },
      modal: {
        confirmation: { kind: 'confirm' },
      },
    },
  });

  assert.deepEqual(response, {
    ok: true,
    resolution: {
      action: 'reject',
      error: interceptorHooks.USER_REJECTED_ERROR,
      audit: {
        finalUserAction: 'cancelled',
      },
    },
  });
});

test('interceptor forwards WARN decisions only after modal override', async () => {
  const controller = interceptorHooks.createTransactionInterceptorController({
    async presentModal() {
      return { action: 'override' };
    },
  });

  const response = await controller.handleModalRequest({
    type: interceptorHooks.CLICKSHIELD_MODAL_REQUEST,
    decision: {
      requestId: 'warn-override',
      verdict: { status: 'WARN' },
      audit: {
        finalUserAction: 'pending',
        confirmationMode: 'confirm',
      },
      modal: {
        confirmation: { kind: 'confirm' },
      },
    },
  });

  assert.deepEqual(response, {
    ok: true,
    resolution: {
      action: 'forward',
      audit: {
        finalUserAction: 'overridden',
        confirmationMode: 'confirm',
      },
    },
  });
});

test('interceptor keeps BLOCK decisions rejected even if the modal flow resolves', async () => {
  let presentedDecision = null;
  const controller = interceptorHooks.createTransactionInterceptorController({
    async presentModal(decision) {
      presentedDecision = decision;
      return { action: 'override' };
    },
  });

  const response = await controller.handleModalRequest({
    type: interceptorHooks.CLICKSHIELD_MODAL_REQUEST,
    decision: {
      requestId: 'block-override',
      verdict: { status: 'BLOCK' },
      audit: {
        finalUserAction: 'blocked',
        confirmationMode: 'none',
      },
      modal: {
        overrideAllowed: false,
        confirmation: null,
        enforcementMessage: 'ClickShield blocked this request and will not forward it.',
      },
    },
  });

  assert.equal(presentedDecision.modal.overrideAllowed, false);
  assert.equal(presentedDecision.modal.confirmation, null);
  assert.deepEqual(response, {
    ok: true,
    resolution: {
      action: 'reject',
      error: interceptorHooks.BLOCKED_ERROR,
      audit: {
        finalUserAction: 'blocked',
        confirmationMode: 'none',
      },
    },
  });
});
