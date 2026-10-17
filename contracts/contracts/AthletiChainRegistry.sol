// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @title AthletiChain record registry
/// @notice Stores only fingerprints of coach-verified athlete records.
///         No names, metric values, files or salts ever reach the chain.
/// @dev A coach signs an EIP-712 message (free, no gas) and any relayer submits it,
///      in the same style as ERC-20 `permit`. The signing coach, not msg.sender,
///      is recorded as the verifier.
contract AthletiChainRegistry is Ownable, EIP712 {
    enum Status {
        None,
        Verified,
        Superseded
    }

    struct Verifier {
        uint64 activeFrom;
        uint64 activeUntil; // 0 = still active
        bool exists;
    }

    struct Record {
        bytes32 recordHash;
        address verifier;
        uint64 timestamp;
        Status status;
        bytes32 supersededBy;
    }

    bytes32 public constant VERIFY_TYPEHASH =
        keccak256("VerifyRecord(bytes32 recordKey,bytes32 recordHash,address verifier,uint256 nonce,uint256 deadline)");
    bytes32 public constant SUPERSEDE_TYPEHASH = keccak256(
        "SupersedeRecord(bytes32 oldKey,bytes32 newKey,bytes32 newHash,address verifier,uint256 nonce,uint256 deadline)"
    );

    mapping(address => Verifier) public verifiers;
    mapping(address => uint256) public nonces;
    mapping(bytes32 => Record) private _records;

    event VerifierRegistered(address indexed verifier, uint64 activeFrom);
    event VerifierRevoked(address indexed verifier, uint64 activeUntil);
    event RecordVerified(bytes32 indexed recordKey, bytes32 recordHash, address indexed verifier);
    event RecordSuperseded(bytes32 indexed oldKey, bytes32 indexed newKey, address indexed verifier);

    error SignatureExpired();
    error InvalidSignature();
    error NotActiveVerifier(address verifier);
    error RecordExists(bytes32 recordKey);
    error RecordNotVerified(bytes32 recordKey);
    error AlreadyRegistered(address verifier);
    error UnknownVerifier(address verifier);
    error ZeroValue();

    constructor() Ownable(msg.sender) EIP712("AthletiChain", "1") {}

    // ---------------------------------------------------------------- verifiers

    /// @notice Admin (contract owner) approves a coach wallet to sign verifications from now on.
    function registerVerifier(address v) external onlyOwner {
        if (v == address(0)) revert ZeroValue();
        Verifier storage current = verifiers[v];
        if (current.exists && current.activeUntil == 0) revert AlreadyRegistered(v);
        verifiers[v] = Verifier({activeFrom: uint64(block.timestamp), activeUntil: 0, exists: true});
        emit VerifierRegistered(v, uint64(block.timestamp));
    }

    /// @notice Stops a coach signing new records. Records they already signed stay valid.
    function revokeVerifier(address v) external onlyOwner {
        Verifier storage current = verifiers[v];
        if (!current.exists || current.activeUntil != 0) revert UnknownVerifier(v);
        current.activeUntil = uint64(block.timestamp);
        emit VerifierRevoked(v, uint64(block.timestamp));
    }

    function wasVerifierActive(address v, uint64 at) public view returns (bool) {
        Verifier memory info = verifiers[v];
        if (!info.exists || at < info.activeFrom) return false;
        return info.activeUntil == 0 || at < info.activeUntil;
    }

    // ------------------------------------------------------------------ records

    function verifyRecord(bytes32 recordKey, bytes32 recordHash, address verifier, uint256 deadline, bytes calldata sig)
        external
    {
        if (recordKey == bytes32(0) || recordHash == bytes32(0)) revert ZeroValue();
        bytes32 structHash =
            keccak256(abi.encode(VERIFY_TYPEHASH, recordKey, recordHash, verifier, nonces[verifier], deadline));
        _checkAndConsume(structHash, verifier, deadline, sig);
        _store(recordKey, recordHash, verifier);
        emit RecordVerified(recordKey, recordHash, verifier);
    }

    /// @notice Replaces a verified record with a corrected version. The old hash is kept
    ///         and marked Superseded, so the correction itself is auditable.
    function supersedeRecord(
        bytes32 oldKey,
        bytes32 newKey,
        bytes32 newHash,
        address verifier,
        uint256 deadline,
        bytes calldata sig
    ) external {
        if (newKey == bytes32(0) || newHash == bytes32(0)) revert ZeroValue();
        Record storage old = _records[oldKey];
        if (old.status != Status.Verified) revert RecordNotVerified(oldKey);
        bytes32 structHash = keccak256(
            abi.encode(SUPERSEDE_TYPEHASH, oldKey, newKey, newHash, verifier, nonces[verifier], deadline)
        );
        _checkAndConsume(structHash, verifier, deadline, sig);
        _store(newKey, newHash, verifier);
        old.status = Status.Superseded;
        old.supersededBy = newKey;
        emit RecordVerified(newKey, newHash, verifier);
        emit RecordSuperseded(oldKey, newKey, verifier);
    }

    function getRecord(bytes32 recordKey) external view returns (Record memory) {
        return _records[recordKey];
    }

    function isRecordVerified(bytes32 recordKey, bytes32 recordHash) external view returns (bool) {
        Record memory r = _records[recordKey];
        return r.status == Status.Verified && r.recordHash == recordHash;
    }

    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    // ----------------------------------------------------------------- internal

    function _checkAndConsume(bytes32 structHash, address verifier, uint256 deadline, bytes calldata sig) private {
        if (block.timestamp > deadline) revert SignatureExpired();
        (address signer, ECDSA.RecoverError err,) = ECDSA.tryRecover(_hashTypedDataV4(structHash), sig);
        if (err != ECDSA.RecoverError.NoError || signer != verifier) revert InvalidSignature();
        if (!wasVerifierActive(verifier, uint64(block.timestamp))) revert NotActiveVerifier(verifier);
        unchecked {
            nonces[verifier]++;
        }
    }

    function _store(bytes32 recordKey, bytes32 recordHash, address verifier) private {
        if (_records[recordKey].status != Status.None) revert RecordExists(recordKey);
        _records[recordKey] = Record({
            recordHash: recordHash,
            verifier: verifier,
            timestamp: uint64(block.timestamp),
            status: Status.Verified,
            supersededBy: bytes32(0)
        });
    }
}
