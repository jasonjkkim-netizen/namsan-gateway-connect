import { describe, it, expect } from 'vitest';
import { htmlToMarkdown } from '../components/admin/RichPasteEditor';

describe('htmlToMarkdown', () => {
  it('decodes common HTML entities', () => {
    expect(htmlToMarkdown('&amp; &lt; &gt; &quot;')).toBe('& < > "');
  });

  it('decodes named entities via lookup map', () => {
    expect(htmlToMarkdown('&copy; &reg; &trade;')).toBe('© ® ™');
    expect(htmlToMarkdown('&euro; &pound; &yen;')).toBe('€ £ ¥');
    expect(htmlToMarkdown('&mdash; &ndash; &hellip;')).toBe('— – …');
    expect(htmlToMarkdown('&ldquo;hello&rdquo;')).toBe('\u201Chello\u201D');
    expect(htmlToMarkdown('&lsquo;hi&rsquo;')).toBe('\u2018hi\u2019');
  });

  it('decodes numeric entities', () => {
    expect(htmlToMarkdown('&#169; &#8364;')).toBe('© €');
  });

  it('preserves unknown entities as-is', () => {
    expect(htmlToMarkdown('&foobar;')).toBe('&foobar;');
  });

  it('converts bold and italic', () => {
    expect(htmlToMarkdown('<strong>bold</strong>')).toBe('**bold**');
    expect(htmlToMarkdown('<em>italic</em>')).toBe('*italic*');
  });

  it('converts headers', () => {
    expect(htmlToMarkdown('<h1>Title</h1>')).toBe('# Title');
    expect(htmlToMarkdown('<h2>Sub</h2>')).toBe('## Sub');
  });

  it('converts links', () => {
    expect(htmlToMarkdown('<a href="https://example.com">click</a>')).toBe('[click](https://example.com)');
  });

  it('converts unordered lists', () => {
    const html = '<ul><li>one</li><li>two</li></ul>';
    const result = htmlToMarkdown(html);
    expect(result).toContain('- one');
    expect(result).toContain('- two');
  });

  it('converts ordered lists', () => {
    const html = '<ol><li>first</li><li>second</li></ol>';
    const result = htmlToMarkdown(html);
    expect(result).toContain('1. first');
    expect(result).toContain('2. second');
  });

  it('safely decodes entities without using innerHTML (XSS safety)', () => {
    // Unknown entities are preserved as-is, not processed via innerHTML
    const result = htmlToMarkdown('&fakentity;');
    expect(result).toBe('&fakentity;');
    // Known entities decode to their character equivalent
    expect(htmlToMarkdown('&bull; &deg;')).toBe('• °');
  });
});
