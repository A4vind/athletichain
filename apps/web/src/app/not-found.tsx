import Link from "next/link";

export default function NotFound() {
  return (
    <main className="wrap" style={{ minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", gap: 16 }}>
      <div className="eyebrow">404</div>
      <h1 className="display" style={{ fontSize: 56 }}>Page not found</h1>
      <div><Link href="/" className="btn btn-dark">Back to home</Link></div>
    </main>
  );
}
