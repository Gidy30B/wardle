# 🎯 Wardle Theme Implementation — Execution Checklist (Safe Mode)

## 🔒 RULE ZERO (READ BEFORE STARTING)

For EVERY file you edit:

* You are ONLY allowed to change className strings
* You are NOT allowed to:

  * modify props
  * move JSX
  * change conditionals
  * add new components

If you touch anything else → STOP

---

# 🧱 STEP 1 — Fix Canvas (MobileLayout)

## Target: MobileLayout.tsx

### Replace:

* bg-slate-100 → bg-gradient-to-b from-slate-950 via-slate-900 to-black
* text-slate-950 → text-white
* footer bg-slate-100/95 → bg-black/80
* footer border-slate-200 → border-white/10

---

## ✅ Expected Result:

* Entire app becomes dark
* Footer blends with theme

---

# 🧩 STEP 2 — Fix Header

## Target: AppHeader.tsx

### Replace:

* bg-white → bg-white/5 backdrop-blur-md
* border-slate-200 → border-white/10
* text-slate-* → text-white / text-white/70
* text-sky-* → text-emerald-400

---

## ⚠️ DO NOT TOUCH:

* progressSummary
* menu handlers

---

# 🧊 STEP 3 — Fix BottomSheet (BIG VISUAL WIN)

## Target: BottomSheet.tsx

### Replace:

* bg-white → bg-black/80 backdrop-blur-xl
* handle bg-slate-300 → bg-white/20
* overlay bg-black/40 → bg-black/60

---

## Result:

* App feels instantly “premium”

---

# 🧾 STEP 4 — Fix ProgressSection

### Replace:

* bg-white → bg-white/5
* border-slate-200 → border-white/10
* text-slate-* → text-white variants
* sky/yellow icons → emerald/amber equivalents

---

# 🧠 STEP 5 — Fix CaseCard (via GamePlaySection)

## IMPORTANT:

Do NOT touch GamePlaySection structure

### Only update CaseCard:

* bg-white → bg-white/5
* border-slate-200 → border-white/10
* text-slate-* → text-white variants

---

# 🎯 STEP 6 — Fix FeedbackSection

## HIGH RISK — BE CAREFUL

### Replace ONLY:

* bg-sky-600 → bg-emerald-500
* bg-white → bg-white/5
* border-slate-200 → border-white/10
* text-slate-* → text-white variants

---

## 🚨 DO NOT TOUCH:

* share logic
* conditional rendering
* streak/xp logic

---

# ⌨️ STEP 7 — Fix FooterInput / GuessInput

### Replace:

* text-slate-600 → text-white/60
* bg-white → bg-white/5
* border-slate-200 → border-white/10
* focus:ring-sky → focus:ring-emerald

---

# 🔗 STEP 8 — Fix GamePage Accents

## Target: GamePage.tsx

### Replace:

* text-sky-600 → text-emerald-400

---

# 🧪 AFTER EACH STEP

Run app and confirm:

* UI renders
* no blank screen
* guess submission works
* score updates
* sheets open

---

# 🚨 STOP CONDITIONS

If you see ANY of these:

* new file created
* component duplicated
* props changed
* TypeScript error

→ STOP IMMEDIATELY

---

# 🎯 FINAL CHECK

App should feel:

* dark
* cohesive with entry
* no white surfaces
* consistent accents
