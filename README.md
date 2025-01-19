# Hacker News Scraper

This project periodically scrapes Hacker News stories, stores them in a MySQL database, and broadcasts real-time updates via WebSocket.

## Features
- Periodic scraping of stories from [Hacker News](https://news.ycombinator.com/).
- MySQL integration for persistent data storage.
- WebSocket server for real-time story updates.
- Initial story count sent to clients on connection.

## Prerequisites
- Node.js (v14+)
- MySQL database

## Setup Instructions

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/hackernews-scraper.git
   cd hackernews-scraper
