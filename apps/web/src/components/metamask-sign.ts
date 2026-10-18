"use client";

export type Eth = { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> };
export type VerifyTypedData = { domain: Record<string, unknown>; types: Record<string, unknown>; message: Record<string, string> };

/**
 * Asks MetaMask to sign a record's EIP-712 fingerprint. Switches MetaMask to the
 * contract's chain first, because MetaMask only signs for the chain the site is on.
 */
export async function signVerifyTypedData(typedData: VerifyTypedData): Promise<{ signature: string; deadline: string }> {
  const eth = await getEthereum();
  if (!eth) throw new Error(noWalletMessage());
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

/** True on phones and tablets, where normal browsers can't run the MetaMask extension. */
export const isMobile = () => /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

/** Opens the current page inside the MetaMask app's own browser, where signing works on a phone. */
export const metaMaskAppLink = () => `https://metamask.app.link/dapp/${location.host}${location.pathname}${location.search}`;

export const noWalletMessage = () =>
  isMobile()
    ? "Phone browsers can't use MetaMask. Open this page inside the MetaMask app to sign."
    : "MetaMask isn't installed in this browser. Use the browser where the MetaMask extension is installed.";

/**
 * Returns MetaMask's provider. MetaMask's phone app can inject it a moment after the page
 * loads, so wait briefly for its "ethereum#initialized" event before giving up.
 */
export async function getEthereum(waitMs = 3000): Promise<Eth | null> {
  const w = window as unknown as { ethereum?: Eth };
  if (w.ethereum) return w.ethereum;
  await new Promise<void>((resolve) => {
    const done = () => { clearTimeout(timer); resolve(); };
    const timer = setTimeout(done, waitMs);
    window.addEventListener("ethereum#initialized", done, { once: true });
  });
  return w.ethereum ?? null;
}
