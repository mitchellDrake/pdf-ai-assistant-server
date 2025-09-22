# PDF AI Assistant Server

A lightweight Node.js/Express backend that powers the PDF AI Tool.  
It handles PDF uploads, parsing, and provides APIs for AI-driven resume interactions.

---

## 🚀 Features

- REST API for handling pdf files
- Handles PDF storage, database management and vector embedding
- Environment-based configuration
- JSON response formatting
- Ready for integration with the Next.js frontend (`pdf-ai-assistant`)

---

## 📦 Installation

Clone the repo and install dependencies:

git clone <your-repo-url>
cd <your-repo-url>
npm install

---

## ⚙️ Environment Setup

copy .example.env to .env and update values:

cp .example.env .env

---

## ▶️ Running the Server

node server.js

## 🛠 Tech Stack

Node.js + Express
dotenv for environment variables
Prettier for formatting
Prisma for database management
MongoDB Atlas for database and vector storage
Supabase for PDF file management
Vercel AI SDK for OpenAI integration
