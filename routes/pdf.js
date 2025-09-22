const express = require('express');
const pdf = require('pdf-parse');
const supabase = require('../supabase/supabaseClient.js');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const router = express.Router();
const multer = require('multer');
const storage = multer.memoryStorage();
const upload = multer({ storage });
const authenticateToken = require('../middleware/auth.js');
const { storeEmbeddings } = require('../prisma/embeddings.js');

router.post('/parse', async (req, res) => {
  try {
    const file = req.file; // multer puts uploaded file here
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    const pdfData = file.buffer;
    // Array to collect text per page
    const pagesText = [];

    const options = {
      pagerender: (pageData) =>
        pageData.getTextContent().then((tc) => {
          const pageText = tc.items.map((item) => item.str).join(' ');
          pagesText.push(pageText); // collect text per page
          return pageText;
        }),
    };

    const data = await pdf(pdfData, options);

    res.json({
      numPages: data.numpages,
      pages: pagesText, // return the collected page text
    });
  } catch (err) {
    console.error('PDF parsing failed:', err);
    res.status(500).json({ error: 'Failed to parse PDF' });
  }
});

router.get('/list', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId; // set in verifyToken middleware

    const pdfs = await prisma.pDF.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }, // latest first
    });

    res.json({ pdfs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch PDFs' });
  }
});

router.get('/i/:pdfId', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId; // set in verifyToken middleware
    const pdfId = req.params.pdfId;
    const pdfs = await prisma.pDFChunk.findMany({
      where: { pdfId },
    });

    res.json({ pdfs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch PDFs' });
  }
});

router.delete('/i/:pdfId', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId; // set in verifyToken middleware
    const pdfId = req.params.pdfId;
    const pdf = await prisma.pDF.findUnique({
      where: { id: pdfId },
      include: { chunks: true, chats: { include: { messages: true } } },
    });

    const path = pdf.fileUrl.split('/pdfs/')[1];
    const supabaseResponse = await supabase.storage
      .from('pdfs') // your bucket name
      .remove([path]);

    for (const chat of pdf.chats) {
      await prisma.message.deleteMany({ where: { chatId: chat.id } });
    }

    // Delete chats
    await prisma.chat.deleteMany({ where: { pdfId } });

    // Delete PDF chunks
    await prisma.pDFChunk.deleteMany({ where: { pdfId } });

    // Finally, delete PDF record
    await prisma.pDF.delete({ where: { id: pdfId } });

    res.json({
      success: true,
      message: 'PDF and all related data deleted successfully',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch PDFs' });
  }
});

router.post(
  '/upload',
  authenticateToken,
  upload.single('file'),
  async (req, res) => {
    try {
      const userId = req.userId;
      const file = req.file; // multer puts uploaded file here
      if (!file) return res.status(400).json({ error: 'No file uploaded' });

      const pdfData = file.buffer;
      const fileName = req.file.originalname;

      // Upload to Supabase
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('pdfs')
        .upload(`${userId}/${Date.now()}_${fileName}`, pdfData, {
          contentType: 'application/pdf',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Fetch public URL
      const { data: publicData } = supabase.storage
        .from('pdfs')
        .getPublicUrl(uploadData.path || uploadData.key); // use key if path is undefined

      const fileUrl = publicData?.publicUrl;

      // Extract text per page
      const pagesText = [];
      const options = {
        pagerender: (pageData) =>
          pageData.getTextContent().then((tc) => {
            const text = tc.items.map((item) => item.str).join(' ');
            pagesText.push(text);
            return text;
          }),
      };
      const data = await pdf(pdfData, options);

      // Store PDF record in Prisma
      const pdfRecord = await prisma.pDF.create({
        data: {
          userId,
          fileName,
          fileUrl,
          numPages: data.numpages,
          pages: pagesText,
        },
      });

      const pdfId = pdfRecord.id;

      await storeEmbeddings(pdfId, pagesText);

      // create embeds

      res.json({ pdf: pdfRecord });
    } catch (err) {
      console.error('PDF upload failed:', err);
      res.status(500).json({ error: 'Failed to upload PDF' });
    }
  }
);

module.exports = router;
