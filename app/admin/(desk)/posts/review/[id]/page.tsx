import { redirect } from "next/navigation";

// /admin/posts/review/<id> (admin-ux §6.12, the link in "The October draft is ready to review"): the
// review happens in the post's own page, where the checklist and the helper's sources sit beside it.
export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/admin/posts/${encodeURIComponent(decodeURIComponent(id))}`);
}
