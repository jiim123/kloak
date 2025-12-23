import { cn } from '@/lib/utils';

interface Member {
  id: string;
  username: string;
  displayName?: string;
  bannerColor: string;
  status: 'online' | 'idle' | 'dnd' | 'offline';
  customStatus?: string;
  role?: 'owner' | 'admin' | 'moderator' | 'member';
}

export const MembersSidebar = () => {
  // Placeholder members
  const members: Member[] = [
    { 
      id: '1', 
      username: 'alice', 
      displayName: 'Alice',
      bannerColor: '#5865F2', 
      status: 'online',
      role: 'owner',
    },
    { 
      id: '2', 
      username: 'bob', 
      bannerColor: '#57F287', 
      status: 'online',
      customStatus: 'Gaming 🎮',
      role: 'admin',
    },
    { 
      id: '3', 
      username: 'charlie', 
      bannerColor: '#FEE75C', 
      status: 'idle',
    },
    { 
      id: '4', 
      username: 'diana', 
      bannerColor: '#ED4245', 
      status: 'dnd',
      customStatus: 'Do not disturb',
    },
    { 
      id: '5', 
      username: 'eve', 
      bannerColor: '#EB459E', 
      status: 'offline',
    },
  ];

  const onlineMembers = members.filter(m => m.status !== 'offline');
  const offlineMembers = members.filter(m => m.status === 'offline');

  const getStatusClass = (status: Member['status']) => {
    switch (status) {
      case 'online': return 'status-online';
      case 'idle': return 'status-idle';
      case 'dnd': return 'status-dnd';
      default: return 'status-offline';
    }
  };

  const getRoleBadge = (role?: Member['role']) => {
    if (!role || role === 'member') return null;
    
    const colors = {
      owner: 'text-yellow-500',
      admin: 'text-red-400',
      moderator: 'text-blue-400',
    };

    return (
      <span className={cn('text-xs ml-1', colors[role])}>
        • {role.charAt(0).toUpperCase() + role.slice(1)}
      </span>
    );
  };

  const MemberItem = ({ member }: { member: Member }) => (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-secondary/50 cursor-pointer transition-smooth">
      {/* Avatar with status */}
      <div className="relative">
        <div 
          className={cn(
            'w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium',
            member.status === 'offline' && 'opacity-50'
          )}
          style={{ backgroundColor: member.bannerColor }}
        >
          {member.username[0].toUpperCase()}
        </div>
        <div 
          className={cn(
            'absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-layout-members',
            getStatusClass(member.status)
          )}
        />
      </div>

      {/* Name and status */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center">
          <span className={cn(
            'text-sm truncate',
            member.status === 'offline' ? 'text-muted-foreground' : 'text-foreground'
          )}>
            {member.displayName || member.username}
          </span>
          {getRoleBadge(member.role)}
        </div>
        {member.customStatus && (
          <p className="text-xs text-muted-foreground truncate">
            {member.customStatus}
          </p>
        )}
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col border-l border-border w-60">
      <div className="flex-1 overflow-y-auto p-2">
        {/* Online section */}
        {onlineMembers.length > 0 && (
          <div className="mb-4">
            <h3 className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Online — {onlineMembers.length}
            </h3>
            {onlineMembers.map((member) => (
              <MemberItem key={member.id} member={member} />
            ))}
          </div>
        )}

        {/* Offline section */}
        {offlineMembers.length > 0 && (
          <div>
            <h3 className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Offline — {offlineMembers.length}
            </h3>
            {offlineMembers.map((member) => (
              <MemberItem key={member.id} member={member} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};