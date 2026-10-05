import { describe, it, expect } from 'vitest';
import { toCsv } from './csv';

describe('toCsv', () => {
  it('writes a header row and one line per record', () => {
    const csv = toCsv([{ a: 1, b: 'x' }, { a: 2, b: 'y' }], ['a', 'b']);
    expect(csv).toBe('a,b\r\n1,x\r\n2,y\r\n');
  });

  it('quotes commas, quotes and newlines', () => {
    const csv = toCsv([{ d: 'Design, build', n: 'He said "hi"\nok' }], ['d', 'n']);
    expect(csv).toBe('d,n\r\n"Design, build","He said ""hi""\nok"\r\n');
  });

  it('writes null and undefined as empty cells', () => {
    expect(toCsv([{ a: null, b: undefined }], ['a', 'b'])).toBe('a,b\r\n,\r\n');
  });

  it('neutralises spreadsheet formulas', () => {
    expect(toCsv([{ a: '=SUM(A1)' }], ['a'])).toBe("a\r\n'=SUM(A1)\r\n");
  });
});
