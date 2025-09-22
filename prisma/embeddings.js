const { PrismaClient } = require('@prisma/client');
const { embedMany } = require('ai');
const { openai } = require('@ai-sdk/openai');
const { split } = require('sentence-splitter');

const prisma = new PrismaClient();

// Store embeddings
async function storeEmbeddings(pdfId, pagesText) {
  try {
    for (let pageIndex = 0; pageIndex < pagesText.length; pageIndex++) {
      const pageText = pagesText[pageIndex];

      const sentences = split(pageText)
        .filter((node) => node.type === 'Sentence')
        .map((node) => node.raw);

      const { embeddings } = await embedMany({
        model: openai.textEmbeddingModel('text-embedding-3-small'),
        values: sentences,
      });

      // Store embeddings in Prisma
      const chunksData = sentences.map((sentence, idx) => ({
        pdfId,
        page: pageIndex + 1, // pages are 1-indexed
        sentenceIndex: idx + 1,
        text: sentence,
        embedding: embeddings[idx],
      }));

      if (chunksData.length > 0) {
        await prisma.pDFChunk.createMany({
          data: chunksData,
        });
      }
    }
    return true;
  } catch (error) {
    console.log('error in storeEmbeddings', error);
    return false;
  }
}

module.exports = { storeEmbeddings };
