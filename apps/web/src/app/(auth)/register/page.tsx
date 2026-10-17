import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { RegisterForm } from "./register-form";

export const metadata = { title: "Create account" };
export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const [sports, academies] = await Promise.all([
    db.select({ value: schema.sports.code, label: schema.sports.name }).from(schema.sports).where(eq(schema.sports.isActive, true)).orderBy(asc(schema.sports.name)),
    db.select({ value: schema.academies.id, label: schema.academies.name }).from(schema.academies).orderBy(asc(schema.academies.name)),
  ]);
  return (
    <>
      <div>
        <h1>Create your account</h1>
        <p className="text-2" style={{ marginTop: 6, fontSize: 15 }}>Athletes can start right away. Coaches can sign in straight away, but an academy admin must approve them before they can verify records.</p>
      </div>
      <RegisterForm sports={sports} academies={academies} />
      <p style={{ margin: 0, fontSize: 15 }}>
        Already have an account? <Link href="/login">Log in</Link>
      </p>
    </>
  );
}
