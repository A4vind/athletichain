import Link from "next/link";
import { Icon, type IconName } from "@/components/icons";
import { Logo } from "@/components/ui";

export const metadata = {
  title: "Set up MetaMask (coaches)",
  description: "One-time wallet setup for AthletiChain coaches. Free, takes about five minutes.",
};

type Step = { t: string; d: React.ReactNode };

const LAPTOP: Step[] = [
  { t: "Install MetaMask", d: <>Open <b>metamask.io</b> in Chrome, Brave or Edge and choose <b>Download → Install MetaMask for Chrome</b>. Pin the fox icon to your toolbar so it is easy to find.</> },
  { t: "Create your wallet", d: <>Choose <b>Create a new wallet</b> and set a password. MetaMask shows 12 words, your <b>Secret Recovery Phrase</b>. Write them on paper and keep them safe. Anyone with these words controls your wallet.</> },
  { t: "Log in to AthletiChain", d: <>Open AthletiChain in the <b>same browser</b> and log in with your coach account.</> },
  { t: "Link your wallet", d: <>Go to <b>Blockchain → Link MetaMask wallet</b>. MetaMask opens: pick your account, press <b>Connect</b>, then <b>Sign</b>. AthletiChain switches MetaMask to the Sepolia test network for you.</> },
  { t: "Wait for the green tick", d: <>After about 20 seconds the page shows <b>Registered verifier ✓</b>. You only do this once.</> },
];

const PHONE: Step[] = [
  { t: "Install the MetaMask app", d: <>Get <b>MetaMask</b> from the App Store or Google Play. Check the developer is MetaMask, not a look-alike.</> },
  { t: "Create your wallet", d: <>Choose <b>Create a new wallet</b>, set a password and write down the 12-word <b>Secret Recovery Phrase</b> on paper.</> },
  { t: "Open AthletiChain inside MetaMask", d: <>Normal phone browsers (Safari, Chrome) can&apos;t use MetaMask. Open AthletiChain, go to <b>More → Blockchain → Link MetaMask wallet</b> and tap <b>Open in MetaMask app</b>. The page reopens inside MetaMask.</> },
  { t: "Log in again and link", d: <>MetaMask&apos;s browser keeps its own login, so log in once more as your coach account. Tap <b>Link MetaMask wallet</b>, then <b>Connect</b> and <b>Sign</b>.</> },
  { t: "Wait for the green tick", d: <>After about 20 seconds you see <b>Registered verifier ✓</b>. From now on, approve records from inside the MetaMask app.</> },
];

const FAQ: { q: string; a: React.ReactNode; icon: IconName }[] = [
  { icon: "wallet", q: "Do I need to buy crypto or pay fees?", a: <>No. You only <b>sign</b>, which is free. AthletiChain&apos;s relayer pays every blockchain fee for you, and everything runs on the <b>Sepolia test network</b>, where coins have no real value.</> },
  { icon: "shield", q: "What exactly am I signing?", a: <>A fingerprint (hash) of the record you approved, plus the record&apos;s ID. It proves <b>you</b> verified it. The signature cannot move money or give anyone access to your wallet.</> },
  { icon: "warning", q: "Will AthletiChain ever ask for my 12 words?", a: <><b>Never.</b> Nobody from AthletiChain will ask for your Secret Recovery Phrase or private key. Only type them into the MetaMask app itself.</> },
  { icon: "layers", q: "I use a laptop and a phone. Do I link twice?", a: <>No, one wallet is linked to your coach account. To sign on another device, add the <b>same</b> account to MetaMask there (import it with your recovery phrase). To switch to a different wallet, use <b>Blockchain → Use a different wallet</b>.</> },
  { icon: "alert", q: "It says “MetaMask isn't installed in this browser”.", a: <>On a laptop, open AthletiChain in the browser where the MetaMask extension is installed and unlock the fox icon. On a phone, tap <b>Open in MetaMask app</b>.</> },
];

function Steps({ steps }: { steps: Step[] }) {
  return (
    <ol className="help-steps">
      {steps.map((s, i) => (
        <li key={s.t}>
          <span className="help-num" aria-hidden="true">{i + 1}</span>
          <div>
            <h3>{s.t}</h3>
            <p className="text-2">{s.d}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export default function MetaMaskHelp() {
  return (
    <div style={{ background: "var(--bg)", minHeight: "100dvh" }}>
      <header className="land-nav">
        <nav aria-label="Main" className="wrap" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 64 }}>
          <Link href="/" className="brand" style={{ padding: 0 }}>
            <Logo size={28} />
            <span className="brand-name">AthletiChain</span>
          </Link>
          <Link href="/coach/blockchain" className="btn btn-ghost"><span className="hide-xs">Go to&nbsp;</span>Blockchain page</Link>
        </nav>
      </header>

      <main className="wrap help-main">
        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 680 }}>
          <span className="badge badge-anchored" style={{ alignSelf: "flex-start" }}><Icon name="wallet" size={14} />For coaches · one-time setup</span>
          <h1 className="display" style={{ fontSize: "clamp(32px, 5vw, 48px)" }}>Set up MetaMask</h1>
          <p className="text-2" style={{ fontSize: 17 }}>
            Your wallet is your digital signature. When you approve a result, you sign its fingerprint, and that signature is stored on the blockchain as proof that <b>you</b> verified it. It takes about five minutes and costs nothing.
          </p>
        </div>

        <div className="alert alert-info" role="note">
          <Icon name="check" size={18} />
          <div><b>Only coaches need this.</b> Athletes, admins and selectors use AthletiChain like any other website, with no wallet.</div>
        </div>

        <nav aria-label="Choose your device" className="help-jump">
          <a href="#laptop" className="btn btn-ghost"><Icon name="layers" size={18} />On a laptop</a>
          <a href="#phone" className="btn btn-ghost"><Icon name="qr" size={18} />On a phone</a>
        </nav>

        <section id="laptop" className="card help-section">
          <div className="card-head"><h2>On a laptop</h2><span className="muted" style={{ fontSize: 13 }}>Chrome, Brave or Edge</span></div>
          <Steps steps={LAPTOP} />
        </section>

        <section id="phone" className="card help-section">
          <div className="card-head"><h2>On a phone</h2><span className="muted" style={{ fontSize: 13 }}>iPhone or Android</span></div>
          <Steps steps={PHONE} />
        </section>

        <section className="card help-section">
          <div className="card-head"><h2>Every day after that</h2></div>
          <ol className="proof" aria-label="Approving a record">
            <li className="on"><span className="lane" /><span className="step"><Icon name="clipboard" />Open Verifications and check the proof</span></li>
            <li className="on ok"><span className="lane" /><span className="step"><Icon name="check" />Press Approve</span></li>
            <li className="on chain"><span className="lane" /><span className="step"><Icon name="wallet" />Sign in MetaMask (free)</span></li>
            <li className="on chain"><span className="lane" /><span className="step"><Icon name="hexagon" />Record is blockchain anchored</span></li>
          </ol>
        </section>

        <section className="help-section" aria-labelledby="faq-h" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <h2 id="faq-h">Questions</h2>
          {FAQ.map((f) => (
            <details key={f.q} className="card help-faq">
              <summary><span className="icon-chip accent"><Icon name={f.icon} size={18} /></span>{f.q}</summary>
              <p className="text-2">{f.a}</p>
            </details>
          ))}
        </section>

        <div className="card land-final">
          <div>
            <h2 style={{ fontSize: 24 }}>Ready to link your wallet?</h2>
            <p className="text-2" style={{ marginTop: 6 }}>Log in as a coach and open the Blockchain page.</p>
          </div>
          <Link href="/coach/blockchain" className="btn btn-primary land-cta"><Icon name="wallet" size={18} />Link my wallet</Link>
        </div>
      </main>
    </div>
  );
}
