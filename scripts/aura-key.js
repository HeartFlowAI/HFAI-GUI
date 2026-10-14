#!/usr/bin/env node
const { mint } = require('../src/aura');
const count = Math.max(1, Math.min(500, Number(process.argv[2]) || 1));
for (let i = 0; i < count; i++) console.log(mint());
