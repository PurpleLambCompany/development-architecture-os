import { redirect } from "next/navigation";
import { getViewer, homePathFor } from "@/lib/auth/viewer";

export default async function Home() {
  redirect(homePathFor(await getViewer()));
}
