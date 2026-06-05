import { googleApiFetch, GoogleApiRequestError, withRetry } from './googleApi';
import type { GoogleApiErrorBody } from './googleApi';
import type { DriveFileMetadata } from '../types';

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
const UPLOAD_URL =
  'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size';
const METADATA_FIELDS = 'id,name,mimeType,size,thumbnailLink,webViewLink';

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

/** Ensure a subfolder exists inside a parent folder. Creates it if missing. Returns folder ID. */
export async function ensureSubfolder(
  accessToken: string,
  parentFolderId: string,
  folderName: string,
): Promise<string> {
  const q = `name='${folderName}' and '${parentFolderId}' in parents and mimeType='${FOLDER_MIME}' and trashed=false`;
  const url = `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=${encodeURIComponent(FILE_FIELDS)}`;

  const result = await withRetry(() =>
    googleApiFetch<{ files: DriveFile[] }>(accessToken, url),
  );

  if (result.files[0]) return result.files[0].id;

  const created = await withRetry(() =>
    googleApiFetch<DriveFile>(accessToken, `${DRIVE_API}/files`, {
      method: 'POST',
      body: {
        name: folderName,
        mimeType: FOLDER_MIME,
        parents: [parentFolderId],
      },
    }),
  );

  return created.id;
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

// --- File Attachment Operations ---

/** Upload a file to Google Drive using multipart upload. Raw fetch (not googleApiFetch). */
export async function uploadFile(
  accessToken: string,
  file: File,
  folderId: string,
  fileName: string,
): Promise<DriveFileMetadata> {
  return withRetry(async () => {
    const boundary = 'nodues_upload_' + crypto.randomUUID().replace(/-/g, '');
    const metadata = JSON.stringify({ name: fileName, parents: [folderId] });

    const body = new Blob([
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
      metadata,
      `\r\n--${boundary}\r\nContent-Type: ${file.type}\r\n\r\n`,
      file,
      `\r\n--${boundary}--\r\n`,
    ]);

    const response = await fetch(UPLOAD_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    });

    if (!response.ok) {
      let errorBody: GoogleApiErrorBody;
      try {
        errorBody = await response.json();
      } catch {
        errorBody = { error: { code: response.status, message: response.statusText, status: 'UNKNOWN' } };
      }
      throw new GoogleApiRequestError(response.status, errorBody);
    }

    return (await response.json()) as DriveFileMetadata;
  });
}

/** Fetch metadata for a single Drive file. */
export async function getFileMetadata(
  accessToken: string,
  fileId: string,
): Promise<DriveFileMetadata> {
  const url = `${DRIVE_API}/files/${fileId}?fields=${encodeURIComponent(METADATA_FIELDS)}`;
  return withRetry(() => googleApiFetch<DriveFileMetadata>(accessToken, url));
}

/** Fetch metadata for multiple Drive files in parallel. Individual failures don't reject the batch. */
export async function getFileMetadataBatch(
  accessToken: string,
  fileIds: string[],
): Promise<Array<{ fileId: string; metadata?: DriveFileMetadata; error?: string }>> {
  const results = await Promise.allSettled(
    fileIds.map((fileId) => getFileMetadata(accessToken, fileId)),
  );

  return results.map((result, i) => {
    if (result.status === 'fulfilled') {
      return { fileId: fileIds[i], metadata: result.value };
    }
    return { fileId: fileIds[i], error: result.reason?.message ?? 'Failed to load file info' };
  });
}

/** Delete a file from Google Drive. Swallows 404 (already deleted). */
export async function deleteFile(
  accessToken: string,
  fileId: string,
): Promise<void> {
  try {
    await withRetry(() =>
      googleApiFetch<undefined>(accessToken, `${DRIVE_API}/files/${fileId}`, {
        method: 'DELETE',
      }),
    );
  } catch (error) {
    if (error instanceof GoogleApiRequestError && error.status === 404) {
      return;
    }
    throw error;
  }
}

/** Fetch image bytes from Drive and return an object URL. Caller must revoke. */
export async function getFileThumbnail(
  accessToken: string,
  fileId: string,
): Promise<string> {
  return withRetry(async () => {
    const url = `${DRIVE_API}/files/${fileId}?alt=media`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      let errorBody: GoogleApiErrorBody;
      try {
        errorBody = await response.json();
      } catch {
        errorBody = { error: { code: response.status, message: response.statusText, status: 'UNKNOWN' } };
      }
      throw new GoogleApiRequestError(response.status, errorBody);
    }

    const blob = await response.blob();
    return URL.createObjectURL(blob);
  });
}
