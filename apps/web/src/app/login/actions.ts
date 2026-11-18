"use server";
import { redirect } from "next/navigation";
import { signInAdmin, signOutAdmin } from "@/lib/admin/session";

export async function login(form: FormData) {
  const ok = await signInAdmin(String(form.get("username") ?? ""), String(form.get("password") ?? ""));
  redirect(ok ? "/admin" : "/login?error=1");
}

export async function logout() {
  await signOutAdmin();
  redirect("/");
}
