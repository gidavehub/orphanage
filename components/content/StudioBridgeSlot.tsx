import { draftMode } from "next/headers";
import { StudioBridge } from "./StudioBridge";

/**
 * Server leaf for the site layout (PLAN D62): renders the client StudioBridge only while Draft Mode is
 * on, so normal visitors never download it. Reads `draftMode()`, so the layout wraps it in
 * `<Suspense fallback={null}>` (the bridge itself reads `useSearchParams()`, which needs that too).
 */
export async function StudioBridgeSlot() {
  const { isEnabled } = await draftMode();
  return isEnabled ? <StudioBridge /> : null;
}
