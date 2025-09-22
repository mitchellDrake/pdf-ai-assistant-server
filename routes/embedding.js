const { MongoClient } = require('mongodb');
const { openai } = require('@ai-sdk/openai');
const { embed } = require('ai');
const client = new MongoClient(process.env.DATABASE_URL);
let db;

async function getDb() {
  if (!db) {
    await client.connect(); // safe to call multiple times
    db = client.db('test');
  }
  return db;
}

const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');

router.post('/search', authenticateToken, async (req, res) => {
  const { question, pdfId } = req.body;

  if (!question || !pdfId) {
    return res.status(400).json({ error: 'Missing question or pdfId' });
  }

  try {
    // 1️⃣ Generate embedding for the question

    const { embedding } = await embed({
      model: openai.textEmbeddingModel('text-embedding-3-small'),
      value: question,
    });

    // console.log('embedding', embedding);

    // 2️⃣ Connect to MongoDB
    const db = await getDb();
    const collection = db.collection('PDFChunk');

    const sanityCheck = await collection
      .find({ pdfId: pdfId })
      .limit(10)
      .toArray();

    const results = await collection
      .aggregate([
        {
          $vectorSearch: {
            index: 'embedding', // name of your Atlas Vector Search index
            path: 'embedding', // the field in your docs
            queryVector: embedding, // the embedding array you generated
            numCandidates: 100, // how many candidates to consider
            limit: 10, // how many results to return
            filter: { pdfId: pdfId }, // optional filter (works here!)
          },
        },
        {
          $project: {
            text: 1,
            page: 1,
            sentenceIndex: 1,
            score: { $meta: 'vectorSearchScore' },
            _id: 0,
          },
        },
      ])
      .toArray();

    // console.log('return from vector search', results);
    return res.status(200).json({ chunks: results });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
