'use strict';

/* ══════════════════════════════════════════════════════════════════
   CLEAN PLATES — Landing Page Interactions
══════════════════════════════════════════════════════════════════ */

// ── Mobile nav ──────────────────────────────────────────────────
const hamburger = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobile-menu');

hamburger.addEventListener('click', () => {
  hamburger.classList.toggle('open');
  mobileMenu.classList.toggle('open');
});

// Close mobile menu on link click
mobileMenu.querySelectorAll('a').forEach(a => {
  a.addEventListener('click', () => {
    hamburger.classList.remove('open');
    mobileMenu.classList.remove('open');
  });
});

// ── Scroll-based fade-up animations ────────────────────────────
const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll('.fade-up').forEach(el => observer.observe(el));

// ── Recipe filter ───────────────────────────────────────────────
const filterBtns = document.querySelectorAll('.filter-btn');
const recipeCards = document.querySelectorAll('.recipe-card');

filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const filter = btn.dataset.filter;
    recipeCards.forEach(card => {
      if (filter === 'all' || card.dataset.cat === filter) {
        card.classList.remove('hidden');
      } else {
        card.classList.add('hidden');
      }
    });
  });
});

// ── Ingredient chip toggle ──────────────────────────────────────
const chips = document.querySelectorAll('.chip');
chips.forEach(chip => {
  chip.addEventListener('click', () => chip.classList.toggle('selected'));
});

// ── Fridge generate button ──────────────────────────────────────
const generateBtn = document.getElementById('generate-btn');
const fridgeResult = document.getElementById('fridge-result');

const suggestions = [
  'Try: Shakshuka with tomatoes & eggs',
  'How about: Spinach & egg frittata',
  'Perfect for: Tomato omelette with onion',
  'Suggested: Sautéed spinach with fried egg',
  'Great combo: Tomato & onion shakshuka',
];

generateBtn.addEventListener('click', () => {
  const selected = [...document.querySelectorAll('.chip.selected')]
    .map(c => c.dataset.ing);

  if (selected.length === 0) {
    fridgeResult.textContent = 'Select at least one ingredient to start.';
    return;
  }

  const pick = suggestions[Math.floor(Math.random() * suggestions.length)];
  fridgeResult.textContent = pick;
});

// ── Sticky nav shadow on scroll ─────────────────────────────────
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => {
  nav.style.boxShadow = window.scrollY > 10
    ? '0 2px 20px rgba(0,0,0,.08)'
    : 'none';
}, { passive: true });
