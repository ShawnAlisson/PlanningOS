import { MongoClient, Db, Collection, Document } from 'mongodb';

let clientPromise: Promise<MongoClient> | null = null;
let cachedDb: Db | null = null;

function getMongoUri() {
  return process.env.MONGODB_URI || process.env.MONGO_URI || '';
}

function getMongoDbName() {
  return process.env.MONGODB_DB || 'planningos';
}

async function getClient() {
  if (!clientPromise) {
    const uri = getMongoUri();
    if (!uri) {
      throw new Error('MONGODB_URI is not configured');
    }

    const client = new MongoClient(uri);
    clientPromise = client.connect();
  }

  return clientPromise;
}

export async function getMongoDb(): Promise<Db> {
  if (cachedDb) return cachedDb;

  const client = await getClient();
  cachedDb = client.db(getMongoDbName());
  await ensureMongoIndexes(cachedDb);
  return cachedDb;
}

function getCollection<T extends Document = Document>(db: Db, name: string): Collection<T> {
  return db.collection<T>(name);
}

async function ensureMongoIndexes(db: Db) {
  await Promise.all([
    getCollection(db, 'applications').createIndex({ createdAt: -1 }),
    getCollection(db, 'applications').createIndex({ status: 1 }),
    getCollection(db, 'agentResults').createIndex({ applicationId: 1, agentType: 1 }, { unique: true }),
    getCollection(db, 'agentResults').createIndex({ applicationId: 1, createdAt: -1 }),
    getCollection(db, 'finalDecisions').createIndex({ applicationId: 1 }, { unique: true }),
    getCollection(db, 'auditLogs').createIndex({ applicationId: 1, timestamp: 1 }),
  ]);
}

export function hasMongoConfig() {
  return Boolean(getMongoUri());
}
