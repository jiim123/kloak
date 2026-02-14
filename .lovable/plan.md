

## Multi-Select and Bulk Delete Emojis

### What This Adds
A toggle-able multi-select mode in both emoji management views (ServerSettingsPage and ServerSettingsModal) that lets admins select multiple emojis via checkboxes and delete them all in one click with a confirmation dialog.

### Changes

#### Both `ServerSettingsPage.tsx` and `ServerSettingsModal.tsx`

1. **New state variables:**
   - `selectedEmojiIds: Set<string>` -- tracks which emojis are selected
   - `isMultiSelectMode: boolean` -- toggles between normal and selection mode
   - `isDeletingEmojis: boolean` -- loading state during bulk delete

2. **New `bulkDeleteEmojis` function:**
   - Confirms with the user ("Delete X emojis?")
   - Iterates over selected IDs, calling `delete_server_emoji` RPC + `secureDelete` for each
   - Updates local state, invalidates cache, shows success/failure toast
   - Clears selection and exits multi-select mode when done

3. **UI changes to the emoji list header:**
   - Add a "Select" / "Cancel" toggle button next to the emoji count
   - When in multi-select mode, show "Select All / Deselect All" and a red "Delete Selected (N)" button

4. **UI changes to each emoji row:**
   - When in multi-select mode, show a checkbox on the left side of each row (using the existing Checkbox component)
   - Clicking the row toggles selection
   - Hide the individual rename/delete action buttons during multi-select mode

### Technical Details

**State additions (in each component):**
```typescript
const [selectedEmojiIds, setSelectedEmojiIds] = useState<Set<string>>(new Set());
const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
const [isDeletingEmojis, setIsDeletingEmojis] = useState(false);
```

**Bulk delete function:**
```typescript
const bulkDeleteEmojis = async () => {
  if (!server || !user || selectedEmojiIds.size === 0) return;
  if (!confirm(`Delete ${selectedEmojiIds.size} emoji${selectedEmojiIds.size > 1 ? 's' : ''}? This cannot be undone.`)) return;
  
  setIsDeletingEmojis(true);
  let success = 0, failed = 0;
  
  for (const emojiId of selectedEmojiIds) {
    try {
      const { data: filePath, error } = await supabase.rpc('delete_server_emoji', {
        _emoji_id: emojiId, _user_id: user.id
      });
      if (error) throw error;
      if (filePath) await secureDelete('server-emojis', filePath);
      success++;
    } catch { failed++; }
  }
  
  setServerEmojis(prev => prev.filter(e => !selectedEmojiIds.has(e.id)));
  invalidateServerEmojis(server.id);
  setSelectedEmojiIds(new Set());
  setIsMultiSelectMode(false);
  setIsDeletingEmojis(false);
  // Toast results
};
```

**Emoji list header (multi-select controls):**
- "Select" button toggles `isMultiSelectMode`
- When active: "Select All" / "Deselect All" button + "Delete Selected (N)" button with destructive styling
- Progress indicator during deletion

**Emoji row changes:**
- Checkbox appears on the left when `isMultiSelectMode` is true
- Row click toggles selection in multi-select mode
- Individual action buttons hidden during multi-select

### Files to Edit

| File | Change |
|------|--------|
| `src/components/settings/ServerSettingsPage.tsx` | Add multi-select state, bulk delete, checkboxes in emoji list |
| `src/components/modals/ServerSettingsModal.tsx` | Same changes for the modal emoji view |

