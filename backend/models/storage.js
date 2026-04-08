const fs = require("fs/promises");
const path = require("path");

async function ensureJsonFile(filePath, fallback) {
  try {
    await fs.access(filePath);
  } catch (error) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(fallback, null, 2));
  }
}

async function readJson(filePath, fallback = []) {
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
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

module.exports = {
  ensureJsonFile,
  readJson,
  writeJson,
};
