// ByWhom's credit engine is deliberately local and literal. A URL or page title
// supplies context to the UI, but neither is evidence of a publication credit.

const MAX_PASTE_LENGTH = 60_000;
const MAX_LINE_LENGTH = 500;
const MAX_NAME_LENGTH = 120;
const FIELDS = ['writer', 'host', 'origin'];
const NEWSROOM_ENDING = '(?:News|Press|Times|Post|Wire|Daily|Network|Media|Service|Agency|Tribune|Journal|Chronicle|Gazette|Herald)';

export function safeUrl(value) {
  if (typeof value !== 'string') return null;
  const candidate = value.trim();
  if (!/^https?:\/\//i.test(candidate) || candidate.length > 2048 || /[\s\\<>"'\u0000-\u001f\u007f]/.test(candidate)) return null;
  try {
    const url = new URL(candidate);
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

function linksIn(value) {
  const links = [];
  for (const match of value.matchAll(/https?:\/\/[^\s<>"']+/gi)) {
    const candidate = match[0].replace(/[),.;!?]+$/, '');
    const url = safeUrl(candidate);
    if (url && !links.includes(url)) links.push(url);
  }
  return links;
}

function cleanName(value) {
  if (typeof value !== 'string') return null;
  const name = value
    .replace(/\s*\(?https?:\/\/[^\s<>"']+\)?/gi, '')
    .replace(/^[\s:–—-]+|[\s,.;:–—-]+$/g, '')
    .trim();
  if (!name || name.length > MAX_NAME_LENGTH || name.split(/\s+/).length > 16) return null;
  if (/[<>\r\n\u0000-\u001f\u007f]|\b(?:javascript|data|vbscript):/i.test(name)) return null;
  if (!/[\p{L}\p{N}]/u.test(name)) return null;
  return name;
}

function writerNames(value) {
  let byline = value.trim();
  // A separated newsroom affiliation identifies neither a second author nor an origin.
  byline = byline.replace(/\s+[-–—]\s+[^\n<>]+$/, '');
  byline = byline.replace(new RegExp(`,\\s*[^,\\n<>]{1,80}\\b${NEWSROOM_ENDING}$`, 'i'), '');
  byline = byline.replace(new RegExp(`\\s+(?:of|for)\\s+[^\\n<>]{1,80}\\b${NEWSROOM_ENDING}$`, 'i'), '');
  byline = byline.replace(/,\s*(?:(?:senior|staff|contributing|freelance|associate)\s+)?(?:reporter|journalist|writer)\b.*$/i, '');
  return splitWriterList(byline);
}

function splitWriterList(value) {
  const parts = value.split(/\s*(?:,\s*(?:and\s+)?|\s+and\s+|\s+&\s+|\s*;\s*)/i);
  const names = parts.map(cleanName);
  return names.every(Boolean) ? names : [];
}

function metadataWriterNames(value, explicitClaims) {
  if (typeof value !== 'string') return [];
  // The page may place a newsroom affiliation inside an author.name string.
  // Only interpret it as an affiliation when an explicit byline carries the
  // same complete wording and independently names the person. Otherwise keep
  // the full metadata claim visible as a possible disagreement.
  const affiliation = value.match(new RegExp(`^(.+?)\\s+[-–—,]\\s+([^,\\n<>]{1,80}\\b${NEWSROOM_ENDING})$`, 'i'));
  if (affiliation) {
    const person = cleanName(affiliation[1]);
    const rawClaim = value.toLocaleLowerCase().replace(/\s+/g, ' ').trim();
    const corroborated = explicitClaims.some(claim => claim.source !== 'metadata'
      && claim.names.some(name => name.toLocaleLowerCase() === person?.toLocaleLowerCase())
      && claim.evidence.some(item => item.evidence.toLocaleLowerCase().replace(/\s+/g, ' ').trim().endsWith(rawClaim)));
    if (person && corroborated) return [person];
  }
  return splitWriterList(value);
}

function makeRecord(name, raw, location, source) {
  const record = {
    name,
    evidence: raw,
    where: location.where,
    source,
    links: linksIn(raw),
  };
  if (Number.isSafeInteger(location.line) && location.line > 0) record.line = location.line;
  return record;
}

function addClaim(claims, field, value, raw, location, source) {
  const names = field === 'writer' ? writerNames(value) : [cleanName(value)];
  if (!names.length || names.some(name => !name)) return;
  const evidence = names.map(name => makeRecord(name, raw, location, source));
  claims[field].push({names, evidence, source});
}

function parseLine(claims, raw, location, source) {
  if (typeof raw !== 'string' || !raw.trim() || raw.length > MAX_LINE_LENGTH) return;
  const line = raw.trim();

  const inline = line.match(/^([^|<>.!?]{1,80}?)\s*\|\s*By\s+(.+)$/i);
  if (inline) {
    addClaim(claims, 'host', inline[1], raw, location, source);
    addClaim(claims, 'writer', inline[2], raw, location, source);
    return;
  }

  const republication = line.match(/^This (?:article|story|piece) (?:is|was) republished from (.+?) under a Creative Commons licen[cs]e\.(?: Read the original article\.)?$/i);
  if (republication) {
    addClaim(claims, 'origin', republication[1], raw, location, source);
    return;
  }

  const patterns = [
    ['writer', /^(?:by|written by|author)\s*:?\s+(.+)$/i],
    ['host', /^(?:publication|published by|hosting publication)\s*:\s*(.+)$/i],
    ['origin', /^(?:(?:this (?:article|story|piece) (?:was|is) )?originally published (?:by|in|on)|originating publication|republished (?:from|courtesy of))\s*:?\s+(.+)$/i],
  ];
  for (const [field, pattern] of patterns) {
    const match = line.match(pattern);
    if (match) {
      addClaim(claims, field, match[1], raw, location, source);
      return;
    }
  }
}

function parseText(claims, text, where, source, firstLine = 1) {
  if (typeof text !== 'string') return;
  text.split(/\r?\n/).forEach((raw, index) => {
    parseLine(claims, raw, {where, line: firstLine + index}, source);
  });
}

function nameSet(claim) {
  return [...new Set(claim.names.map(name => name.toLocaleLowerCase().replace(/\s+/g, ' ')))].sort().join('\u0000');
}

function finalize(claims) {
  return Object.fromEntries(FIELDS.map(field => {
    const groups = claims[field];
    const distinct = new Set(groups.map(nameSet));
    const status = !groups.length ? 'unknown' : distinct.size > 1 ? 'conflict' : groups.some(group => group.source !== 'metadata') ? 'credited' : 'metadata';
    return [field, {status, evidence: groups.flatMap(group => group.evidence)}];
  }));
}

function emptyClaims() {
  return {writer: [], host: [], origin: []};
}

function addMetadata(claims, field, entries) {
  if (!Array.isArray(entries)) return;
  const records = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue;
    const names = field === 'writer' ? metadataWriterNames(entry.name, claims.writer) : [cleanName(entry.name)];
    if (!names.length || names.some(name => !name)) continue;
    const evidence = typeof entry.evidence === 'string' && entry.evidence ? entry.evidence : entry.name;
    const where = typeof entry.where === 'string' && entry.where ? entry.where : 'Article metadata';
    records.push(...names.map(name => makeRecord(name, evidence, {where}, 'metadata')));
  }
  if (field === 'writer') {
    // A metadata author array commonly lists coauthors; it is one metadata claim.
    if (records.length) claims.writer.push({names: records.map(record => record.name), evidence: records, source: 'metadata'});
  } else {
    for (const record of records) claims.host.push({names: [record.name], evidence: [record], source: 'metadata'});
  }
}

export function analyzeCapture(capture) {
  const input = capture && typeof capture === 'object' ? capture : {};
  const claims = emptyClaims();
  // The selected string is only a claim if it actually contains an explicit credit.
  parseText(claims, input.selection, 'Selected text', 'selected');
  if (Array.isArray(input.visibleLines)) {
    for (const item of input.visibleLines) {
      if (!item || typeof item !== 'object') continue;
      const where = typeof item.where === 'string' && item.where ? item.where : 'Visible page text';
      parseText(claims, item.text, where, 'visible', Number.isSafeInteger(item.line) && item.line > 0 ? item.line : 1);
    }
  }
  addMetadata(claims, 'writer', input.metadataAuthors);
  addMetadata(claims, 'host', input.metadataSiteNames);
  return finalize(claims);
}

export function extractPasted(text) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('Paste article text with its credit lines first.');
  if (text.length > MAX_PASTE_LENGTH) throw new Error('Please use 60,000 characters or fewer.');
  const claims = emptyClaims();
  parseText(claims, text, 'Pasted text', 'pasted');
  return finalize(claims);
}
