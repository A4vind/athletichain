import { ethers, network } from "hardhat";
import fs from "node:fs";
import path from "node:path";

/**
 * Deploys AthletiChainRegistry and writes the address + ABI to
 * contracts/deployments/<network>.json, which the web app reads.
 * On the local network it also registers the seeded coach wallets as verifiers.
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying from ${deployer.address} on ${network.name}`);

  const registry = await ethers.deployContract("AthletiChainRegistry");
  await registry.waitForDeployment();
  const address = await registry.getAddress();
  const { chainId } = await ethers.provider.getNetwork();
  console.log(`AthletiChainRegistry deployed at ${address}`);

  const artifact = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../artifacts/contracts/AthletiChainRegistry.sol/AthletiChainRegistry.json"), "utf8"),
  );
  const outDir = path.join(__dirname, "../deployments");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, `${network.name}.json`),
    JSON.stringify({ network: network.name, chainId: Number(chainId), address, deployedAt: new Date().toISOString(), abi: artifact.abi }, null, 2),
  );

  const toRegister = (process.env.VERIFIER_ADDRESSES ?? "").split(",").map((a) => a.trim()).filter(Boolean);
  for (const addr of toRegister) {
    await (await registry.registerVerifier(addr)).wait();
    console.log(`Registered verifier ${addr}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
