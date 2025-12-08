// ============================================
// FILE: backend/tests/auth.unit.test.js
// Unit tests for auth utilities
// ============================================
import { describe, it, expect, beforeAll } from '@jest/globals';
import { hashPassword, comparePassword, validatePasswordStrength } from '../src/modules/auth/password.utils.js';
import { generateAccessToken, verifyAccessToken, hashToken } from '../src/modules/auth/jwt.utils.js';

describe('Password Utilities', () => {
  describe('hashPassword', () => {
    it('should hash a valid password', async () => {
      const password = 'TestPassword123';
      const hash = await hashPassword(password);
      
      expect(hash).toBeTruthy();
      expect(hash).not.toBe(password);
      expect(hash.startsWith('$2')).toBe(true); // bcrypt prefix
    });
    
    it('should reject passwords under 8 characters', async () => {
      await expect(hashPassword('short')).rejects.toThrow('at least 8 characters');
    });
    
    it('should reject non-string passwords', async () => {
      await expect(hashPassword(null)).rejects.toThrow('must be a non-empty string');
    });
  });
  
  describe('comparePassword', () => {
    it('should return true for matching password', async () => {
      const password = 'TestPassword123';
      const hash = await hashPassword(password);
      const isValid = await comparePassword(password, hash);
      
      expect(isValid).toBe(true);
    });
    
    it('should return false for non-matching password', async () => {
      const hash = await hashPassword('correct');
      const isValid = await comparePassword('wrong', hash);
      
      expect(isValid).toBe(false);
    });
  });
  
  describe('validatePasswordStrength', () => {
    it('should validate a strong password', () => {
      const result = validatePasswordStrength('StrongPass123');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should reject weak passwords', () => {
      const result = validatePasswordStrength('weak');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});

describe('JWT Utilities', () => {
  const mockUser = {
    userId: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    role: 'user',
  };
  
  describe('generateAccessToken', () => {
    it('should generate a valid JWT', () => {
      const token = generateAccessToken(mockUser);
      
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3); // JWT format
    });
  });
  
  describe('verifyAccessToken', () => {
    it('should verify and decode a valid token', () => {
      const token = generateAccessToken(mockUser);
      const decoded = verifyAccessToken(token);
      
      expect(decoded.userId).toBe(mockUser.userId);
      expect(decoded.email).toBe(mockUser.email);
      expect(decoded.role).toBe(mockUser.role);
    });
    
    it('should reject invalid tokens', () => {
      expect(() => verifyAccessToken('invalid.token.here')).toThrow();
    });
    
    it('should reject expired tokens', () => {
      // This would require mocking time or using a very short expiry
      // Left as TODO for comprehensive test suite
    });
  });
  
  describe('hashToken', () => {
    it('should consistently hash the same token', () => {
      const token = 'test-refresh-token-abc123';
      const hash1 = hashToken(token);
      const hash2 = hashToken(token);
      
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 hex length
    });
    
    it('should produce different hashes for different tokens', () => {
      const hash1 = hashToken('token1');
      const hash2 = hashToken('token2');
      
      expect(hash1).not.toBe(hash2);
    });
  });
});
