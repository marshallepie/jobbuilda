import { describe, it } from 'node:test';
import assert from 'node:assert';
import { calculateVAT, addVAT, removeVAT, extractVAT } from './vat';

describe('VAT Calculations', () => {
  describe('calculateVAT', () => {
    it('should calculate VAT correctly', () => {
      assert.strictEqual(calculateVAT(100), 20.00);
      assert.strictEqual(calculateVAT(50), 10.00);
      assert.strictEqual(calculateVAT(33.33), 6.67); // Half-up rounding
    });

    it('should support custom VAT rates', () => {
      assert.strictEqual(calculateVAT(100, 0.05), 5.00); // 5% VAT
    });
  });

  describe('addVAT', () => {
    it('should add VAT to net amount', () => {
      assert.strictEqual(addVAT(100), 120.00);
      assert.strictEqual(addVAT(50), 60.00);
      assert.strictEqual(addVAT(33.33), 39.99); // Half-up rounding
    });
  });

  describe('removeVAT', () => {
    it('should remove VAT from gross amount', () => {
      assert.strictEqual(removeVAT(120), 100.00);
      assert.strictEqual(removeVAT(60), 50.00);
    });
  });

  describe('extractVAT', () => {
    it('should extract VAT from gross amount', () => {
      assert.strictEqual(extractVAT(120), 20.00);
      assert.strictEqual(extractVAT(60), 10.00);
    });
  });

  describe('HMRC rounding compliance', () => {
    it('should round 0.5p up (half-up rounding)', () => {
      // £10.005 rounds to £10.01
      assert.strictEqual(calculateVAT(50.025), 10.01);
    });

    it('should round 0.4p down', () => {
      // £10.004 rounds to £10.00
      assert.strictEqual(calculateVAT(50.02), 10.00);
    });
  });
});
