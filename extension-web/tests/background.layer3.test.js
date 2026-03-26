import test from 'node:test';
import assert from 'node:assert/strict';

import {
  evaluateLayer3RpcRequest,
} from '../layer3.js';

function buildIntelProvider({
  contractDisposition = 'no_match',
  contractFeedVersion = 'layer2.extension-test',
  contractSectionState = 'fresh',
  signatureDisposition = 'no_match',
  signatureFeedVersion = 'layer2.extension-test',
  signatureSectionState = 'fresh',
} = {}) {
  const maliciousContract = Object.freeze({
    lookupFamily: 'contract',
    matched: contractDisposition === 'malicious',
    disposition: contractDisposition,
    matchedSection: contractDisposition === 'malicious' ? 'maliciousContracts' : undefined,
    feedVersion: contractFeedVersion,
    sectionState: contractSectionState,
    record:
      contractDisposition === 'malicious'
        ? Object.freeze({
            chain: 'evm',
            address: '0x9999999999999999999999999999999999999999',
            source: 'ofac',
            disposition: 'block',
            confidence: 1,
            reasonCodes: Object.freeze(['OFAC_SANCTIONS_ADDRESS']),
          })
        : null,
  });
  const scamSignature = Object.freeze({
    lookupFamily: 'scam_signature',
    matched: signatureDisposition === 'malicious',
    disposition: signatureDisposition,
    matchedSection: signatureDisposition === 'malicious' ? 'scamSignatures' : undefined,
    feedVersion: signatureFeedVersion,
    sectionState: signatureSectionState,
  });
  const canonicalResult = Object.freeze({
    maliciousContract,
    scamSignature,
  });

  return {
    snapshotVersion: 'layer2.extension-test',
    generatedAt: '2026-03-24T00:00:00.000Z',
    lookupCanonicalTransactionIntel() {
      return canonicalResult;
    },
    lookupMaliciousContract() {
      return maliciousContract;
    },
    lookupScamSignature() {
      return scamSignature;
    },
  };
}

const NO_MATCH_PROVIDER = buildIntelProvider();
const MALICIOUS_PROVIDER = buildIntelProvider({
  contractDisposition: 'malicious',
  contractFeedVersion: 'contracts@2026-03-22',
});

function buildApproveCalldata(spender, amountHex) {
  const normalizedSpender = spender.toLowerCase().replace(/^0x/, '').padStart(64, '0');
  const normalizedAmount = amountHex.replace(/^0x/, '').padStart(64, '0');
  return `0x095ea7b3${normalizedSpender}${normalizedAmount}`;
}

function permitTypedData() {
  return {
    domain: {
      name: 'Permit2',
      chainId: 1,
      verifyingContract: '0x3333333333333333333333333333333333333333',
    },
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' },
      ],
      PermitSingle: [{ name: 'spender', type: 'address' }],
    },
    primaryType: 'PermitSingle',
    message: {
      spender: '0x4444444444444444444444444444444444444444',
    },
  };
}

test('eth_sendTransaction approval requests are normalized and gated as WARN', () => {
  const decision = evaluateLayer3RpcRequest({
    requestId: 'warn-approve',
    rpcMethod: 'eth_sendTransaction',
    rpcParams: [
      {
        from: '0x1111111111111111111111111111111111111111',
        to: '0x2222222222222222222222222222222222222222',
        value: '0x0',
        data: buildApproveCalldata(
          '0x3333333333333333333333333333333333333333',
          '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
        ),
      },
    ],
    originUrl: 'https://app.example.com/swap',
    originDomain: 'app.example.com',
    walletProvider: 'metamask',
    walletMetadata: {
      providerType: 'injected',
      walletName: 'MetaMask',
      walletVersion: '1.0.0',
      platform: 'web',
    },
    selectedAddress: '0x1111111111111111111111111111111111111111',
    chainId: '0x1',
  }, {
    intelProvider: NO_MATCH_PROVIDER,
  });

  assert.equal(decision.normalizedContext.eventKind, 'transaction');
  assert.equal(decision.normalizedContext.rpcMethod, 'eth_sendTransaction');
  assert.equal(decision.normalizedContext.actionType, 'approve');
  assert.equal(decision.normalizedContext.intel.contractDisposition, 'no_match');
  assert.equal(decision.verdict.status, 'WARN');
  assert.equal(decision.verdict.overrideLevel, 'confirm');
  assert.equal(decision.action, 'warn');
  assert.equal(decision.modal.verdictLabel, 'Warning');
  assert.equal(decision.modal.overrideAllowed, true);
  assert.equal(decision.modal.confirmation.kind, 'confirm');
  assert.equal(decision.audit.finalUserAction, 'pending');
  assert.equal(decision.audit.confirmationMode, 'confirm');
  assert.equal(decision.verdict.primaryReason === null, false);
  assert.ok(Array.isArray(decision.verdict.secondaryReasons));
  assert.ok(decision.verdict.reasonCodes.includes('TX_UNLIMITED_APPROVAL'));
  assert.ok(decision.verdict.reasonCodes.includes('TX_UNKNOWN_SPENDER'));
});

test('eth_signTypedData and eth_signTypedData_v4 are normalized as signature requests', () => {
  for (const rpcMethod of ['eth_signTypedData', 'eth_signTypedData_v4']) {
    const decision = evaluateLayer3RpcRequest({
      requestId: `permit-${rpcMethod}`,
      rpcMethod,
      rpcParams: [
        '0x1111111111111111111111111111111111111111',
        permitTypedData(),
      ],
      originUrl: 'https://sign.example.com/permit',
      originDomain: 'sign.example.com',
      walletProvider: 'metamask',
      walletMetadata: {
        providerType: 'injected',
        walletName: 'MetaMask',
        walletVersion: '1.0.0',
        platform: 'web',
      },
      selectedAddress: '0x1111111111111111111111111111111111111111',
      chainId: '0x1',
    }, {
      intelProvider: NO_MATCH_PROVIDER,
    });

    assert.equal(decision.normalizedContext.eventKind, 'signature');
    assert.equal(decision.normalizedContext.rpcMethod, rpcMethod);
    assert.equal(decision.normalizedContext.signature.primaryType, 'PermitSingle');
    assert.equal(decision.normalizedContext.intel.contractDisposition, 'no_match');
    assert.equal(decision.verdict.status, 'WARN');
    assert.equal(decision.action, 'warn');
    assert.equal(decision.modal.primaryAddressLabel, 'Verifying contract');
    assert.equal(decision.modal.confirmation.kind, 'confirm');
    assert.ok(decision.verdict.reasonCodes.includes('TX_PERMIT_SIGNATURE'));
  }
});

test('safe transfer requests stay ALLOW and forward without a modal', () => {
  const decision = evaluateLayer3RpcRequest({
    requestId: 'allow-transfer',
    rpcMethod: 'eth_sendTransaction',
    rpcParams: [
      {
        from: '0x1111111111111111111111111111111111111111',
        to: '0x2222222222222222222222222222222222222222',
        value: '0x0',
        data: '0xa9059cbb00000000000000000000000033333333333333333333333333333333333333330000000000000000000000000000000000000000000000000000000000000001',
      },
    ],
    originUrl: 'https://wallet.example.com/send',
    originDomain: 'wallet.example.com',
    walletProvider: 'metamask',
    walletMetadata: {
      providerType: 'injected',
      walletName: 'MetaMask',
      walletVersion: '1.0.0',
      platform: 'web',
    },
    selectedAddress: '0x1111111111111111111111111111111111111111',
    chainId: 1,
    counterparty: {
      recipientIsNew: false,
    },
  }, {
    intelProvider: NO_MATCH_PROVIDER,
  });

  assert.equal(decision.verdict.status, 'ALLOW');
  assert.equal(decision.action, 'allow');
  assert.equal(decision.modal, null);
  assert.equal(decision.audit.finalUserAction, 'auto-allowed');
  assert.equal(decision.audit.primaryReason, null);
  assert.deepEqual(decision.audit.secondaryReasons, []);
});

test('provider-fed malicious contract intel drives BLOCK and request intel cannot override it', () => {
  const decision = evaluateLayer3RpcRequest({
    requestId: 'block-malicious',
    rpcMethod: 'eth_sendTransaction',
    rpcParams: [
      {
        from: '0x1111111111111111111111111111111111111111',
        to: '0x9999999999999999999999999999999999999999',
        value: '0x0',
        data: '0xa9059cbb000000000000000000000000aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa0000000000000000000000000000000000000000000000000000000000000005',
      },
    ],
    originUrl: 'https://unsafe.example.com/drain',
    originDomain: 'unsafe.example.com',
    walletProvider: 'metamask',
    walletMetadata: {
      providerType: 'injected',
      walletName: 'MetaMask',
      walletVersion: '1.0.0',
      platform: 'web',
    },
    selectedAddress: '0x1111111111111111111111111111111111111111',
    chainId: '0x1',
    intel: {
      contractDisposition: 'no_match',
      contractFeedVersion: 'request@conflict',
    },
  }, {
    intelProvider: MALICIOUS_PROVIDER,
  });

  assert.equal(decision.normalizedContext.intel.contractDisposition, 'malicious');
  assert.equal(decision.normalizedContext.intel.contractFeedVersion, 'contracts@2026-03-22');
  assert.equal(decision.verdict.status, 'BLOCK');
  assert.equal(decision.verdict.overrideAllowed, false);
  assert.equal(decision.verdict.overrideLevel, 'none');
  assert.equal(decision.action, 'block');
  assert.equal(decision.modal.verdictLabel, 'Blocked');
  assert.equal(decision.modal.overrideAllowed, decision.verdict.overrideAllowed);
  assert.equal(decision.modal.overrideLevel, decision.verdict.overrideLevel);
  assert.equal(decision.modal.confirmation, null);
  assert.match(decision.modal.enforcementMessage, /will not forward/i);
  assert.equal(decision.audit.finalUserAction, 'blocked');
  assert.equal(decision.audit.confirmationMode, 'none');
  assert.equal(decision.verdict.primaryReason === null, false);
  assert.ok(Array.isArray(decision.verdict.secondaryReasons));
  assert.ok(decision.verdict.reasonCodes.includes('TX_KNOWN_MALICIOUS_CONTRACT'));
});

test('repeated WARN evaluation stays deterministic across action and reasons', () => {
  const input = {
    requestId: 'warn-deterministic',
    rpcMethod: 'eth_sendTransaction',
    rpcParams: [
      {
        from: '0x1111111111111111111111111111111111111111',
        to: '0x2222222222222222222222222222222222222222',
        value: '0x0',
        data: buildApproveCalldata(
          '0x3333333333333333333333333333333333333333',
          '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
        ),
      },
    ],
    originUrl: 'https://app.example.com/swap',
    originDomain: 'app.example.com',
    walletProvider: 'metamask',
    walletMetadata: {
      providerType: 'injected',
      walletName: 'MetaMask',
      walletVersion: '1.0.0',
      platform: 'web',
    },
    selectedAddress: '0x1111111111111111111111111111111111111111',
    chainId: '0x1',
  };

  const first = evaluateLayer3RpcRequest(input, {
    intelProvider: NO_MATCH_PROVIDER,
  });
  const second = evaluateLayer3RpcRequest(input, {
    intelProvider: NO_MATCH_PROVIDER,
  });

  assert.deepEqual(second, first);
});
