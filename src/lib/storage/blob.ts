import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { FileRecord } from '../types';

const BLOB_DIR = path.join(process.cwd(), 'data', 'blobs');

async function ensureBlobDir() {
  await fs.mkdir(BLOB_DIR, { recursive: true });
}

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export async function saveUploadedFiles(files: File[]): Promise<FileRecord[]> {
  await ensureBlobDir();

  const records: FileRecord[] = [];
  for (const file of files) {
    const blobId = randomUUID();
    const storedName = `${blobId}-${sanitizeFilename(file.name)}`;
    const filePath = path.join(BLOB_DIR, storedName);
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(filePath, buffer);

    records.push({
      name: file.name,
      url: `/api/files/${storedName}`,
      size: file.size,
      type: file.type,
    });
  }

  return records;
}

export async function readStoredBlob(storedName: string) {
  await ensureBlobDir();
  const filePath = path.join(BLOB_DIR, storedName);
  const data = await fs.readFile(filePath);
  return { filePath, data };
}

export function getStoredNameFromUrl(url: string) {
  try {
    const parsed = new URL(url, 'http://localhost');
    return parsed.pathname.split('/').pop() || '';
  } catch {
    return url.split('/').pop() || '';
  }
}
