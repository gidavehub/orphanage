"use client";

import { useRouter } from "next/navigation";
import { openGlobalSheet } from "@/components/admin/shell/SheetHost";
import { Button } from "@/components/ui/Button";

/** Opens the app-wide "Record a gift" sheet (admin-ux §3.9 `?do=record-gift`). */
export function RecordGiftButton() {
  const router = useRouter();
  return (
    <Button variant="forest" size="sm" icon="heart" iconFirst onClick={() => openGlobalSheet(router, "record-gift")}>
      Record a gift
    </Button>
  );
}
