import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeCapture, extractPasted, safeUrl} from '../credit-engine.mjs';

const names = field => field.evidence.map(item => item.name);

test('the WUSF inline credit supports a writer and host, but not an origin', () => {
  const raw = 'WUSF | By Darius Tahir - KFF Health News';
  const result = analyzeCapture({
    url: 'https://www.wusf.org/article',
    title: 'An article | WUSF',
    visibleLines: [{text: raw, where: 'Article header', line: 4}],
  });
  assert.deepEqual([result.writer.status, result.host.status, result.origin.status], ['credited', 'credited', 'unknown']);
  assert.deepEqual(names(result.writer), ['Darius Tahir']);
  assert.deepEqual(names(result.host), ['WUSF']);
  assert.deepEqual(result.writer.evidence[0], {
    name: 'Darius Tahir', evidence: raw, where: 'Article header', source: 'visible', links: [], line: 4,
  });
  assert.deepEqual(result.origin.evidence, []);
});

test('a republication sentence credits the origin; a separate byline credits the writer', () => {
  const text = 'By Avery Sample\nThis piece was republished from Example Review under a Creative Commons licence.';
  const result = extractPasted(text);
  assert.deepEqual([result.writer.status, result.host.status, result.origin.status], ['credited', 'unknown', 'credited']);
  assert.deepEqual(names(result.writer), ['Avery Sample']);
  assert.deepEqual(names(result.origin), ['Example Review']);
  assert.equal(result.origin.evidence[0].evidence, text.split('\n')[1]);
  assert.equal(result.origin.evidence[0].source, 'pasted');
});

test('illustrators, page editors, mastheads and bare author cards are not writer bylines', () => {
  assert.deepEqual(names(extractPasted('By Darius Tahir\nIllustration by Oona Zenda').writer), ['Darius Tahir']);
  const nasa = extractPasted('NASA\nDec 07, 2021\nRELEASE 21-166\nPage Editor:\nBeth Ridgeway');
  assert.deepEqual([nasa.writer.status, nasa.host.status, nasa.origin.status], ['unknown', 'unknown', 'unknown']);
  assert.equal(extractPasted('Jane Doe\nSenior reporter\nHarbor Daily').writer.status, 'unknown');
});

test('a single byline can name multiple people or an organization', () => {
  const multiple = extractPasted('By Jane Doe and Alex Kim\nPublished by: Harbor Daily');
  assert.equal(multiple.writer.status, 'credited');
  assert.deepEqual(names(multiple.writer), ['Jane Doe', 'Alex Kim']);
  assert.equal(multiple.writer.evidence[0].evidence, multiple.writer.evidence[1].evidence);
  const organization = extractPasted('By The Associated Press');
  assert.equal(organization.writer.status, 'credited');
  assert.deepEqual(names(organization.writer), ['The Associated Press']);
});

test('Reported by and Story by are writer credits in page text and paste', () => {
  const captured = analyzeCapture({
    visibleLines: [{text: 'Reported by: Maya Chen', where: 'Article byline', line: 3}],
  });
  assert.equal(captured.writer.status, 'credited');
  assert.deepEqual(names(captured.writer), ['Maya Chen']);
  assert.equal(captured.writer.evidence[0].line, 3);

  const pasted = extractPasted('Story by Jordan Ellis');
  assert.equal(pasted.writer.status, 'credited');
  assert.deepEqual(names(pasted.writer), ['Jordan Ellis']);

  const inline = extractPasted('Harbor Daily | Reported by Avery Sample');
  assert.deepEqual(names(inline.writer), ['Avery Sample']);
  assert.deepEqual(names(inline.host), ['Harbor Daily']);
});

test('different explicit writer and origin claims remain in conflict', () => {
  const result = extractPasted('By Maya Chen\nWritten by: Jordan Ellis\nOriginally published by: Civic Wire\nOriginally published by: Neighborhood Dispatch');
  assert.equal(result.writer.status, 'conflict');
  assert.deepEqual(names(result.writer), ['Maya Chen', 'Jordan Ellis']);
  assert.equal(result.origin.status, 'conflict');
  assert.deepEqual(names(result.origin), ['Civic Wire', 'Neighborhood Dispatch']);
});

test('metadata-only authors and site names are labeled metadata claims', () => {
  const result = analyzeCapture({
    url: 'https://example.org/a', title: 'A', visibleLines: [],
    metadataAuthors: [
      {name: 'Jane Doe', evidence: '"author":{"name":"Jane Doe"}', where: 'JSON-LD NewsArticle.author', claimId: 'jsonld:1:1'},
      {name: 'Alex Kim', evidence: '"author":{"name":"Alex Kim"}', where: 'JSON-LD NewsArticle.author', claimId: 'jsonld:1:1'},
    ],
    metadataSiteNames: [{name: 'Example Weekly', evidence: 'og:site_name="Example Weekly"', where: 'Open Graph site name'}],
  });
  assert.deepEqual([result.writer.status, result.host.status, result.origin.status], ['metadata', 'metadata', 'unknown']);
  assert.deepEqual(names(result.writer), ['Jane Doe', 'Alex Kim']);
  assert.equal(result.writer.evidence[0].source, 'metadata');
});

test('separate metadata author sources remain conflicting claims', () => {
  const result = analyzeCapture({
    metadataAuthors: [
      {name: 'Maya Chen', evidence: 'Maya Chen', where: 'metadata: meta[name=author]', claimId: 'meta:1'},
      {name: 'Jordan Ellis', evidence: 'Jordan Ellis', where: 'metadata: JSON-LD script 1 NewsArticle.author.name', claimId: 'jsonld:1:1'},
    ],
  });
  assert.equal(result.writer.status, 'conflict');
  assert.deepEqual(names(result.writer), ['Maya Chen', 'Jordan Ellis']);
  assert.deepEqual(result.writer.evidence.map(item => item.where), [
    'metadata: meta[name=author]', 'metadata: JSON-LD script 1 NewsArticle.author.name',
  ]);

  const legacy = analyzeCapture({metadataAuthors: [
    {name: 'Maya Chen', where: 'metadata: meta[name=author]'},
    {name: 'Jordan Ellis', where: 'metadata: JSON-LD script 1 NewsArticle.author.name'},
  ]});
  assert.equal(legacy.writer.status, 'conflict');

  const repeatedTag = analyzeCapture({metadataAuthors: [
    {name: 'Maya Chen', where: 'metadata: meta[name=author]', claimId: 'meta:1'},
    {name: 'Jordan Ellis', where: 'metadata: meta[name=author]', claimId: 'meta:2'},
  ]});
  assert.equal(repeatedTag.writer.status, 'conflict');
});

test('visible versus metadata disagreements are shown instead of resolved', () => {
  const result = analyzeCapture({
    selection: 'By Jane Doe',
    visibleLines: [{text: 'Published by: Harbor Daily', where: 'Article footer', line: 20}],
    metadataAuthors: [{name: 'Jordan Ellis', evidence: 'author=Jordan Ellis', where: 'JSON-LD'}],
    metadataSiteNames: [{name: 'Civic Wire', evidence: 'og:site_name=Civic Wire', where: 'Open Graph'}],
  });
  assert.equal(result.writer.status, 'conflict');
  assert.deepEqual(result.writer.evidence.map(item => item.source), ['selected', 'metadata']);
  assert.equal(result.host.status, 'conflict');
  assert.deepEqual(result.host.evidence.map(item => item.source), ['visible', 'metadata']);
});

test('WUSF author metadata with a newsroom suffix agrees with its explicit byline', () => {
  const result = analyzeCapture({
    visibleLines: [{text: 'WUSF | By Darius Tahir - KFF Health News', where: 'Article byline', line: 1}],
    metadataAuthors: [{
      name: 'Darius Tahir - KFF Health News',
      evidence: 'Darius Tahir - KFF Health News',
      where: 'JSON-LD NewsArticle.author.name',
    }],
  });
  assert.equal(result.writer.status, 'credited');
  assert.deepEqual(names(result.writer), ['Darius Tahir', 'Darius Tahir']);
  assert.equal(result.writer.evidence[1].evidence, 'Darius Tahir - KFF Health News');
  assert.equal(result.writer.evidence[1].source, 'metadata');
  assert.equal(result.origin.status, 'unknown');
});

test('without an independent byline, an affiliated metadata author remains literal', () => {
  const result = analyzeCapture({
    metadataAuthors: [{name: 'Darius Tahir - KFF Health News', evidence: 'Darius Tahir - KFF Health News', where: 'JSON-LD'}],
  });
  assert.equal(result.writer.status, 'metadata');
  assert.deepEqual(names(result.writer), ['Darius Tahir - KFF Health News']);
  const shortenedByline = analyzeCapture({
    visibleLines: [{text: 'By Darius Tahir', where: 'Article byline', line: 1}],
    metadataAuthors: [{name: 'Darius Tahir - KFF Health News', evidence: 'Darius Tahir - KFF Health News', where: 'JSON-LD'}],
  });
  assert.equal(shortenedByline.writer.status, 'conflict');
  assert.deepEqual(names(shortenedByline.writer), ['Darius Tahir', 'Darius Tahir - KFF Health News']);
  const disagreement = analyzeCapture({
    visibleLines: [{text: 'By Jordan Ellis', where: 'Article byline', line: 1}],
    metadataAuthors: [{name: 'Darius Tahir - KFF Health News', evidence: 'Darius Tahir - KFF Health News', where: 'JSON-LD'}],
  });
  assert.equal(disagreement.writer.status, 'conflict');
  assert.deepEqual(names(disagreement.writer), ['Jordan Ellis', 'Darius Tahir - KFF Health News']);
});

test('KFF author metadata listing its illustrator stays a visible-metadata conflict', () => {
  const result = analyzeCapture({
    visibleLines: [
      {text: 'By Darius Tahir', where: 'Article byline', line: 1},
      {text: 'Illustration by Oona Zenda', where: 'Article byline', line: 2},
    ],
    metadataAuthors: [{name: 'Darius Tahir, Oona Zenda', evidence: 'Darius Tahir, Oona Zenda', where: 'meta[name=author]'}],
  });
  assert.equal(result.writer.status, 'conflict');
  assert.deepEqual(names(result.writer), ['Darius Tahir', 'Darius Tahir', 'Oona Zenda']);
  assert.equal(result.writer.evidence[2].source, 'metadata');
  assert.equal(result.writer.evidence[2].evidence, 'Darius Tahir, Oona Zenda');
});

test('the page URL and title alone never invent a writer, host or origin', () => {
  const result = analyzeCapture({url: 'https://kffhealthnews.org/mental-health/story', title: 'Story | KFF Health News', selection: 'Article body'});
  assert.deepEqual([result.writer.status, result.host.status, result.origin.status], ['unknown', 'unknown', 'unknown']);
});

test('links are restricted to safe HTTP(S), and markup cannot become a credited name', () => {
  assert.equal(safeUrl('https://example.org/path?q=1'), 'https://example.org/path?q=1');
  assert.equal(safeUrl('javascript:alert(1)'), null);
  assert.equal(safeUrl('https://example.org\\@evil.org'), null);
  assert.equal(safeUrl('https://user:pass@example.org'), null);
  assert.equal(safeUrl('https://example.org/\nattack'), null);
  const result = extractPasted('By <img src=x onerror=alert(1)>\nPublished by: Harbor Daily (https://harbor.example/story).');
  assert.equal(result.writer.status, 'unknown');
  assert.equal(result.host.status, 'credited');
  assert.deepEqual(result.host.evidence[0].links, ['https://harbor.example/story']);
});

test('paste input must be present and bounded', () => {
  assert.throws(() => extractPasted('  '), /Paste article text/);
  assert.throws(() => extractPasted('a'.repeat(60_001)), /60,000/);
});
