const mongoose = require('mongoose');
const dns = require('dns');
const config = require('../config');

// Force Google DNS for reliable Atlas SRV resolution.
// Required on networks where ISP blocks MongoDB's SRV DNS records.
try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch (e) {
  console.warn('[DB] Could not override DNS servers:', e.message);
}

let isConnected = false;

function getSanitizedUri() {
  let uri = process.env.MONGODB_URI || config.MONGODB_URI || '';
  const username = process.env.DB_USERNAME || config.DB_USERNAME || '';

  if (username && uri.includes('<db_username>')) {
    uri = uri.replace('<db_username>', encodeURIComponent(username));
  }

  return uri;
}

async function connectDB() {
  const rawUri = process.env.MONGODB_URI || config.MONGODB_URI || '';
  const uri = getSanitizedUri();

  if (!uri) {
    console.log('ℹ️  MongoDB URI not configured. Database persistence is optional.');
    return false;
  }

  if (uri.includes('<db_username>')) {
    console.warn('⚠️  MongoDB URI contains placeholder "<db_username>".');
    console.warn('👉  Please update DB_USERNAME or replace <db_username> in your .env file with your MongoDB Atlas database username.');
    return false;
  }

  try {
    mongoose.set('strictQuery', false);
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
      family: 4,  // Force IPv4 — avoids IPv6 DNS issues on some ISPs
    });

    isConnected = true;
    console.log('📦 MongoDB Atlas Connected Successfully! (App: silentledger)');
    return true;
  } catch (err) {
    isConnected = false;
    console.warn(`⚠️  MongoDB Connection Warning: ${err.message}`);
    console.warn('👉  Verify that your Atlas username/password are correct and your IP is whitelisted (0.0.0.0/0) in Atlas Network Access.');
    return false;
  }
}

function isDbConnected() {
  return isConnected && mongoose.connection.readyState === 1;
}

function getDbState() {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  const state = states[mongoose.connection.readyState] || 'unknown';
  const uri = getSanitizedUri();
  const hasPlaceholder = uri.includes('<db_username>');

  return {
    status: state,
    connected: isDbConnected(),
    hasPlaceholder,
    configured: Boolean(uri && !hasPlaceholder),
    database: mongoose.connection.name || 'silentledger'
  };
}

module.exports = {
  connectDB,
  isDbConnected,
  getDbState
};
