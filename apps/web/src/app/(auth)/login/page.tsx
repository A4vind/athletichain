import Link from "next/link";
import { LoginForm, type DemoAccount } from "./login-form";

export const metadata = { title: "Log in" };

const DEMO: DemoAccount[] = [
  { role: "Athlete", email: "rahul@athletichain.dev", note: "Rahul, 100m sprinter" },
  { role: "Coach", email: "anjali@athletichain.dev", note: "Anjali, verifies records" },
  { role: "Admin", email: "admin@athletichain.dev", note: "Academy admin" },
  { role: "New coach", email: "kabir@athletichain.dev", note: "Kabir, awaiting approval" },
];

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; reset?: string }> }) {
  const { next, reset } = await searchParams;
  return (
    <>
      <div>
        <h1>Log in</h1>
        <p className="text-2" style={{ marginTop: 6, fontSize: 15 }}>One sign-in for athletes, coaches and academy admins. You go straight to your own dashboard.</p>
      </div>
      <LoginForm
        next={next}
        notice={reset ? "Password updated. Log in with your new password." : next ? "Log in to continue to that page." : undefined}
        demo={process.env.NODE_ENV !== "production" || process.env.DEMO_TOOLS === "1" ? DEMO : undefined}
      />
      <p style={{ fontSize: 15, textAlign: "center" }}>
        New to AthletiChain? <Link href="/register">Create an account</Link>
      </p>
    </>
  );
}
