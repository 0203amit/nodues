import { googleApiFetch, withRetry } from './googleApi';

// --- Types ---

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  parents?: string[];
  createdTime?: string;
}

// --- Constants ---

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const SHEET_MIME = 'application/vnd.google-apps.spreadsheet';
const FILE_FIELDS = 'files(id,name,mimeType,parents,createdTime)';

// --- Functions ---

/** Search for a folder by name. Returns null if not found. */
export async function findFolder(
  accessToken: string,
  folderName: string,
): Promise<DriveFile | null> {
  const q = `name='${folderName}' and mimeType='${FOLDER_MIME}' and trashed=false`;
  const url = `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=${encodeURIComponent(FILE_FIELDS)}`;

  const result = await withRetry(() =>
    googleApiFetch<{ files: DriveFile[] }>(accessToken, url),
  );

  return result.files[0] ?? null;
}

/** Create a folder at Drive root. Returns the created file metadata. */
export async function createFolder(
  accessToken: string,
  folderName: string,
): Promise<DriveFile> {
  return withRetry(() =>
    googleApiFetch<DriveFile>(accessToken, `${DRIVE_API}/files`, {
      method: 'POST',
      body: {
        name: folderName,
        mimeType: FOLDER_MIME,
      },
    }),
  );
}

/** Search for a Sheet by name inside a specific folder. */
export async function findSheetInFolder(
  accessToken: string,
  sheetName: string,
  folderId: string,
): Promise<DriveFile | null> {
  const q = `name='${sheetName}' and '${folderId}' in parents and mimeType='${SHEET_MIME}' and trashed=false`;
  const url = `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=${encodeURIComponent(FILE_FIELDS)}`;

  const result = await withRetry(() =>
    googleApiFetch<{ files: DriveFile[] }>(accessToken, url),
  );

  return result.files[0] ?? null;
}

/** Move a file into a folder (remove from root). */
export async function moveFileToFolder(
  accessToken: string,
  fileId: string,
  folderId: string,
): Promise<void> {
  const url = `${DRIVE_API}/files/${fileId}?addParents=${encodeURIComponent(folderId)}&removeParents=root`;

  await withRetry(() =>
    googleApiFetch<unknown>(accessToken, url, { method: 'PATCH' }),
  );
}
