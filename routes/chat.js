const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// fetch or create new chat
router.get('/:pdfId', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId; // set in verifyToken middleware
    const pdfId = req.params.pdfId;

    if (!pdfId) return res.status(400).json({ error: 'Missing pdfId' });

    let chat;
    let messages = [];

    // Fetch existing chat
    chat = await prisma.chat.findFirst({
      where: { userId: userId, pdfId: pdfId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });

    if (!chat) {
      chat = await prisma.chat.create({
        data: {
          userId,
          pdfId,
        },
      });
    } else {
      messages = chat.messages.map((msg) => ({
        id: msg.id,
        role: msg.role,
        parts: msg.parts,
        createdAt: msg.createdAt,
      }));
    }

    // Create a new chat

    res.json({
      chatId: chat.id,
      messages, // empty array if new chat
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId; // from middleware
    const { chatId, messages } = req.body;

    if (!chatId) {
      return res.status(400).json({ error: 'Missing chatId' });
    }

    // Ensure chat exists and belongs to this user
    const chat = await prisma.chat.findFirst({
      where: { id: chatId, userId },
    });

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    // Wipe existing messages for this chat
    await prisma.message.deleteMany({
      where: { chatId },
    });

    // Insert new messages
    if (messages && messages.length > 0) {
      await prisma.message.createMany({
        data: messages.map((m) => ({
          chatId,
          role: m.role,
          parts: m.parts,
          createdAt: m.createdAt ? new Date(m.createdAt) : new Date(),
        })),
      });
    }

    // Return the updated chat with messages
    const updatedChat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    res.json({
      chatId: updatedChat.id,
      messages: updatedChat.messages,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
