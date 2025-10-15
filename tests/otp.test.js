const { generateSalt, hashOtp } = require('../server');

test('hashOtp deterministic with same salt', () => {
  const salt = generateSalt();
  const a = hashOtp('123456', salt);
  const b = hashOtp('123456', salt);
  expect(a).toBe(b);
});

test('different salts produce different hashes', () => {
  const s1 = generateSalt(), s2 = generateSalt();
  expect(hashOtp('123456', s1)).not.toBe(hashOtp('123456', s2));
});
