"use client";

type Eth = { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> };
export type VerifyTypedData = { domain: Record<string, unknown>; types: Record<string, unknown>; message: Record<string, string> };

/**
 * Asks MetaMask to sign a record's EIP-712 fingerprint. Switches MetaMask to the
 * contract's chain first, because MetaMask only signs for the chain the site is on.
 */
export async function signVerifyTypedData(typedData: VerifyTypedData): Promise<{ signature: string; deadline: string }> {
  const eth = (window as unknown as { ethereum?: Eth }).ethereum;
  if (!eth) throw new Error("MetaMask isn't installed in this browser.");
  const [from] = (await eth.request({ method: "eth_requestAccounts" })) as string[];
  const { domain, types, message } = typedData;
  await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: `0x${Number(domain.chainId).toString(16)}` }] });
  const payload = JSON.stringify({
    domain,
    types: { EIP712Domain: [{ name: "name", type: "string" }, { name: "version", type: "string" }, { name: "chainId", type: "uint256" }, { name: "verifyingContract", type: "address" }], ...types },
    primaryType: "VerifyRecord",
    message,
  });
  const signature = (await eth.request({ method: "eth_signTypedData_v4", params: [from, payload] })) as string;
  return { signature, deadline: message.deadline };
}
