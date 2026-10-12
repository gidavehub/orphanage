import { redirect } from "next/navigation";

// /admin/website opens the studio on the home page.
export default function WebsiteHome() {
  redirect("/admin/website/home");
}
