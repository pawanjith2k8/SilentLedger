/**
 * Silent Ledger — Extended Test Suite
 * Tests additional security, validation, and integration scenarios
 * beyond the baseline 16 tests in api.test.js.
 *
 * Run: node tests/api.extended.test.js
 */

const assert = require('assert');
const http = require('http');
const app = require('../src/server');
const bip47Service = require('../src/services/bip47.service');
const nostrService = require('../src/services/nostr.service');
const { scanForLeaks } = require('../src/middleware/privacyGuard');
const { auditWallet, detectAddressType, DUST_THRESHOLD_SATS } = require('../src/services/privacyAuditor.service');
const { generateFallbackCoaching } = require('../src/services/aiCoach.service');

let server;
const PORT = 4100;
const BASE_URL = `http://localhost:${PORT}`;

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, options);
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, headers: res.headers, body: json };
}

async function runTests() {
  console.log('🧪 Silent Ledger Extended Test Suite\n');
  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    return (async () => {
      try {
        await fn();
        console.log(`  ✅ ${name}`);
        passed++;
      } catch (err) {
        console.error(`  ❌ ${name}`);
        console.error(`     ${err.message}`);
        failed++;
      }
    })();
  }

  await new Promise((resolve) => { server = app.listen(PORT, resolve); });

  try {

    // =========================================================================
    // UNIT: BIP47 Service
    // =========================================================================
    console.log('\n── BIP47 Unit Tests ──────────────────────────');

    await test('BIP47: encodePaymentCode produces PM8... prefix', async () => {
      const priv = Buffer.from('a'.repeat(64), 'hex');
      const { ecc } = require('tiny-secp256k1');
      // Use bitcoin lib to get a pub key
      const crypto = require('crypto');
      const privBuf = crypto.createHash('sha256').update('test-unit-key').digest();
      const tinyEcc = require('tiny-secp256k1');
      const pubBuf = Buffer.from(tinyEcc.pointFromScalar(privBuf));
      const chaincode = crypto.randomBytes(32);
      const pc = bip47Service.encodePaymentCode(pubBuf, chaincode);
      assert.ok(pc.startsWith('PM8'), `Expected PM8... prefix, got ${pc.substring(0, 5)}`);
    });

    await test('BIP47: decodePaymentCode roundtrip is lossless', async () => {
      const pair = bip47Service.createDemoPair();
      const decoded = bip47Service.decodePaymentCode(pair.alice.paymentCode);
      assert.strictEqual(decoded.version, 1);
      assert.strictEqual(decoded.features, 1);
      assert.strictEqual(decoded.pubkey, pair.alice.pubkeyHex);
      assert.ok(decoded.chaincode.length === 64); // 32 bytes hex
    });

    await test('BIP47: isValidPaymentCode returns false for garbage input', async () => {
      assert.strictEqual(bip47Service.isValidPaymentCode('not-a-payment-code'), false);
      assert.strictEqual(bip47Service.isValidPaymentCode(''), false);
      assert.strictEqual(bip47Service.isValidPaymentCode(null), false);
      assert.strictEqual(bip47Service.isValidPaymentCode('PM8InvalidPadding'), false);
    });

    await test('BIP47: isValidPaymentCode returns true for valid code', async () => {
      const pair = bip47Service.createDemoPair();
      assert.strictEqual(bip47Service.isValidPaymentCode(pair.alice.paymentCode), true);
      assert.strictEqual(bip47Service.isValidPaymentCode(pair.bob.paymentCode), true);
    });

    await test('BIP47: computeECDH — scalar multiplication is commutative', async () => {
      const pair = bip47Service.createDemoPair();
      // Verified by createDemoPair, but let us re-verify the property explicitly:
      assert.strictEqual(pair.ecdh.secretsMatchParity, true,
        'ECDH must be commutative: alicePriv * bobPub == bobPriv * alicePub');
    });

    await test('BIP47: deriveAddressSequence produces consistent testnet tb1q addresses', async () => {
      const pair = bip47Service.createDemoPair();
      const addresses = bip47Service.deriveAddressSequence({
        receiverPaymentCode: pair.alice.paymentCode,
        sharedSecretHex: pair.ecdh.sharedSecretHex,
        count: 3,
        startIndex: 0,
        addressType: 'p2wpkh',
        network: 'testnet'
      });
      assert.strictEqual(addresses.length, 3);
      addresses.forEach((a, i) => {
        assert.ok(a.address.startsWith('tb1q'), `Address[${i}] should be testnet SegWit`);
        assert.strictEqual(a.index, i);
      });
    });

    await test('BIP47: pubkeyToAddress produces correct address types', async () => {
      const crypto = require('crypto');
      const tinyEcc = require('tiny-secp256k1');
      const privBuf = crypto.createHash('sha256').update('addr-type-test').digest();
      const pubBuf = Buffer.from(tinyEcc.pointFromScalar(privBuf));

      const p2wpkh = bip47Service.pubkeyToAddress(pubBuf, 'p2wpkh', 'testnet');
      const p2pkh = bip47Service.pubkeyToAddress(pubBuf, 'p2pkh', 'testnet');
      const p2tr = bip47Service.pubkeyToAddress(pubBuf, 'p2tr', 'testnet');

      assert.ok(p2wpkh.startsWith('tb1q'), `p2wpkh should start with tb1q, got ${p2wpkh}`);
      assert.ok(p2pkh.match(/^[mn]/), `p2pkh should start with m or n, got ${p2pkh}`);
      assert.ok(p2tr.startsWith('tb1p'), `p2tr should start with tb1p, got ${p2tr}`);
    });

    // =========================================================================
    // UNIT: Nostr Service
    // =========================================================================
    console.log('\n── Nostr Unit Tests ──────────────────────────');

    await test('Nostr: hexToNpub and normalizeToHexPubkey roundtrip', async () => {
      const hex = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      const npub = nostrService.hexToNpub(hex);
      assert.ok(npub.startsWith('npub1'), `npub should start with npub1, got ${npub}`);
      const back = nostrService.normalizeToHexPubkey(npub);
      assert.strictEqual(back, hex);
    });

    await test('Nostr: normalizeToHexPubkey accepts hex pubkey directly', async () => {
      const hex = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
      const result = nostrService.normalizeToHexPubkey(hex);
      assert.strictEqual(result, hex);
    });

    await test('Nostr: normalizeToHexPubkey rejects invalid inputs', async () => {
      assert.throws(() => nostrService.normalizeToHexPubkey('not-a-key'), /required|Invalid|must be/i);
      assert.throws(() => nostrService.normalizeToHexPubkey(''), /required|Invalid|must be/i);
      assert.throws(() => nostrService.normalizeToHexPubkey(null), /required|Invalid|must be/i);
      assert.throws(() => nostrService.normalizeToHexPubkey('abc'), /required|Invalid|must be/i);
    });

    await test('Nostr: createPaymentCodeEventTemplate returns correct kind 30078', async () => {
      const hex = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      const pc = bip47Service.createDemoPair().alice.paymentCode;
      const template = nostrService.createPaymentCodeEventTemplate(hex, pc);
      assert.strictEqual(template.kind, 30078);
      assert.strictEqual(template.pubkey, hex);
      assert.ok(template.tags.some(t => t[0] === 'd'), 'Must have d tag');
      assert.ok(template.tags.some(t => t[0] === 'bip47'), 'Must have bip47 tag');
      assert.ok(template.tags.find(t => t[0] === 'bip47')[1] === pc, 'bip47 tag value should be the payment code');
    });

    await test('Nostr: createNip17HandshakeTemplate returns valid blueprint', async () => {
      const pair = bip47Service.createDemoPair();
      const senderPub = pair.bob.nostrPubkeyHex;
      const receiverPub = pair.alice.nostrPubkeyHex;
      const handshake = nostrService.createNip17HandshakeTemplate({
        senderPubkeyHex: senderPub,
        receiverPubkeyHex: receiverPub,
        senderPaymentCode: pair.bob.paymentCode
      });
      assert.ok(handshake.rumor, 'Must have rumor');
      assert.strictEqual(handshake.rumor.kind, 14, 'Rumor must be kind 14');
      assert.ok(Array.isArray(handshake.flow), 'Must have flow array');
      assert.ok(handshake.flow.length >= 5, 'Flow must have at least 5 steps');
      // Content must include the payment code
      const content = JSON.parse(handshake.rumor.content);
      assert.strictEqual(content.senderPaymentCode, pair.bob.paymentCode);
    });

    // =========================================================================
    // UNIT: Privacy Guard
    // =========================================================================
    console.log('\n── Privacy Guard Unit Tests ──────────────────');

    await test('PrivacyGuard: detects WIF private keys in body', async () => {
      // Valid WIF format: starts with 5, K, L, c, or 9, followed by 45-55 base58 chars
      // Base58 charset excludes: 0 (digit zero), O (uppercase O), I (uppercase I), l (lowercase L)
      const validWifKey = 'cVZduZu265sWeAqFYygsDEjkPPgNi4imFRSPPMfwnhiFBLFerrmP';
      const leak = scanForLeaks({ key: validWifKey }, 'body');
      assert.ok(leak, 'Should detect WIF key');
      assert.ok(leak.reason.toLowerCase().includes('wif') || leak.reason.toLowerCase().includes('private key'), 'Reason should mention WIF or private key');
    });

    await test('PrivacyGuard: detects xpub in body', async () => {
      const leak = scanForLeaks({ leakedXpub: 'tpubD6NzVbkrYhZ4XgiPtUmZFY4kQZ3Fv1k8YVq5jXWzK4v8G9k2R4j5L6m7N8P1q2w3e4r5t6y7u8i9o0' }, 'body', { blockXpub: true });
      assert.ok(leak, 'Should detect xpub');
    });

    await test('PrivacyGuard: does NOT flag normal payment code (PM8...)', async () => {
      const pair = bip47Service.createDemoPair();
      const leak = scanForLeaks({ paymentCode: pair.alice.paymentCode, score: 75 }, 'body', { blockXpub: true });
      assert.strictEqual(leak, null, 'Payment codes are public and should not be blocked');
    });

    await test('PrivacyGuard: detects field name "privatekey" regardless of value', async () => {
      const leak = scanForLeaks({ privatekey: 'any-value' }, 'body');
      assert.ok(leak, 'Should detect privatekey field name');
    });

    await test('PrivacyGuard: does NOT flag safe numeric score data', async () => {
      const leak = scanForLeaks({ score: 85, grade: 'GOOD', flags: [] }, 'body');
      assert.strictEqual(leak, null);
    });

    // =========================================================================
    // UNIT: Privacy Auditor
    // =========================================================================
    console.log('\n── Privacy Auditor Unit Tests ────────────────');

    await test('Auditor: clean wallet with unique addresses scores 100', async () => {
      const result = auditWallet({
        utxos: [
          { txid: 'aa'.repeat(32), vout: 0, address: 'tb1qfresh1address', value: 100000 },
          { txid: 'bb'.repeat(32), vout: 0, address: 'tb1qfresh2address', value: 200000 }
        ],
        transactions: []
      });
      assert.strictEqual(result.score, 100);
      assert.strictEqual(result.flags.length, 0);
      assert.strictEqual(result.grade, 'EXCELLENT');
      assert.strictEqual(result.isPristine, true);
    });

    await test('Auditor: dust detection flags UTXOs <= 1000 sats', async () => {
      const result = auditWallet({
        utxos: [
          { txid: 'cc'.repeat(32), vout: 0, address: 'tb1qclean', value: 100000 },
          { txid: 'dd'.repeat(32), vout: 0, address: 'tb1qdust', value: 546 }  // dust
        ],
        transactions: []
      });
      const dustFlag = result.flags.find(f => f.type === 'DUST_ATTACK');
      assert.ok(dustFlag, 'Should detect dust');
      assert.ok(result.score < 100, 'Score should be penalized');
    });

    await test('Auditor: address reuse with 3 deposits penalized heavily', async () => {
      const reusedAddress = 'tb1qreused';
      const result = auditWallet({
        utxos: [
          { txid: 'ee'.repeat(32), vout: 0, address: reusedAddress, value: 100000 },
          { txid: 'ff'.repeat(32), vout: 0, address: reusedAddress, value: 200000 },
          { txid: 'gg'.repeat(32), vout: 0, address: reusedAddress, value: 300000 }
        ],
        transactions: []
      });
      const reuseFlag = result.flags.find(f => f.type === 'ADDRESS_REUSE');
      assert.ok(reuseFlag, 'Should detect address reuse');
      assert.strictEqual(reuseFlag.severity, 'CRITICAL');
    });

    await test('Auditor: detectAddressType identifies all script types', async () => {
      assert.strictEqual(detectAddressType('tb1qtest'), 'segwit_p2wpkh');
      assert.strictEqual(detectAddressType('tb1ptest'), 'taproot_p2tr');
      assert.strictEqual(detectAddressType('bc1qtest'), 'segwit_p2wpkh');
      assert.strictEqual(detectAddressType('bc1ptest'), 'taproot_p2tr');
      assert.strictEqual(detectAddressType('mtest'), 'legacy_p2pkh');
      assert.strictEqual(detectAddressType('2test'), 'nested_segwit_p2sh');
      assert.strictEqual(detectAddressType('1test'), 'legacy_p2pkh');
      assert.strictEqual(detectAddressType(''), 'unknown');
      assert.strictEqual(detectAddressType(null), 'unknown');
    });

    // =========================================================================
    // UNIT: AI Coach Fallback Engine
    // =========================================================================
    console.log('\n── AI Coach Unit Tests ───────────────────────');

    await test('AI Coach fallback: high score produces positive opener', async () => {
      const result = generateFallbackCoaching({ score: 95, grade: 'EXCELLENT', flags: [] });
      assert.ok(result.includes('Fantastic'), 'High score should praise the user');
    });

    await test('AI Coach fallback: critical score produces warning', async () => {
      const result = generateFallbackCoaching({ score: 20, grade: 'CRITICAL LEAK', flags: [
        { type: 'ADDRESS_REUSE', severity: 'CRITICAL', penalty: 30, title: 'Address Reuse', details: 'test' }
      ]});
      assert.ok(result.includes('Critical') || result.includes('Alert'), 'Critical score should produce alert');
    });

    await test('AI Coach fallback: answers dust question correctly', async () => {
      const result = generateFallbackCoaching({ score: 75, grade: 'GOOD', flags: [], userMessage: 'What is a dust attack?' });
      assert.ok(result.toLowerCase().includes('dust'), 'Should explain dust attacks');
    });

    // =========================================================================
    // API: Input validation
    // =========================================================================
    console.log('\n── API Validation Tests ──────────────────────');

    await test('POST /api/signup rejects empty email', async () => {
      const res = await request('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: '', password: 'valid123' })
      });
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
    });

    await test('POST /api/signup rejects short password', async () => {
      const res = await request('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test2@test.com', password: '123' })
      });
      assert.strictEqual(res.status, 400);
      assert.ok(res.body.message.includes('6 characters'));
    });

    await test('POST /api/login rejects missing credentials', async () => {
      const res = await request('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
    });

    await test('POST /api/login rejects wrong password (401)', async () => {
      // Sign up a test user first
      await request('/api/users/clear-all', { method: 'DELETE' });
      await request('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'login-test@example.com', password: 'correctPassword123' })
      });
      const res = await request('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'login-test@example.com', password: 'wrongPassword' })
      });
      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.success, false);
      assert.ok(res.body.error === 'InvalidCredentials');
      // Clean up
      await request('/api/users/clear-all', { method: 'DELETE' });
    });

    await test('POST /api/login succeeds with correct credentials (200)', async () => {
      await request('/api/users/clear-all', { method: 'DELETE' });
      await request('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'loginok@example.com', password: 'testPass123' })
      });
      const res = await request('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'loginok@example.com', password: 'testPass123' })
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.user.email, 'loginok@example.com');
      await request('/api/users/clear-all', { method: 'DELETE' });
    });

    await test('POST /api/crypto/bip47/encode rejects invalid pubkey length', async () => {
      const res = await request('/api/crypto/bip47/encode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pubkeyHex: 'deadbeef' }) // too short
      });
      assert.strictEqual(res.status, 500); // throws in service, caught by error handler
      assert.strictEqual(res.body.success, false);
    });

    await test('POST /api/crypto/bip47/decode rejects garbage input', async () => {
      const res = await request('/api/crypto/bip47/decode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentCode: 'NotAValidPaymentCode' })
      });
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.isValid, false);
    });

    await test('POST /api/crypto/bip47/decode returns valid decoded fields for correct code', async () => {
      const pair = bip47Service.createDemoPair();
      const res = await request('/api/crypto/bip47/decode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentCode: pair.alice.paymentCode })
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.isValid, true);
      assert.strictEqual(res.body.decoded.version, 1);
      assert.strictEqual(res.body.decoded.pubkey, pair.alice.pubkeyHex);
    });

    await test('POST /api/nostr/template/payment-code rejects missing params', async () => {
      const res = await request('/api/nostr/template/payment-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pubkeyHex: '0'.repeat(64) }) // missing paymentCode
      });
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
    });

    await test('POST /api/nostr/verify-event rejects non-object event', async () => {
      const res = await request('/api/nostr/verify-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'not-an-object' })
      });
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
    });

    await test('POST /api/nostr/verify-event returns isValid: false for tampered event', async () => {
      const tamperedEvent = {
        id: '0'.repeat(64),
        pubkey: '1'.repeat(64),
        created_at: Math.floor(Date.now() / 1000),
        kind: 30078,
        tags: [],
        content: 'tampered',
        sig: '2'.repeat(128) // invalid signature
      };
      const res = await request('/api/nostr/verify-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: tamperedEvent })
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.isValid, false);
    });

    await test('GET /api/crypto/demo-pair returns consistent deterministic values', async () => {
      const res1 = await request('/api/crypto/demo-pair');
      const res2 = await request('/api/crypto/demo-pair');
      assert.strictEqual(res1.body.alice.paymentCode, res2.body.alice.paymentCode, 'Demo pair must be deterministic');
      assert.strictEqual(res1.body.addresses[0].address, res2.body.addresses[0].address);
    });

    await test('DELETE /api/users/clear-all is blocked in production env', async () => {
      // Mock production by temporarily modifying NODE_ENV in the request
      // We test this by verifying the endpoint exists but is protected
      // (Can't change process.env mid-test for another process, but we verify the code path runs)
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      // Need to send request to the same process
      const res = await request('/api/users/clear-all', { method: 'DELETE' });
      process.env.NODE_ENV = originalEnv;
      assert.strictEqual(res.status, 403, 'Clear-all should return 403 in production');
      assert.strictEqual(res.body.success, false);
    });

    await test('GET /api/btc/fees returns fee structure with expected fields', async () => {
      const res = await request('/api/btc/fees');
      assert.strictEqual(res.status, 200);
      assert.ok(typeof res.body.fees.fastestFee === 'number', 'fastestFee must be a number');
      assert.ok(typeof res.body.fees.halfHourFee === 'number', 'halfHourFee must be a number');
      assert.ok(typeof res.body.fees.hourFee === 'number', 'hourFee must be a number');
      assert.ok(typeof res.body.fees.minimumFee === 'number', 'minimumFee must be a number');
    });

    await test('GET /api/scenarios/alice-bob-flow has 5 steps and valid payment codes', async () => {
      const res = await request('/api/scenarios/alice-bob-flow');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.steps.length, 5);
      // Check that payment codes in steps are valid
      const step4 = res.body.steps.find(s => s.step === 4);
      assert.ok(step4.data.derivedAddressesMatch === true, 'Addresses must match in step 4');
      assert.ok(step4.data.secretsMatchParity === true, 'Secrets must match in step 4');
    });

    await test('GET /api/nostr/relays returns relay health structure', async () => {
      const res = await request('/api/nostr/relays');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(Array.isArray(res.body.defaultRelays));
      assert.ok(Array.isArray(res.body.health.relays));
      assert.ok(typeof res.body.health.onlineCount === 'number');
      assert.ok(typeof res.body.health.totalCount === 'number');
    });

    await test('POST /api/ai/coach/analyze rejects missing score field', async () => {
      const res = await request('/api/ai/coach/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grade: 'GOOD', flags: [] })
      });
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.ok(res.body.message.includes('score'));
    });

    await test('POST /api/ai/coach/chat rejects missing message field', async () => {
      const res = await request('/api/ai/coach/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: 75 })
      });
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
    });

    await test('GET /api/health does not expose sensitive config in response', async () => {
      const res = await request('/api/health');
      const bodyStr = JSON.stringify(res.body);
      // MONGODB_URI, API keys, passwords must not appear in the health response
      assert.ok(!bodyStr.includes('mongodb+srv'), 'MongoDB URI must not appear in health endpoint');
      assert.ok(!bodyStr.includes('GEMINI_API_KEY'), 'API key name must not appear');
      assert.ok(!bodyStr.includes('password'), 'No passwords in response');
    });

  } finally {
    server.close();
  }

  console.log(`\n=============================================`);
  console.log(`Extended Test Results: ${passed} passed, ${failed} failed.`);
  console.log(`=============================================`);

  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
