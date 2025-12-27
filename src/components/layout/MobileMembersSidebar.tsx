import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useUIStore } from '@/stores/uiStore';
import { MembersSidebar } from './MembersSidebar';
import { useIsMobile } from '@/hooks/use-mobile';

export const MobileMembersSidebar = () => {
  const { isMemberSidebarOpen, setMemberSidebarOpen } = useUIStore();
  const isMobile = useIsMobile();

  // Return closed sheet for non-mobile - keeps hook count consistent
  return (
    <Sheet open={isMobile && isMemberSidebarOpen} onOpenChange={setMemberSidebarOpen}>
      <SheetContent side="right" className="p-0 w-60 max-w-[80vw]">
        <SheetHeader className="sr-only">
          <SheetTitle>Members</SheetTitle>
        </SheetHeader>
        <div className="h-full bg-layout-members">
          <MembersSidebar />
        </div>
      </SheetContent>
    </Sheet>
  );
};
