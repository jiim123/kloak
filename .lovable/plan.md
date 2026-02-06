
# User Settings Modal - Profile Tab Audit and Redesign Plan

## Overview
This plan addresses the audit requirements and redesign of the Profile tab in `UserSettingsModal.tsx` to create a Discord-style editable profile preview experience.

---

## Part 1: Audit Findings

### 1.1 Display Name
**Current State**: 
- Works via `updateUser` RPC which properly syncs to database
- Uses `update_user_profile` SECURITY DEFINER RPC function
- Changes propagate globally through Supabase Realtime subscriptions
- The `useRealtimeUserUpdates` hook listens for changes and patches across stores

**Issue Found**: No input validation for emojis/symbols - currently accepts any character

**Fix Required**: Add regex validation to allow only letters, numbers, spaces, and basic punctuation

### 1.2 Bio
**Current State**:
- No character limit enforcement in UI
- Database likely has a limit but UI doesn't validate
- No character counter visible

**Issues Found**:
1. No maxLength attribute on Textarea
2. No visual character counter

**Fix Required**: 
- Add `maxLength={400}` to Textarea
- Add character counter (0/400) in bottom-right corner
- Visual feedback when approaching/at limit

### 1.3 Pronouns
**Current State**: Present at lines 798-809 with Label, Input field

**Fix Required**: Remove the entire pronouns section

### 1.4 Avatar Decoration Modal
**Current State**: Works correctly
- `AvatarDecorationModal` properly handles selection
- Calls `updateUser({ avatar_decoration: ... })` 
- Syncs via RPC and updates global state

**Audit Result**: Working as intended

### 1.5 Profile Effect Modal  
**Current State**: Works correctly
- `ProfileEffectModal` properly handles selection
- Calls `updateUser({ profile_effect: ... })`
- Effect displays in `UserProfilePopup` with animation control

**Audit Result**: Working as intended

### 1.6 Profile Theme
**Current State**: Works correctly
- Primary and accent color pickers functional
- Saves via `updateUser({ profile_theme_primary, profile_theme_accent })`
- Preview correctly shows gradient

**Audit Result**: Working as intended

---

## Part 2: Major Redesign - Editable Profile Preview

### Current UI Structure
```text
+---------------------------+-------------+
|     Editor Fields         |   Preview   |
|  (Avatar upload)          |   Card      |
|  (Banner upload)          |  (Static)   |
|  (Display name input)     |             |
|  (Bio textarea)           |             |
|  (Pronouns input)         |             |
|  (Decoration button)      |             |
|  (Effect button)          |             |
|  (Theme pickers)          |             |
|  [Save Profile]           |             |
+---------------------------+-------------+
```

### Proposed UI Structure (Discord-style)
The profile card becomes the primary interface - clicking on different areas opens inline editing or modals:

```text
+------------------------------------------+
|        EDITABLE PROFILE PREVIEW          |
|  +------------------------------------+  |
|  |  [Banner Area - Click to change]  |  |
|  |  ================================ |  |
|  |                                    |  |
|  |  ( Avatar )  <- Click for menu    |  |
|  |  [+ Deco]    <- Opens decoration  |  |
|  |                                    |  |
|  |  Display Name <- Inline edit      |  |
|  |  @username                        |  |
|  |                                    |  |
|  |  Bio text    <- Inline edit       |  |
|  |  (0/400)                          |  |
|  |                                    |  |
|  |  [Profile Effect] [Theme Colors]  |  |
|  |                                    |  |
|  |  Member Since: Jan 1, 2024        |  |
|  |  Mutual Servers: [icons]          |  |
|  +------------------------------------+  |
|                                          |
|  [Cancel]              [Save Changes]    |
+------------------------------------------+
```

---

## Part 3: Implementation Tasks

### Task 1: Display Name Validation
**File**: `src/components/modals/UserSettingsModal.tsx`

Add validation function:
```typescript
const isValidDisplayName = (name: string): boolean => {
  // Allow letters (any language), numbers, spaces, hyphens, underscores, periods
  // Disallow emojis and special symbols
  const validPattern = /^[\p{L}\p{N}\s\-_.]+$/u;
  return name === '' || validPattern.test(name);
};
```

Modify the onChange handler to validate and prevent invalid input.

### Task 2: Bio Character Limit and Counter
**File**: `src/components/modals/UserSettingsModal.tsx`

Changes to Textarea (lines 788-796):
1. Add `maxLength={400}` attribute
2. Wrap in a relative container
3. Add character counter element

```tsx
<div className="relative">
  <Textarea
    id="bio"
    value={bio}
    onChange={(e) => setBio(e.target.value)}
    placeholder="Tell us about yourself"
    rows={3}
    maxLength={400}
    className="rounded-xl resize-none pb-6"
  />
  <span className={cn(
    "absolute bottom-2 right-3 text-xs",
    bio.length >= 400 ? "text-destructive" : 
    bio.length >= 350 ? "text-amber-500" : 
    "text-muted-foreground"
  )}>
    {bio.length}/400
  </span>
</div>
```

### Task 3: Remove Pronouns
**File**: `src/components/modals/UserSettingsModal.tsx`

- Delete lines 798-809 (Pronouns section)
- Remove `pronouns` state variable (line 131)
- Remove `pronouns` from `handleSaveProfile` (line 182)

### Task 4: Create Editable Profile Preview Component
**New File**: `src/components/modals/EditableProfilePreview.tsx`

This will be a new component that renders the profile card with interactive edit zones:

Key features:
1. **Banner Zone**: Click opens file picker or shows "Change/Remove Banner" options
2. **Avatar Zone**: Click shows dropdown with "Upload Avatar", "Remove Avatar", "Add Decoration" options
3. **Display Name Zone**: Click to toggle inline editing mode
4. **Bio Zone**: Click to toggle inline editing mode with character counter
5. **Profile Customization Bar**: Buttons for Effect and Theme modals
6. **Info Section**: Member since date and mutual servers (read-only)

### Task 5: Refactor Profile Tab Content
**File**: `src/components/modals/UserSettingsModal.tsx`

Replace the current `editor` and `preview` sections with the new unified `EditableProfilePreview` component:

```tsx
const profileContent = (
  <div className="max-w-lg mx-auto">
    <EditableProfilePreview
      user={user}
      localAvatarUrl={localAvatarUrl}
      localBannerUrl={localBannerUrl}
      displayName={displayName}
      bio={bio}
      profileThemePrimary={profileThemePrimary}
      profileThemeAccent={profileThemeAccent}
      onAvatarUpload={handleAvatarUpload}
      onBannerUpload={handleBannerUpload}
      onBannerRemove={handleRemoveBanner}
      onDisplayNameChange={setDisplayName}
      onBioChange={setBio}
      onThemePrimaryChange={setProfileThemePrimary}
      onThemeAccentChange={setProfileThemeAccent}
      onOpenAvatarDecoration={() => setShowAvatarDecorationModal(true)}
      onOpenProfileEffect={() => setShowProfileEffectModal(true)}
      fileInputRef={fileInputRef}
      bannerInputRef={bannerInputRef}
      isLoading={isLoading}
      isBannerUploading={isBannerUploading}
    />
    
    <div className="mt-6 flex gap-3">
      <Button variant="outline" onClick={() => {/* Reset changes */}} className="flex-1 rounded-xl">
        Cancel
      </Button>
      <Button variant="primary" onClick={handleSaveProfile} disabled={isLoading} className="flex-1 rounded-xl">
        {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        Save Changes
      </Button>
    </div>
  </div>
);
```

### Task 6: EditableProfilePreview Component Structure
**New File**: `src/components/modals/EditableProfilePreview.tsx`

```text
Component Structure:
- Profile Card Container (with gradient/theme background)
  - Banner Section (clickable to upload/change/remove)
  - Avatar Section (with hover overlay showing edit icon)
    - Avatar with decoration
    - Small "+" button for decoration
  - Content Section
    - Display Name (inline editable text field)
    - Username (read-only @username)
    - Bio (inline editable textarea with counter)
    - Customization Row
      - Profile Effect button (sparkles icon)
      - Theme Color pickers (inline or button to expand)
    - Divider
    - Info Section
      - Member Since date
      - Mutual Servers (if in server context)
```

---

## Part 4: Files to Modify

| File | Changes |
|------|---------|
| `src/components/modals/UserSettingsModal.tsx` | Remove pronouns, add display name validation, refactor profile tab to use new component |
| `src/components/modals/EditableProfilePreview.tsx` | **NEW** - Editable profile preview component |

---

## Part 5: Technical Considerations

### Display Name Validation Regex
The pattern `/^[\p{L}\p{N}\s\-_.]+$/u` allows:
- Unicode letters (any language)
- Numbers
- Spaces
- Hyphens, underscores, periods

This blocks emojis and special symbols while supporting international names.

### Mobile Responsiveness
The editable preview will need to work on mobile:
- Full-width profile card
- Touch-friendly edit zones
- Bottom sheet for color pickers on mobile
- Sufficient tap targets (44px minimum)

### State Management
Keep all edit state local until "Save Changes" is clicked:
- `displayName`, `bio`, `localAvatarUrl`, `localBannerUrl`, `profileThemePrimary`, `profileThemeAccent` remain local state
- Only call `updateUser` and upload functions on save
- Decorations and Effects modals save immediately (existing behavior)

### Accessibility
- All interactive zones need proper ARIA labels
- Keyboard navigation for inline editing
- Focus management when toggling edit modes

---

## Summary of Changes

1. **Display Name**: Add text-only validation (no emojis/symbols)
2. **Bio**: Add 400 character limit with visual counter
3. **Pronouns**: Remove entirely
4. **Avatar Decoration**: Already working - no changes needed
5. **Profile Effect**: Already working - no changes needed  
6. **Profile Theme**: Already working - will be integrated into new preview
7. **Major UI Change**: Replace split editor/preview layout with a single editable profile card inspired by Discord's design
