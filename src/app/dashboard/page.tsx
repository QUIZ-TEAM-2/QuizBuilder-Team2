import { redirect } from "next/navigation";

/** `/dashboard` only redirects; the creator dashboard UI lives at `/dashboard/quizzes`. */
export default function UserDashboardIndexPage() {
  redirect("/dashboard/quizzes");
}
