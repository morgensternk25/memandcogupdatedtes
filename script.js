'use strict';

// Each list contains six common, concrete words. Lists and strategy order are
// independently shuffled for every session.
const WORD_LISTS = [
  ['apple', 'chair', 'river', 'button', 'candle', 'basket'],
  ['hammer', 'garden', 'window', 'lemon', 'pillow', 'bridge'],
  ['guitar', 'cloud', 'spoon', 'ladder', 'orange', 'pencil']
];

const STRATEGIES = [
  {
    id: 'maintenance_rehearsal',
    name: 'Maintenance rehearsal',
    instructions: 'Repeat each word silently to yourself. Focus on keeping the word active in your memory by saying it over and over in your head. Do not create a story or picture.'
  },
  {
    id: 'self_reference',
    name: 'Self-reference',
    instructions: 'For each word, think about how it relates to you personally. For example, consider whether you own it, use it, like it, or have a memory connected to it.'
  },
  {
    id: 'mental_imagery',
    name: 'Mental imagery',
    instructions: 'For each word, create a clear mental picture of the object. Imagine its appearance, color, size, or where you might see it.'
  }
];

const WORD_ALIASES = {
  apple: ['apples'], chair: ['chairs'], river: ['rivers'], button: ['buttons'],
  candle: ['candles'], basket: ['baskets'], hammer: ['hammers'], garden: ['gardens'],
  window: ['windows'], lemon: ['lemons'], pillow: ['pillows'], bridge: ['bridges'],
  guitar: ['guitars'], cloud: ['clouds'], spoon: ['spoons'], ladder: ['ladders'],
  orange: ['oranges'], pencil: ['pencils']
};

const $ = (id) => document.getElementById(id);
const sections = ['welcome', 'instructions', 'study', 'distractor', 'recall', 'results'];
let session = null;
let currentBlock = 0;
let currentWord = 0;
let studyTimer = null;
let distractorTimer = null;
let remainingSeconds = 30;
let expectedNumber = null;

function showSection(id) {
  sections.forEach(name => $(name).classList.toggle('hidden', name !== id));
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function makeSession() {
  const strategies = shuffle(STRATEGIES);
  const lists = shuffle(WORD_LISTS);
  const sessionId = `S${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const trials = [];
  strategies.forEach((strategy, blockIndex) => {
    lists[blockIndex].forEach((word, wordIndex) => {
      trials.push({
        session_id: sessionId,
        block_order: blockIndex + 1,
        strategy_id: strategy.id,
        strategy_name: strategy.name,
        list_id: WORD_LISTS.indexOf(lists[blockIndex]) + 1,
        word_position: wordIndex + 1,
        word,
        recalled: 0,
        recalled_as: ''
      });
    });
  });
  return {
    sessionId,
    startedAt: new Date().toISOString(),
    strategies,
    trials,
    distractorStart: null,
    distractorEntries: [],
    recallText: '',
    completedAt: null
  };
}

function startExperiment() {
  session = makeSession();
  currentBlock = 0;
  currentWord = 0;
  showBlockInstructions();
}

function showBlockInstructions() {
  const strategy = session.strategies[currentBlock];
  $('blockProgress').textContent = `Block ${currentBlock + 1} of 3`;
  $('instructionTitle').textContent = strategy.name;
  $('instructionText').textContent = strategy.instructions;
  $('beginBlockBtn').textContent = 'Begin block';
  showSection('instructions');
}

function beginBlock() {
  currentWord = 0;
  showSection('study');
  showNextWord();
}

function showNextWord() {
  const strategy = session.strategies[currentBlock];
  const blockTrials = session.trials.filter(t => t.strategy_id === strategy.id);
  if (currentWord >= blockTrials.length) {
    currentBlock += 1;
    if (currentBlock < 3) showBlockInstructions();
    else startDistractor();
    return;
  }
  const trial = blockTrials[currentWord];
  $('studyProgress').textContent = `Block ${currentBlock + 1} of 3 · Word ${currentWord + 1} of 6`;
  $('studyWord').textContent = trial.word;
  currentWord += 1;
  studyTimer = window.setTimeout(showNextWord, 3000);
}

function startDistractor() {
  // A three-digit starting value divisible by 3 makes the sequence straightforward.
  session.distractorStart = Math.floor(34 + Math.random() * 300) * 3;
  expectedNumber = session.distractorStart - 3;
  remainingSeconds = 30;
  session.distractorEntries = [];
  $('startingNumber').textContent = session.distractorStart;
  $('timer').textContent = remainingSeconds;
  $('countInput').value = '';
  $('countFeedback').textContent = 'Enter the next number in the sequence.';
  showSection('distractor');
  $('countInput').focus();
  distractorTimer = window.setInterval(() => {
    remainingSeconds -= 1;
    $('timer').textContent = remainingSeconds;
    if (remainingSeconds <= 0) finishDistractor();
  }, 1000);
}

function submitCount() {
  const raw = $('countInput').value.trim();
  if (raw === '') return;
  const entered = Number(raw);
  const correct = Number.isInteger(entered) && entered === expectedNumber;
  session.distractorEntries.push({
    entered: raw,
    expected: expectedNumber,
    correct: correct ? 1 : 0,
    elapsed_seconds: 30 - remainingSeconds
  });
  if (correct) {
    expectedNumber -= 3;
    $('countFeedback').textContent = 'Correct. Keep going!';
  } else {
    $('countFeedback').textContent = `Not quite. The next number is ${expectedNumber}. Continue from there.`;
  }
  $('countInput').value = '';
  $('countInput').focus();
}

function finishDistractor() {
  if (distractorTimer) window.clearInterval(distractorTimer);
  distractorTimer = null;
  showSection('recall');
  $('recallInput').focus();
}

function normalizeWord(word) {
  return word.toLowerCase().replace(/[^a-z]/g, '');
}

function levenshtein(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const old = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = old;
    }
  }
  return row[b.length];
}

function matchRecallToken(token, unmatchedWords) {
  const cleaned = normalizeWord(token);
  if (!cleaned) return null;

  // Exact match and simple plural aliases are preferred.
  for (const word of unmatchedWords) {
    if (cleaned === word || (WORD_ALIASES[word] || []).includes(cleaned)) return word;
  }

  // Accept small typographical errors: one edit for short words, up to two
  // for longer words. Only a unique closest candidate is accepted.
  const candidates = unmatchedWords
    .map(word => ({ word, distance: levenshtein(cleaned, word) }))
    .filter(item => item.distance <= (item.word.length >= 7 ? 2 : 1))
    .sort((a, b) => a.distance - b.distance);
  if (!candidates.length) return null;
  if (candidates.length > 1 && candidates[0].distance === candidates[1].distance) return null;
  return candidates[0].word;
}

function scoreRecall() {
  const raw = $('recallInput').value;
  session.recallText = raw;
  const tokens = raw.split(/[\s,;.!?]+/).map(t => t.trim()).filter(Boolean);
  const unmatched = new Set(session.trials.map(t => t.word));
  const matches = [];
  tokens.forEach(token => {
    const match = matchRecallToken(token, [...unmatched]);
    if (match) {
      unmatched.delete(match);
      matches.push({ word: match, recalled_as: token });
    }
  });

  matches.forEach(match => {
    const trial = session.trials.find(t => t.word === match.word);
    trial.recalled = 1;
    trial.recalled_as = match.recalled_as;
  });
  session.completedAt = new Date().toISOString();
  showResults();
}

function showResults() {
  const cards = session.strategies.map(strategy => {
    const trials = session.trials.filter(t => t.strategy_id === strategy.id);
    const score = trials.filter(t => t.recalled).length;
    return `<div class="score-card"><h3>${strategy.name}</h3><div class="score">${score}/6</div><div class="muted">${Math.round(score / 6 * 100)}% recalled</div></div>`;
  }).join('');
  $('scoreResults').innerHTML = cards;
  const total = session.trials.filter(t => t.recalled).length;
  $('resultIntro').textContent = `You recalled ${total} of the 18 studied words. Download both files below to save your results.`;
  showSection('results');
}

function csvEscape(value) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsv(filename, headers, rows) {
  const csv = [headers, ...rows].map(row => row.map(csvEscape).join(',')).join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadSummary() {
  const total = session.trials.filter(t => t.recalled).length;
  const row = {
    session_id: session.sessionId,
    started_at: session.startedAt,
    completed_at: session.completedAt,
    strategy_order: session.strategies.map(s => s.id).join('|'),
    maintenance_rehearsal_recalled: session.trials.filter(t => t.strategy_id === 'maintenance_rehearsal' && t.recalled).length,
    self_reference_recalled: session.trials.filter(t => t.strategy_id === 'self_reference' && t.recalled).length,
    mental_imagery_recalled: session.trials.filter(t => t.strategy_id === 'mental_imagery' && t.recalled).length,
    total_recalled: total,
    total_studied: 18,
    distractor_start: session.distractorStart,
    distractor_entries: session.distractorEntries.length,
    distractor_correct_entries: session.distractorEntries.filter(e => e.correct).length,
    recall_response: session.recallText
  };
  const headers = Object.keys(row);
  downloadCsv('memory_experiment_summary.csv', headers, [headers.map(h => row[h])]);
}

function downloadTrials() {
  const headers = [
    'session_id', 'started_at', 'completed_at', 'block_order', 'strategy_id',
    'strategy_name', 'list_id', 'word_position', 'word', 'recalled', 'recalled_as'
  ];
  const rows = session.trials.map(t => [
    t.session_id, session.startedAt, session.completedAt, t.block_order,
    t.strategy_id, t.strategy_name, t.list_id, t.word_position, t.word,
    t.recalled, t.recalled_as
  ]);
  downloadCsv('memory_experiment_trials.csv', headers, rows);
}

function restart() {
  if (studyTimer) window.clearTimeout(studyTimer);
  if (distractorTimer) window.clearInterval(distractorTimer);
  studyTimer = null;
  distractorTimer = null;
  session = null;
  showSection('welcome');
}

$('startBtn').addEventListener('click', startExperiment);
$('beginBlockBtn').addEventListener('click', beginBlock);
$('submitCountBtn').addEventListener('click', submitCount);
$('countInput').addEventListener('keydown', event => {
  if (event.key === 'Enter') submitCount();
});
$('submitRecallBtn').addEventListener('click', scoreRecall);
$('summaryDownloadBtn').addEventListener('click', downloadSummary);
$('trialDownloadBtn').addEventListener('click', downloadTrials);
$('restartBtn').addEventListener('click', restart);
