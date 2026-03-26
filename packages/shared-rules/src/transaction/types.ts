export type ChainFamily = "evm";

export type TransactionEventKind = "transaction" | "signature";

export type TransactionRpcMethod = "eth_sendTransaction";

export type SignatureRpcMethod = "eth_signTypedData" | "eth_signTypedData_v4";

export type Layer3RpcMethod = TransactionRpcMethod | SignatureRpcMethod;

export type TransactionActionType =
  | "approve"
  | "setApprovalForAll"
  | "increaseAllowance"
  | "permit"
  | "transfer"
  | "transferFrom"
  | "multicall"
  | "unknown";

export type ApprovalAmountKind = "exact" | "unlimited" | "not_applicable";

export type ApprovalScope =
  | "single_token"
  | "collection_all"
  | "not_applicable";

export type ApprovalDirection = "grant" | "revoke" | "not_applicable";

export type PermitKind =
  | "none"
  | "erc20_permit"
  | "permit2_single"
  | "permit2_batch"
  | "unknown_permit";

export type TypedDataNormalizationState =
  | "normalized"
  | "missing_domain_fields"
  | "invalid_domain_fields";

export type TransactionIntelDisposition =
  | "malicious"
  | "allowlisted"
  | "no_match"
  | "unavailable";

export type Layer2SectionState =
  | "fresh"
  | "stale"
  | "expired"
  | "missing"
  | "invalid";

export type TransactionParamValue = string | boolean | null;

export interface WalletProviderMetadata {
  readonly providerType: string;
  readonly walletName: string;
  readonly walletVersion: string | null;
  readonly platform: string;
}

export interface TransactionCounterpartyContext {
  readonly spenderTrusted: boolean | null;
  readonly recipientIsNew: boolean | null;
}

export interface TransactionIntelContext {
  readonly contractDisposition: TransactionIntelDisposition;
  readonly contractFeedVersion: string | null;
  readonly allowlistFeedVersion: string | null;
  readonly signatureDisposition: TransactionIntelDisposition;
  readonly signatureFeedVersion: string | null;
  readonly originDisposition: "allowlisted" | "no_match" | "unavailable";
  readonly sectionStates: Readonly<Record<string, Layer2SectionState>>;
}

export interface TransactionProviderContext {
  readonly surface: string;
  readonly walletProvider: string;
  readonly walletName: string;
  readonly platform: string;
}

export interface TransactionMeta {
  readonly selectorRecognized: boolean;
  readonly typedDataNormalized: boolean;
}

export interface DecodedTransactionAction {
  readonly functionName: string | null;
  readonly selector: string | null;
  readonly actionType: TransactionActionType;
  readonly params: Readonly<Record<string, TransactionParamValue>>;
  readonly tokenAddress: string | null;
  readonly spender: string | null;
  readonly operator: string | null;
  readonly recipient: string | null;
  readonly owner: string | null;
  readonly amount: string | null;
  readonly amountKind: ApprovalAmountKind;
  readonly approvalScope: ApprovalScope;
  readonly approvalDirection: ApprovalDirection;
}

export interface TransactionBatchContext {
  readonly isMulticall: boolean;
  readonly batchSelector: string | null;
  readonly actions: readonly DecodedTransactionAction[];
}

export type TypedDataValue =
  | string
  | boolean
  | null
  | readonly TypedDataValue[]
  | { readonly [key: string]: TypedDataValue };

export interface TypedDataField {
  readonly name: string;
  readonly type: string;
}

export type TypedDataTypes = Readonly<Record<string, readonly TypedDataField[]>>;

export interface NormalizedTypedData {
  readonly isTypedData: boolean;
  readonly primaryType: string | null;
  readonly domainName: string | null;
  readonly domainVersion: string | null;
  readonly domainChainId: string | null;
  readonly domainChainIdPresent: boolean;
  readonly verifyingContract: string | null;
  readonly verifyingContractPresent: boolean;
  readonly message: { readonly [key: string]: TypedDataValue };
  readonly domain: { readonly [key: string]: TypedDataValue };
  readonly types: TypedDataTypes;
  readonly canonicalJson: string;
  readonly normalizationState: TypedDataNormalizationState;
  readonly missingDomainFields: readonly string[];
  readonly invalidDomainFields: readonly string[];
  readonly permitKind: PermitKind;
}

export interface RawTransactionRequest {
  readonly eventKind: "transaction";
  readonly rpcMethod: TransactionRpcMethod;
  readonly chainFamily: ChainFamily;
  readonly chainId: number;
  readonly from: string;
  readonly to: string;
  readonly value: string | number | bigint | null | undefined;
  readonly calldata: string;
  readonly originDomain: string;
  readonly walletProvider: string;
  readonly walletMetadata: WalletProviderMetadata;
  readonly surface?: string;
  readonly intel?: Partial<TransactionIntelContext>;
  readonly counterparty?: Partial<TransactionCounterpartyContext>;
}

export interface RawTypedDataPayload {
  readonly domain?: Readonly<Record<string, unknown>> | null;
  readonly types?: Readonly<Record<string, readonly TypedDataField[]>> | null;
  readonly primaryType?: string | null;
  readonly message?: Readonly<Record<string, unknown>> | null;
}

export interface RawSignatureRequest {
  readonly eventKind: "signature";
  readonly rpcMethod: SignatureRpcMethod;
  readonly chainFamily: ChainFamily;
  readonly chainId: number;
  readonly from: string;
  readonly typedData: string | RawTypedDataPayload;
  readonly originDomain: string;
  readonly walletProvider: string;
  readonly walletMetadata: WalletProviderMetadata;
  readonly surface?: string;
  readonly intel?: Partial<TransactionIntelContext>;
  readonly counterparty?: Partial<TransactionCounterpartyContext>;
}

export interface NormalizedTransactionContext {
  readonly eventKind: TransactionEventKind;
  readonly rpcMethod: Layer3RpcMethod;
  readonly chainFamily: ChainFamily;
  readonly chainId: number;
  readonly originDomain: string;
  readonly from: string;
  readonly to: string | null;
  readonly valueWei: string;
  readonly calldata: string;
  readonly methodSelector: string | null;
  readonly actionType: TransactionActionType;
  readonly decoded: DecodedTransactionAction;
  readonly batch: TransactionBatchContext;
  readonly signature: NormalizedTypedData;
  readonly signals: TransactionSignals;
  readonly riskClassification: TransactionRiskClassification;
  readonly intel: TransactionIntelContext;
  readonly provider: TransactionProviderContext;
  readonly counterparty: TransactionCounterpartyContext;
  readonly meta: TransactionMeta;
}

export interface TransactionExplanation {
  readonly status: "block" | "warn" | "allow";
  readonly summary: string;
  readonly primaryReason: string;
  readonly secondaryReasons: readonly string[];
  readonly riskLevel: "high" | "medium" | "low";
  readonly details: {
    readonly method?: string;
    readonly target?: string;
    readonly value?: string;
    readonly isContractInteraction: boolean;
  };
}

export interface TransactionSignals {
  readonly isContractInteraction: boolean;
  readonly isNativeTransfer: boolean;
  readonly methodName?: string;
  readonly isApproval: boolean;
  readonly actionType: TransactionActionType;
  readonly isApprovalMethod: boolean;
  readonly isUnlimitedApproval: boolean;
  readonly hasValueTransfer: boolean;
  readonly isHighValue: boolean;
  readonly targetAddress?: string;
  readonly isPermitSignature: boolean;
  readonly isSetApprovalForAll: boolean;
  readonly approvalDirection: ApprovalDirection;
  readonly spenderTrusted: boolean | null;
  readonly recipientIsNew: boolean | null;
  readonly isTransfer: boolean;
  readonly isTransferFrom: boolean;
  readonly isMulticall: boolean;
  readonly containsApprovalAndTransfer: boolean;
  readonly containsApproval: boolean;
  readonly containsTransfer: boolean;
  readonly containsTransferFrom: boolean;
  readonly batchActionCount: number;
  readonly hasNativeValue: boolean;
  readonly touchesMaliciousContract: boolean;
  readonly targetAllowlisted: boolean;
  readonly signatureIntelMatch: boolean;
  readonly verifyingContractKnown: boolean;
  readonly hasUnknownInnerCall: boolean;
}

export interface TransactionRiskClassification {
  readonly hasMaliciousTarget: boolean;
  readonly hasKnownScamSignature: boolean;
  readonly isApprovalRisk: boolean;
  readonly isUnlimitedApprovalRisk: boolean;
  readonly isPermitRisk: boolean;
  readonly isHighValueTransferRisk: boolean;
  readonly isUnknownMethodRisk: boolean;
  readonly requiresUserAttention: boolean;
}
