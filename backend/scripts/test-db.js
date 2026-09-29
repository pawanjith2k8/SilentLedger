#!/usr/bin/env node
/**
 * MongoDB Atlas Connection Verifier
 * Run: node scripts/test-db.js
 * Tests full connectivity + creates/reads/deletes a test document
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const mongoose = require('mongoose');

async function testDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri || uri.includes('<db_password>')) {
    console.error('❌ MONGODB_URI not set or still has <db_password> placeholder in .env');
    process.exit(1);
  }

  const cluster = uri.split('@')[1]?.split('/')[0] || 'unknown';
  console.log(`\n🔌 Connecting to Atlas cluster: ${cluster}`);
  console.log('   DNS servers: 8.8.8.8, 8.8.4.4, 1.1.1.1\n');

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
      family: 4,
      dbName: 'silentledger'
    });
    console.log('✅ Connected:', mongoose.connection.host);
    console.log('   Database:', mongoose.connection.name);
    console.log('   State:', mongoose.connection.readyState === 1 ? 'connected' : 'unknown');

    // Create a test collection + document
    const TestDoc = mongoose.model('_ConnectionTest', new mongoose.Schema({
      msg: String,
      ts: Date
    }));

    const doc = await TestDoc.create({ msg: 'SilentLedger DB integration OK', ts: new Date() });
    console.log('\n✅ Write test: document created, id:', doc._id.toString());

    const found = await TestDoc.findById(doc._id).lean();
    console.log('✅ Read test:', found.msg);

    await TestDoc.deleteOne({ _id: doc._id });
    console.log('✅ Delete test: cleaned up');

    // Check real collections exist
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('\n📋 Collections in silentledger DB:',
      collections.length === 0 ? '(none yet — will be auto-created on first use)' :
      collections.map(c => c.name).join(', ')
    );

    console.log('\n🎉 All database tests passed! MongoDB Atlas is fully integrated.\n');
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('\n❌ DB Error:', err.message);
    if (err.message.includes('bad auth')) {
      console.error('\n🔑 Fix: Reset password in Atlas → Database Access → Edit user → Edit Password → Autogenerate → Update User');
      console.error('   Then update MONGODB_URI in backend/.env with the new password.\n');
    } else if (err.message.includes('ECONNREFUSED') || err.message.includes('ENOTFOUND')) {
      console.error('\n🌐 Fix: DNS/network issue. Make sure Google DNS (8.8.8.8) is reachable.');
      console.error('   Also check Atlas → Network Access → Add IP 0.0.0.0/0 (allow all) for testing.\n');
    }
    process.exit(1);
  }
}

testDB();
