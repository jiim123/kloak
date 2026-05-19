import type { ModalType } from "@/stores/uiStore";

export interface UserProfileAnchorRect {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

type OpenModal = (modal: ModalType, data?: Record<string, unknown> | null) => void;

export const SIDE_ALIGNED_USER_PROFILE_POPOVER = {
  anchorAlign: "center",
  anchorOffset: 20,
  anchorSide: "right",
} as const;

export const LEFT_ALIGNED_USER_PROFILE_POPOVER = {
  anchorAlign: "center",
  anchorOffset: 20,
  anchorSide: "left",
} as const;

const toAnchorRect = (source: Element | DOMRect | null | undefined): UserProfileAnchorRect | undefined => {
  if (!source) return undefined;

  const rect = source instanceof Element ? source.getBoundingClientRect() : source;
  return {
    top: rect.top,
    left: rect.left,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
  };
};

export const openUserProfileModal = (
  openModal: OpenModal,
  userId: string | null | undefined,
  anchor?: Element | DOMRect | null,
  extraData?: Record<string, unknown>,
) => {
  if (!userId) return;
  if ((extraData?.user as { is_bot?: boolean } | undefined)?.is_bot) return;

  openModal("userProfile", {
    userId,
    ...extraData,
    anchorRect: toAnchorRect(anchor),
  });
};
