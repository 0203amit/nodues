# Quickstart: Bill File Attachments

**Feature**: 005-bill-file-attachments | **Date**: 2026-05-28

## Prerequisites

- Phases 1-4 complete: sign-in, bootstrapping, Settings CRUD, and Bills core loop all working.
- Node.js and npm installed (same as Phase 4).
- A Google account with OAuth sign-in working in the app.

## New Dependencies

None. All existing dependencies are sufficient:
- React 19, TypeScript, Vite, Tailwind CSS, Lucide React, `@react-oauth/google`, `uuid`
- No new npm packages required.

## Setup

```bash
# From repository root
npm install          # No new deps, but ensure lock file is current
npm run dev          # Start Vite dev server
```

## Key Files to Modify

| File | Changes |
|------|---------|
| `src/types/index.ts` | Add `DriveFileMetadata`, `FileAttachment`, `AttachmentCategory`, `UploadFileStatus`, `UploadingFile` |
| `src/services/driveService.ts` | Add `uploadFile`, `getFileMetadata`, `getFileMetadataBatch`, `deleteFile`, `getFileThumbnail` |
| `src/services/billsService.ts` | Add `parseFileIds`, `serializeFileIds`, `addFileIdToBill`, `removeFileIdFromBill` |
| `src/components/bills/BillCard.tsx` | Add Paperclip indicator + "Files" action button + `onViewAttachments` prop |
| `src/pages/BillsPage.tsx` | Add `AttachmentsModal` state management, `onBillUpdated` handler, pass `folderId` |

## New Files to Create

| File | Purpose |
|------|---------|
| `src/components/bills/AttachmentsModal.tsx` | Main attachments modal: two sections (Bill Documents + Receipts), upload, list with thumbnails/icons, view, remove |

## Testing

Manual testing via acceptance scenarios (no test framework configured). Key test flows:

1. **Upload**: Open attachments modal for a bill → Add Bill Document → select a JPG → verify it appears in Drive folder with naming convention → verify `bill_file_ids` column updated.
2. **View**: Open attachments modal → image shows thumbnail preview → PDF shows file icon → tap opens in new tab.
3. **Remove**: Tap remove on a file → confirm → verify file trashed in Drive → verify ID removed from column.
4. **Paperclip indicator**: Bills with attachments show Paperclip icon with count on BillCard.
5. **Multi-file upload**: Select 3 files → each uploads sequentially with per-file status → partial failure keeps completed files.
6. **Validation**: Try uploading a 15 MB file → rejected with error message before upload.

## Context Paths

| What | Path |
|------|------|
| Feature spec | `specs/005-bill-file-attachments/spec.md` |
| Implementation plan | `specs/005-bill-file-attachments/plan.md` |
| Research decisions | `specs/005-bill-file-attachments/research.md` |
| Data model | `specs/005-bill-file-attachments/data-model.md` |
| Contracts | `specs/005-bill-file-attachments/contracts/` |
| Drive service | `src/services/driveService.ts` |
| Google API helpers | `src/services/googleApi.ts` |
| Bills service | `src/services/billsService.ts` |
| Types | `src/types/index.ts` |
| Design system | `design-system/nodues/MASTER.md` |
