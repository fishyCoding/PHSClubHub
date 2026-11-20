import { describe, expect, it } from 'vitest';
import { matchesQuery, personFields } from './ui';

const maya = { name: 'Maya Chen', email: 'mchen27@phs.example.edu', grade: 11 as const };

describe('name search', () => {
  it('matches first or last name, any case', () => {
    expect(matchesQuery('maya', ...personFields(maya))).toBe(true);
    expect(matchesQuery('CHEN', ...personFields(maya))).toBe(true);
    expect(matchesQuery('che', ...personFields(maya))).toBe(true);
  });
  it('every word must match something', () => {
    expect(matchesQuery('maya grade 11', ...personFields(maya))).toBe(true);
    expect(matchesQuery('maya 12', ...personFields(maya))).toBe(false);
  });
  it('matches email and treats blank as everything', () => {
    expect(matchesQuery('mchen27', ...personFields(maya))).toBe(true);
    expect(matchesQuery('   ', ...personFields(maya))).toBe(true);
    expect(matchesQuery('priya', ...personFields(maya))).toBe(false);
  });
});
