

## Performance Optimization: Animations, Modals, Selectors, Lazy-Loading, Cleanup

### Batch 1: Animation consolidation

**1a. Remove `reducedMotion="always"` from AppLayout**
- `src/pages/AppLayout.tsx` line 510: change `<MotionConfig reducedMotion="always">` to just `<MotionConfig>`
- This re-enables all existing framer-motion animations throughout the app

**1b. Remove `motion` package, standardize on `framer-motion`**
- `src/components/chat/TypingIndicator.tsx` line 2: change `import { motion } from "motion/react"` to `import { motion } from "framer-motion"`
- Remove `"motion": "^12.24.0"` from package.json dependencies

### Batch 2: Remove unused dependencies

Remove these from package.json (confirmed zero imports in codebase):
- `@dotlottie/react-player`
- `@privacyresearch/libsignal-protocol-typescript`
- `@tiptap/extension-horizontal-rule`, `@tiptap/extension-image`, `@tiptap/extension-link`, `@tiptap/extension-placeholder`, `@tiptap/extension-text-align`, `@tiptap/extension-underline`, `@tiptap/react`, `@tiptap/starter-kit`
- `next-themes`
- `react-jsx-runtime`
- `vite-plugin-css-injected-by-js`

Keep `tailwindcss-animate` — it is used as a plugin in `tailwind.config.ts`.

### Batch 3: Delete unused font files

Delete from `public/fonts/` (confirmed zero references):
- `GeneralSans-Bold.otf`, `GeneralSans-Italic.otf`, `GeneralSans-Light.otf`, `GeneralSans-Medium.otf`, `GeneralSans-Regular.otf`
- `NewScience-Medium.otf`, `NewScience-Regular.otf`, `NewScience-SemiBold.otf`

Keep all Monaspace Krypton fonts (used for code blocks).

### Batch 4: Lazy-load channel types in ChatArea

In `src/components/layout/ChatArea.tsx`, replace eager imports with `React.lazy()`:

```typescript
const ForumChannelArea = React.lazy(() => import("@/components/forum/ForumChannelArea").then(m => ({ default: m.ForumChannelArea })));
const MediaChannelArea = React.lazy(() => import("@/components/media/MediaChannelArea").then(m => ({ default: m.MediaChannelArea })));
const TasksChannelArea = React.lazy(() => import("@/components/tasks/TasksChannelArea").then(m => ({ default: m.TasksChannelArea })));
```

Wrap each usage in `<Suspense fallback={<ChannelLoadingSkeleton />}>` with a simple skeleton component (spinner + "Loading channel..." text).

VoiceChannelArea is imported in `VoicePersistentHost.tsx`, not ChatArea — leave it for now.

### Batch 5: Conditional-render modals in AppLayout

In `src/pages/AppLayout.tsx`, wrap safe-to-conditionally-render modals with `activeModal` checks and `React.lazy` + `Suspense`:

**Always mounted (have internal form state):**
- `ServerSettingsModal` — keep mounted, wrap in `React.lazy()` for code splitting only
- `UserSettingsModal` — keep mounted, wrap in `React.lazy()` for code splitting only

**Conditionally rendered (reset state on each open):**
```tsx
{activeModal === 'create-server' && <Suspense fallback={null}><CreateServerModal /></Suspense>}
{activeModal === 'join-server' && <Suspense fallback={null}><JoinServerModal /></Suspense>}
{activeModal === 'invite' && <Suspense fallback={null}><InviteModal /></Suspense>}
{activeModal === 'create-channel' && <Suspense fallback={null}><CreateChannelModal /></Suspense>}
{activeModal === 'edit-channel' && <Suspense fallback={null}><EditChannelModal /></Suspense>}
{activeModal === 'userProfile' && <Suspense fallback={null}><UserProfilePopup /></Suspense>}
{activeModal === 'pinned-messages' && <Suspense fallback={null}><PinnedMessagesPanel /></Suspense>}
{activeModal === 'search' && <Suspense fallback={null}><SearchModal /></Suspense>}
{activeModal === 'quickSwitcher' && <Suspense fallback={null}><QuickSwitcherModal /></Suspense>}
{activeModal === 'shortcuts' && <Suspense fallback={null}><KeyboardShortcutsModal /></Suspense>}
{activeModal === 'confirmAction' && <Suspense fallback={null}><ConfirmActionModal /></Suspense>}
{activeModal === 'changeNickname' && <Suspense fallback={null}><ChangeNicknameModal /></Suspense>}
{activeModal === 'external-link-warning' && <Suspense fallback={null}><ExternalLinkWarningModal /></Suspense>}
{activeModal === 'permission-debug' && <Suspense fallback={null}><PermissionDebugPanel /></Suspense>}
{activeModal === 'import-discord-template' && <Suspense fallback={null}><ImportDiscordTemplateModal /></Suspense>}
{activeModal === 'import-emoji-pack' && <Suspense fallback={null}><ImportEmojiPackModal /></Suspense>}
{activeModal === 'set-status' && <Suspense fallback={null}><SetStatusModal /></Suspense>}
{activeModal === 'channel-info' && <Suspense fallback={null}><ChannelInfoModal /></Suspense>}
```

Convert all modal imports to `React.lazy()` for code splitting.

### Batch 6: Convert `useMemberPermissions` to granular selectors

In `src/hooks/useMemberPermissions.ts`, replace:
```typescript
const { members, currentServer, rolePermissions, channelPermissions, roles } = useServerStore();
```
With 5 individual selectors:
```typescript
const members = useServerStore((s) => s.members);
const currentServer = useServerStore((s) => s.currentServer);
const rolePermissions = useServerStore((s) => s.rolePermissions);
const channelPermissions = useServerStore((s) => s.channelPermissions);
const roles = useServerStore((s) => s.roles);
```

No logic changes — same return value, same behavior, just granular subscriptions.

### Batch 7: Convert AppLayout store subscriptions to granular selectors

In `src/pages/AppLayout.tsx`, replace the full destructures at lines 88-101:

```typescript
// Before
const { user, isLoading } = useAuthStore();
const { isMemberSidebarOpen, isServerSettingsOpen, closeMobileSidebars, activeModal } = useUIStore();
const { currentServer, currentChannel, setCurrentChannel, setCurrentServer, fetchChannels, servers, channels } = useServerStore();
const { conversations, currentConversation, setCurrentConversation, fetchConversations } = useDMStore();
const { fetchFriends } = useFriendStore();

// After — individual selectors
const user = useAuthStore((s) => s.user);
const isLoading = useAuthStore((s) => s.isLoading);
const isMemberSidebarOpen = useUIStore((s) => s.isMemberSidebarOpen);
const isServerSettingsOpen = useUIStore((s) => s.isServerSettingsOpen);
const closeMobileSidebars = useUIStore((s) => s.closeMobileSidebars);
const activeModal = useUIStore((s) => s.activeModal);
// ... same pattern for serverStore and dmStore
```

### Summary

| Batch | Files | Risk |
|---|---|---|
| 1. Animation consolidation | AppLayout.tsx, TypingIndicator.tsx, package.json | Low |
| 2. Remove unused deps | package.json | Low |
| 3. Delete unused fonts | public/fonts/ | Low |
| 4. Lazy-load channel types | ChatArea.tsx | Low |
| 5. Conditional-render modals | AppLayout.tsx, modal imports | Medium |
| 6. Granular selectors (permissions) | useMemberPermissions.ts | Low |
| 7. Granular selectors (AppLayout) | AppLayout.tsx | Medium |

