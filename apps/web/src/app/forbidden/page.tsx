import Link from "next/link";

export const metadata = { title: "Not allowed" };

export default function Forbidden() {
  return (
    <main className="wrap" style={{ minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", gap: 16 }}>
      <div className="eyebrow">403</div>
      <h1 className="display" style={{ fontSize: 56 }}>Not your area</h1>
      <p className="muted" style={{ margin: 0, maxWidth: 520 }}>Your account doesn&apos;t have access to this page. Athletes, coaches and admins each have their own section.</p>
      <div><Link href="/" className="btn btn-dark">Back to home</Link></div>
    </main>
  );
}
