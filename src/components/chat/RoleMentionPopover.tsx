import { Check, CircleNotch, PencilSimple, Plus } from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import { createPortal } from "react-dom";


interface RoleMentionPopoverProps {
 roleId: string;
 roleName: string;
 roleColor?: string;
 memberCount: number;
 isSelfAssignable: boolean;
 hasRole: boolean;
 canManageRoles: boolean;
 isUpdating: boolean;
 anchorRect: DOMRect;
 onClose: () => void;
 onToggleSelfRole: (roleId: string) => void;
 onEditRole: () => void;
}

const roleTextStyle = (color?: string): CSSProperties => {
 if (!color) return {};
 if (color.startsWith("linear-gradient")) {
 return {
 background: color,
 WebkitBackgroundClip: "text",
 backgroundClip: "text",
 color: "transparent",
 };
 }
 return { color };
};

export function RoleMentionPopover({
 roleId,
 roleName,
 roleColor,
 memberCount,
 isSelfAssignable,
 hasRole,
 canManageRoles,
 isUpdating,
 anchorRect,
 onClose,
 onToggleSelfRole,
 onEditRole,
}: RoleMentionPopoverProps) {
 const popoverRef = useRef<HTMLDivElement>(null);

 useEffect(() => {
 const handler = (e: MouseEvent) => {
 if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) onClose();
 };
 document.addEventListener("mousedown", handler);
 return () => document.removeEventListener("mousedown", handler);
 }, [onClose]);

 useEffect(() => {
 const handler = (e: KeyboardEvent) => {
 if (e.key === "Escape") onClose();
 };
 document.addEventListener("keydown", handler);
 return () => document.removeEventListener("keydown", handler);
 }, [onClose]);

 const left = useMemo(
 () => Math.max(8, Math.min(anchorRect.left + anchorRect.width / 2 - 130, window.innerWidth - 268)),
 [anchorRect.left, anchorRect.width],
 );
 const top = useMemo(() => anchorRect.bottom + 8, [anchorRect.bottom]);
 const showAbove = top + 210 > window.innerHeight;
 const finalTop = showAbove ? anchorRect.top - 8 : top;

 return createPortal(
 <div
 ref={popoverRef}
 className="fixed z-[220] w-[260px] overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-xl"
 style={{
 top: showAbove ? undefined : `${finalTop}px`,
 bottom: showAbove ? `${window.innerHeight - finalTop}px` : undefined,
 left: `${left}px`,
 }}
 >
 <div className="border-b border-border px-3 py-2">
 <div className="truncate text-base font-semibold" style={roleTextStyle(roleColor)}>
 @{roleName}
 </div>
 <div className="mt-0.5 text-xs text-muted-foreground">
 {memberCount} {memberCount === 1 ? "member" : "members"}
 </div>
 </div>

 <div className="p-1.5">
 <button
 type="button"
 className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
 onClick={() => onToggleSelfRole(roleId)}
 disabled={!isSelfAssignable || isUpdating}
 title={!isSelfAssignable ? "This role is not self-assignable" : undefined}
 >
 <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center">
 {isUpdating ? (
 <CircleNotch className="h-4 w-4 animate-spin text-muted-foreground" />
 ) : hasRole ? (
 <Check className="h-4 w-4" />
 ) : (
 <Plus className="h-4 w-4" />
 )}
 </span>
 <span>{hasRole ? "Remove role from me" : "Add me to role"}</span>
 </button>

 {canManageRoles && (
 <button
 type="button"
 className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-secondary hover:text-foreground"
 onClick={onEditRole}
 >
 <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center">
 <PencilSimple className="h-4 w-4" />
 </span>
 <span>Edit role</span>
 </button>
 )}
 </div>
 </div>,
 document.body,
 );
}
