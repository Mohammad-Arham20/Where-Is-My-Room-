const fs = require("fs/promises");
const path = require("path");
const { MongoClient, ServerApiVersion } = require("mongodb");

const MONGODB_URI = process.env.MONGODB_URI || "";
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || "where_is_my_room";

let mongoDbPromise = null;

function isMongoEnabled() {
  return Boolean(MONGODB_URI);
}

function collectionNameFromFile(filePath) {
  return path.basename(filePath, path.extname(filePath));
}

async function getMongoDb() {
  if (!isMongoEnabled()) {
    return null;
  }

  if (!mongoDbPromise) {
    mongoDbPromise = (async () => {
      const client = new MongoClient(MONGODB_URI, {
        serverApi: {
          version: ServerApiVersion.v1,
          strict: true,
          deprecationErrors: true,
        },
      });

      await client.connect();
      return client.db(MONGODB_DB_NAME);
    })();
  }

  return mongoDbPromise;
}

async function ensureJsonFile(filePath, fallback) {
  if (isMongoEnabled()) {
    return;
  }

  try {
    await fs.access(filePath);
  } catch (error) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(fallback, null, 2));
  }
}

async function readJson(filePath, fallback = []) {
  if (isMongoEnabled()) {
    const db = await getMongoDb();
    const collection = db.collection(collectionNameFromFile(filePath));
    const docs = await collection.find({}).toArray();

    if (!docs.length) {
      return Array.isArray(fallback) ? [] : fallback;
    }

    if (Array.isArray(fallback)) {
      return docs.map(({ _id, ...rest }) => rest);
    }

    const { _id, ...single } = docs[0];
    return single;
  }

  await ensureJsonFile(filePath, fallback);
  const content = await fs.readFile(filePath, "utf-8");

  try {
    return JSON.parse(content);
  } catch (error) {
    await fs.writeFile(filePath, JSON.stringify(fallback, null, 2));
    return fallback;
  }
}

async function writeJson(filePath, data) {
  if (isMongoEnabled()) {
    const db = await getMongoDb();
    const collection = db.collection(collectionNameFromFile(filePath));

    await collection.deleteMany({});

    if (Array.isArray(data)) {
      if (data.length > 0) {
        await collection.insertMany(data.map((item) => ({ ...item })));
      }
      return;
    }

    await collection.insertOne({ ...data });
    return;
  }

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

module.exports = {
  ensureJsonFile,
  readJson,
  writeJson,
};
