// Import required packages
const axios = require('axios');
const cheerio = require('cheerio');
const WebSocket = require('ws');
const mysql = require('mysql2/promise');
const express = require('express');
require('dotenv').config();

// Initialize Express and WebSocket server
const app = express();
const PORT = process.env.PORT || 3000;
const wsServer = new WebSocket.Server({ noServer: true });

// MySQL connection pool
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// Scrape Hacker News stories
const scrapeHackerNews = async () => {
  try {
    const response = await axios.get('https://news.ycombinator.com/');
    const $ = cheerio.load(response.data);

    const stories = [];
    $('.athing').each((index, element) => {
      const title = $(element).find('.storylink').text();
      const link = $(element).find('.storylink').attr('href');
      const points = parseInt(
        $(element).next().find('.score').text().replace(' points', '') || '0',
        10
      );

      stories.push({ title, link, points });
    });

    // Save to database
    for (const story of stories) {
      await db.execute(
        'INSERT IGNORE INTO stories (title, link, points) VALUES (?, ?, ?)',
        [story.title, story.link, story.points]
      );
    }

    console.log(`Scraped ${stories.length} stories.`);
  } catch (error) {
    console.error('Error scraping Hacker News:', error);
  }
};

// WebSocket connections
const clients = new Set();

wsServer.on('connection', (ws) => {
  clients.add(ws);

  ws.on('close', () => clients.delete(ws));

  ws.on('message', async () => {
    // On connection, send stories count from the last 5 minutes
    const [rows] = await db.execute(
      `SELECT COUNT(*) AS count FROM stories WHERE created_at >= NOW() - INTERVAL 5 MINUTE`
    );
    ws.send(JSON.stringify({ message: `Stories in last 5 minutes: ${rows[0].count}` }));
  });
});

// Broadcast new stories to all clients
const broadcastNewStories = async () => {
  const [rows] = await db.execute(
    'SELECT * FROM stories WHERE created_at >= NOW() - INTERVAL 1 MINUTE'
  );
  if (rows.length > 0) {
    for (const client of clients) {
      client.send(JSON.stringify(rows));
    }
  }
};

// Periodic tasks
setInterval(scrapeHackerNews, 300000); // Every 5 minutes
setInterval(broadcastNewStories, 60000); // Every 1 minute

// HTTP server setup
const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Upgrade HTTP server for WebSocket
server.on('upgrade', (request, socket, head) => {
  wsServer.handleUpgrade(request, socket, head, (ws) => {
    wsServer.emit('connection', ws, request);
  });
});

// MySQL Table Initialization Script
// CREATE TABLE stories (
//   id INT AUTO_INCREMENT PRIMARY KEY,
//   title VARCHAR(255),
//   link VARCHAR(255),
//   points INT,
//   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//   UNIQUE(title)
// );

// Ensure MySQL Integration
(async () => {
  try {
    await db.execute(`CREATE TABLE IF NOT EXISTS stories (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255),
      link VARCHAR(255),
      points INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(title)
    )`);
    console.log('MySQL table initialized successfully.');
  } catch (error) {
    console.error('Error initializing MySQL table:', error);
  }
})();
