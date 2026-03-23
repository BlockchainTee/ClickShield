import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LAYER3_BLOCK_ACKNOWLEDGEMENT,
  evaluateLayer3RpcRequest,
} from '../layer3.js';

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
    intel: {
      contractDisposition: 'no_match',
      signatureDisposition: 'no_match',
      originDisposition: 'no_match',
    },
  });

  assert.equal(decision.normalizedContext.eventKind, 'transaction');
  assert.equal(decision.normalizedContext.rpcMethod, 'eth_sendTransaction');
  assert.equal(decision.normalizedContext.actionType, 'approve');
  assert.equal(decision.verdict.status, 'WARN');
  assert.equal(decision.verdict.overrideLevel, 'confirm');
  assert.equal(decision.action, 'gate');
  assert.equal(decision.modal.verdictLabel, 'Warning');
  assert.equal(decision.modal.confirmation.kind, 'confirm');
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
      intel: {
        contractDisposition: 'no_match',
        signatureDisposition: 'no_match',
        originDisposition: 'no_match',
      },
    });

    assert.equal(decision.normalizedContext.eventKind, 'signature');
    assert.equal(decision.normalizedContext.rpcMethod, rpcMethod);
    assert.equal(decision.normalizedContext.signature.primaryType, 'PermitSingle');
    assert.equal(decision.verdict.status, 'WARN');
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
    intel: {
      contractDisposition: 'allowlisted',
      signatureDisposition: 'no_match',
      originDisposition: 'no_match',
    },
    counterparty: {
      recipientIsNew: false,
    },
  });

  assert.equal(decision.verdict.status, 'ALLOW');
  assert.equal(decision.action, 'allow');
  assert.equal(decision.modal, null);
  assert.equal(decision.audit.finalUserAction, 'auto-allowed');
});

test('malicious contract intel drives BLOCK and the stronger override contract', () => {
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
      contractDisposition: 'malicious',
      contractFeedVersion: 'contracts@2026-03-22',
      signatureDisposition: 'no_match',
      originDisposition: 'no_match',
      sectionStates: {
        maliciousContracts: 'fresh',
        scamSignatures: 'missing',
        allowlists: 'missing',
      },
    },
  });

  assert.equal(decision.verdict.status, 'BLOCK');
  assert.equal(decision.verdict.overrideLevel, 'high_friction_confirm');
  assert.equal(decision.modal.verdictLabel, 'Blocked');
  assert.equal(decision.modal.confirmation.kind, 'typed_acknowledgement');
  assert.equal(decision.modal.confirmation.expectedText, LAYER3_BLOCK_ACKNOWLEDGEMENT);
  assert.equal(decision.audit.confirmationMode, 'typed_acknowledgement');
  assert.ok(decision.verdict.reasonCodes.includes('TX_KNOWN_MALICIOUS_CONTRACT'));
});
