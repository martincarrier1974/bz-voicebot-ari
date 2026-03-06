import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";

export default async function Home() {
  const authenticated = await isAuthenticated();
  redirect(authenticated ? "/dashboard" : "/login");
}
