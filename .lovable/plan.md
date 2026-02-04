

# Update Image Upload Size Limits

## Overview
Change the image upload size limits across the application:
- **Message attachments**: 10MB → 1MB
- **Media channel images**: 5MB → 3MB

## Files to Modify

### 1. Message Attachment Files (1MB limit)

| File | Changes |
|------|---------|
| `src/components/layout/ChatArea.tsx` | Change `MAX_FILE_SIZE` from 10MB to 1MB, update error message |
| `src/components/modals/ImageUploadDialog.tsx` | Change `MAX_FILE_SIZE` from 10MB to 1MB, update error message and UI text |
| `src/components/chat/MessageInput.tsx` | Change `MAX_IMAGE_FILE_SIZE` from 10MB to 1MB, update error message |

### 2. Media Channel File (3MB limit)

| File | Changes |
|------|---------|
| `src/components/media/MediaChannelArea.tsx` | Change `MAX_IMAGE_SIZE` from 5MB to 3MB, update 3 error messages and UI text |

## Technical Changes

### ChatArea.tsx
```typescript
// Before
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// After
const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1MB
```
Also update error message: "File size must be less than 1MB"

### ImageUploadDialog.tsx
```typescript
// Before
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// After
const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1MB
```
Update:
- Error message: "Each file must be less than 1MB"
- UI text: "JPEG, PNG, GIF, or WebP (max 1MB each)"

### MessageInput.tsx
```typescript
// Before
const MAX_IMAGE_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// After
const MAX_IMAGE_FILE_SIZE = 1 * 1024 * 1024; // 1MB
```
Update warning: "File size must be less than 1MB"

### MediaChannelArea.tsx
```typescript
// Before
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB for images

// After
const MAX_IMAGE_SIZE = 3 * 1024 * 1024; // 3MB for images
```
Update:
- Line 172: "Image size must be less than 3MB"
- Line 351: "Image size must be less than 3MB"
- Line 499: "Images up to 3MB • Videos up to 10MB"

## Summary of Changes

| Context | Old Limit | New Limit |
|---------|-----------|-----------|
| Message image attachments | 10MB | 1MB |
| ImageUploadDialog | 10MB | 1MB |
| MessageInput paste/drop | 10MB | 1MB |
| Media channel images | 5MB | 3MB |
| Media channel videos | 10MB | No change |

