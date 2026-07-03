import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { put } from '@vercel/blob';
import { FileRecord } from '../types';
import { getMongoDb, hasMongoConfig } from '../db/mongo';

const BLOB_DIR = path.join(process.cwd(), 'data', 'blobs');

async function ensureBlobDir() {
  try {
    await fs.mkdir(BLOB_DIR, { recursive: true });
    return true;
  } catch {
    return false;
  }
}

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

// Global in-memory cache to guarantee uploads work under serverless functions (Vercel fallback)
const inMemoryBlobs = () => {
  const g = global as any;
  if (!g._inMemoryBlobs) {
    g._inMemoryBlobs = new Map<string, Buffer>();
  }
  return g._inMemoryBlobs;
};

export async function saveUploadedFiles(
  files: File[],
  filesMetadata?: Record<string, string>
): Promise<FileRecord[]> {
  const isMongo = hasMongoConfig();
  let diskAvailable = false;

  if (!isMongo) {
    diskAvailable = await ensureBlobDir();
  }

  const records: FileRecord[] = [];

  for (const file of files) {
    const blobId = randomUUID();
    const storedName = `${blobId}-${sanitizeFilename(file.name)}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Explicitly resolve file role from metadata map, or auto-detect based on file suffix/type
    let role = filesMetadata?.[file.name];
    if (!role) {
      if (/\.dxf$/i.test(file.name)) role = 'drawing';
      else if (/before|survey|exist/i.test(file.name)) role = 'existing';
      else if (/after|proposed|design/i.test(file.name)) role = 'proposed';
      else role = 'other';
    }

    if (process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        const blobResult = await put(storedName, buffer, {
          access: 'public',
          contentType: file.type,
        });

        records.push({
          name: file.name,
          url: blobResult.url,
          size: file.size,
          type: file.type,
          role,
        });
        continue;
      } catch (err) {
        console.error('Failed to save blob to Vercel Blob, falling back:', err);
      }
    }

    if (isMongo) {
      try {
        const db = await getMongoDb();
        const collection = db.collection('blobs');
        const base64Data = buffer.toString('base64');
        
        await collection.updateOne(
          { _id: storedName },
          { 
            $set: { 
              name: file.name, 
              data: base64Data, 
              type: file.type, 
              size: file.size,
              role,
              updatedAt: new Date().toISOString()
            } 
          },
          { upsert: true }
        );
      } catch (err) {
        console.error('Failed to save blob to MongoDB, falling back to Memory:', err);
        inMemoryBlobs().set(storedName, buffer);
      }
    } else if (diskAvailable) {
      try {
        const filePath = path.join(BLOB_DIR, storedName);
        await fs.writeFile(filePath, buffer);
      } catch (err) {
        console.warn('Writing to local disk failed, caching in memory:', err);
        inMemoryBlobs().set(storedName, buffer);
      }
    } else {
      inMemoryBlobs().set(storedName, buffer);
    }

    records.push({
      name: file.name,
      url: `/api/files/${storedName}`,
      size: file.size,
      type: file.type,
      role,
    });
  }

  return records;
}

export async function readStoredBlob(storedName: string): Promise<{ filePath: string; data: Buffer }> {
  // 1. Try to read from MongoDB if configured
  if (hasMongoConfig()) {
    try {
      const db = await getMongoDb();
      const collection = db.collection('blobs');
      const doc = await collection.findOne({ _id: storedName });
      if (doc && doc.data) {
        const buffer = Buffer.from(doc.data, 'base64');
        return { filePath: '', data: buffer };
      }
    } catch (err) {
      console.error('Error reading blob from MongoDB:', err);
    }
  }

  // 2. Try to read from global in-memory Cache (Vercel Serverless/Fallback)
  const cached = inMemoryBlobs().get(storedName);
  if (cached) {
    return { filePath: '', data: cached };
  }

  // 3. Fallback to Local Disk
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
