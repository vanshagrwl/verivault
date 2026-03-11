import { MongoClient, Db, Collection, type Document } from "mongodb";

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectToDatabase(): Promise<Db> {
  const MONGODB_URI = process.env.MONGODB_URI;
  const DB_NAME = process.env.DB_NAME || "verivault";

  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is not set. Create a .env file with MONGODB_URI=...");
  }
  if (db) {
    return db;
  }

  if (!client) {
    const nextClient = new MongoClient(
      MONGODB_URI,
      {
        serverSelectionTimeoutMS: 8000,
      } as any
    );
    try {
      await nextClient.connect();
      client = nextClient;
      console.log("Connected to MongoDB");
    } catch (err) {
      try {
        await nextClient.close();
      } catch {
        // ignore
      }
      throw err;
    }
  }

  db = client.db(DB_NAME);
  return db;
}

export async function getCollection<T extends Document>(name: string): Promise<Collection<T>> {
  const database = await connectToDatabase();
  return database.collection<T>(name);
}

export async function closeConnection(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
    console.log("MongoDB connection closed");
  }
}
