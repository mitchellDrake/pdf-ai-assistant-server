// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 4000;

app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json({ limit: '50mb' }));

// endpoint routes
const authRoutes = require('./routes/auth');
const chatRoutes = require('./routes/chat');

const pdfRoutes = require('./routes/pdf');
const embeddingsRoutes = require('./routes/embedding');

app.use('/auth', authRoutes);
app.use('/chat', chatRoutes);
app.use('/pdf', pdfRoutes);
app.use('/embeddings', embeddingsRoutes);

app.listen(PORT, () => {
  console.log(`PDF server running on http://localhost:${PORT}`);
});
