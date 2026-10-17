import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import type { AthletiChainRegistry } from "../typechain-types";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

const HASH = "0x1ca1411401e0877a553a2e051b6afed05a9bec02e857d0686a790e60cd0e1009";
const TAMPERED = "0x122b184a02162f814905e52dec45cb7511aaea15cdeb3b81646647011581036b";
const KEY = ethers.id("PERF-2026-0418");

const VerifyTypes = {
  VerifyRecord: [
    { name: "recordKey", type: "bytes32" },
    { name: "recordHash", type: "bytes32" },
    { name: "verifier", type: "address" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
};
const SupersedeTypes = {
  SupersedeRecord: [
    { name: "oldKey", type: "bytes32" },
    { name: "newKey", type: "bytes32" },
    { name: "newHash", type: "bytes32" },
    { name: "verifier", type: "address" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
};

describe("AthletiChainRegistry", () => {
  let registry: AthletiChainRegistry;
  let admin: HardhatEthersSigner, coach: HardhatEthersSigner, relayer: HardhatEthersSigner, stranger: HardhatEthersSigner;

  async function domain() {
    const { chainId } = await ethers.provider.getNetwork();
    return { name: "AthletiChain", version: "1", chainId, verifyingContract: await registry.getAddress() };
  }

  async function signVerify(signer: HardhatEthersSigner, key: string, hash: string, opts: { nonce?: bigint; deadline?: bigint } = {}) {
    const nonce = opts.nonce ?? (await registry.nonces(signer.address));
    const deadline = opts.deadline ?? BigInt((await time.latest()) + 3600);
    const sig = await signer.signTypedData(await domain(), VerifyTypes, {
      recordKey: key, recordHash: hash, verifier: signer.address, nonce, deadline,
    });
    return { sig, deadline };
  }

  beforeEach(async () => {
    [admin, coach, relayer, stranger] = await ethers.getSigners();
    registry = await ethers.deployContract("AthletiChainRegistry");
    await registry.registerVerifier(coach.address);
  });

  it("anchors a coach-signed record submitted by a relayer", async () => {
    const { sig, deadline } = await signVerify(coach, KEY, HASH);
    await expect(registry.connect(relayer).verifyRecord(KEY, HASH, coach.address, deadline, sig))
      .to.emit(registry, "RecordVerified").withArgs(KEY, HASH, coach.address);
    const rec = await registry.getRecord(KEY);
    expect(rec.recordHash).to.equal(HASH);
    expect(rec.verifier).to.equal(coach.address);
    expect(rec.status).to.equal(1n);
    expect(await registry.isRecordVerified(KEY, HASH)).to.equal(true);
    expect(await registry.isRecordVerified(KEY, TAMPERED)).to.equal(false);
  });

  it("rejects a signer who is not a registered verifier", async () => {
    const { sig, deadline } = await signVerify(stranger, KEY, HASH);
    await expect(registry.verifyRecord(KEY, HASH, stranger.address, deadline, sig))
      .to.be.revertedWithCustomError(registry, "NotActiveVerifier");
  });

  it("rejects a signature that claims to be from someone else", async () => {
    const { sig, deadline } = await signVerify(stranger, KEY, HASH);
    await expect(registry.verifyRecord(KEY, HASH, coach.address, deadline, sig))
      .to.be.revertedWithCustomError(registry, "InvalidSignature");
  });

  it("rejects a signature for a different hash", async () => {
    const { sig, deadline } = await signVerify(coach, KEY, HASH);
    await expect(registry.verifyRecord(KEY, TAMPERED, coach.address, deadline, sig))
      .to.be.revertedWithCustomError(registry, "InvalidSignature");
  });

  it("rejects an expired deadline", async () => {
    const deadline = BigInt((await time.latest()) - 1);
    const { sig } = await signVerify(coach, KEY, HASH, { deadline });
    await expect(registry.verifyRecord(KEY, HASH, coach.address, deadline, sig))
      .to.be.revertedWithCustomError(registry, "SignatureExpired");
  });

  it("blocks replaying a used signature", async () => {
    const { sig, deadline } = await signVerify(coach, KEY, HASH);
    await registry.verifyRecord(KEY, HASH, coach.address, deadline, sig);
    const otherKey = ethers.id("PERF-2026-0419");
    await expect(registry.verifyRecord(otherKey, HASH, coach.address, deadline, sig))
      .to.be.revertedWithCustomError(registry, "InvalidSignature");
  });

  it("never overwrites an anchored record", async () => {
    const first = await signVerify(coach, KEY, HASH);
    await registry.verifyRecord(KEY, HASH, coach.address, first.deadline, first.sig);
    const second = await signVerify(coach, KEY, TAMPERED);
    await expect(registry.verifyRecord(KEY, TAMPERED, coach.address, second.deadline, second.sig))
      .to.be.revertedWithCustomError(registry, "RecordExists");
  });

  it("keeps old proofs valid after a coach is revoked, but blocks new ones", async () => {
    const first = await signVerify(coach, KEY, HASH);
    await registry.verifyRecord(KEY, HASH, coach.address, first.deadline, first.sig);
    await expect(registry.revokeVerifier(coach.address)).to.emit(registry, "VerifierRevoked");
    expect(await registry.isRecordVerified(KEY, HASH)).to.equal(true);
    const rec = await registry.getRecord(KEY);
    expect(await registry.wasVerifierActive(coach.address, rec.timestamp)).to.equal(true);

    const next = await signVerify(coach, ethers.id("PERF-2026-0420"), HASH);
    await expect(registry.verifyRecord(ethers.id("PERF-2026-0420"), HASH, coach.address, next.deadline, next.sig))
      .to.be.revertedWithCustomError(registry, "NotActiveVerifier");
  });

  it("supersedes a record and keeps the old hash", async () => {
    const first = await signVerify(coach, KEY, HASH);
    await registry.verifyRecord(KEY, HASH, coach.address, first.deadline, first.sig);
    const newKey = ethers.id("PERF-2026-0418-v2");
    const nonce = await registry.nonces(coach.address);
    const deadline = BigInt((await time.latest()) + 3600);
    const sig = await coach.signTypedData(await domain(), SupersedeTypes, {
      oldKey: KEY, newKey, newHash: TAMPERED, verifier: coach.address, nonce, deadline,
    });
    await expect(registry.connect(relayer).supersedeRecord(KEY, newKey, TAMPERED, coach.address, deadline, sig))
      .to.emit(registry, "RecordSuperseded").withArgs(KEY, newKey, coach.address);
    const old = await registry.getRecord(KEY);
    expect(old.status).to.equal(2n);
    expect(old.recordHash).to.equal(HASH);
    expect(old.supersededBy).to.equal(newKey);
    expect(await registry.isRecordVerified(newKey, TAMPERED)).to.equal(true);
  });

  it("only lets the owner manage verifiers", async () => {
    await expect(registry.connect(stranger).registerVerifier(stranger.address))
      .to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");
    await expect(registry.registerVerifier(coach.address))
      .to.be.revertedWithCustomError(registry, "AlreadyRegistered");
  });
});
