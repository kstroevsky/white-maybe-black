Original prompt: PLEASE IMPLEMENT THIS PLAN:
# Long-Horizon AI Upgrade for White Maybe Black

## Summary
- Treat this game as a logistics-and-conversion game, not a capture game. Good play means: create space from the full starting board, use stacks as temporary transport/control tools, freeze only when it blocks key lanes, and commit to either `homeField` dispersion or `sixStacks` conversion instead of mixing both every turn.
- Keep alpha-beta as the main search. In the current repo, local perf output already shows `hard` often ends opening searches at `completedDepth: 0`, so the next gain is not “more brute force” but `better node quality + better throughput + better long-range evaluation`.
- Use a staged hybrid. Phase 1 makes the current engine strategically competent and less loop-prone. Phase 2 adds an offline-trained policy/value model to give the engine a longer-horizon sense of which structures actually lead to wins.

## Phase 1: Strategic Alpha-Beta
- Normalize search scores to `side to move`, keep TT scores in the same orientation, and add `PVS + aspiration windows + quiescence`. Quiescence must resolve jump continuations, freeze/unfreeze swings, immediate `homeField` completions, immediate `sixStacks` completions, and forced rescue moves before static evaluation.
- Remove exact `getLegalActions()` mobility calls from every leaf. Replace them with one cached board-feature pass per hash; exact move generation stays at the root, in quiescence triggers, and in terminal-threat checks only.
- Replace the current flat evaluator with a phase-aware dual-plan evaluator. Compute `homePlanPotential`, `stackPlanPotential`, `laneOpenness`, `freezeTempo`, `transportValue`, `buriedOwnDebt`, and `conversionReadiness`, then choose `intent = home | sixStack | hybrid` from the board plus the last two own moves in history.
- Fix the current structural bias explicitly: a full owned height-3 stack gets the big completion bonus only on the actual front home row, never elsewhere; progress-to-home terms count every checker in a stack, not only the top checker.
- Tag every move with strategic families: `openLane`, `advanceMass`, `freezeBlock`, `rescue`, `frontBuild`, `captureControl`, `decompress`. Move ordering becomes `TT/PV > forced tactic > tactical > high plan score > history/killer > quiet`.
- Add anti-loop scoring: repetition penalty from `positionCounts`, self-undo penalty for restoring the same local pattern within 2 plies, and a novelty penalty when the AI repeats the same regional motif while a near-equal alternative exists.
- Hard mode becomes `strategic variety`. After search, keep up to 3 root moves within `max(60, 1.5% of |bestScore|)` of the best score, reject anything that fails a forced tactic, prefer candidates with different strategic tags, then sample with temperature `0.15`. Forced wins, only-move defenses, and losing-save draws stay deterministic.

## Phase 2: Learned Guidance
- Add an offline Python + PyTorch training pipeline and keep browser inference local through `onnxruntime-web`. If the model is missing or fails to load, the worker falls back to the phase-1 engine.
- Generate self-play data from the phase-1 engine with stochastic root choice for the first 8 plies, horizontal mirroring, and player-perspective normalization. Store `(state, maskedPolicyTarget, outcomeValue, strategicIntent)`.
- Encode each position as 16 planes on `6x6`: own active singles, own frozen singles, own top-on-height-2, own top-on-height-3, own buried depth-1, own buried depth-2, the same 6 planes for the opponent, plus `empty`, `own-home-mask`, `own-front-row-mask`, and `pending-jump-source`.
- Use a small residual CNN: 4 residual blocks, 32 channels, one policy head and one value head. The policy head outputs a fixed masked action space of `2736` logits: `36 manual-unfreeze`, `288 jump-direction`, `1152 adjacent-action`, `1260 friendly-transfer`. The value head outputs `[-1, 1]`.
- Use the model only as guidance: policy logits become move-order priors and root widening priors; value replaces the deepest quiet eval as a blend of `0.7 model / 0.3 heuristic` after quiescence.
- Re-run self-play after integration and iterate training twice. Do not switch to MCTS in this plan unless guided alpha-beta fails the opening-depth and self-play benchmarks.

## Public Interfaces
- Extend `AiDifficultyPreset` with `repetitionPenalty`, `selfUndoPenalty`, `varietyTopCount`, `varietyThreshold`, `varietyTemperature`, and `policyPriorWeight`.
- Extend `AiSearchResult` with `principalVariation`, `rootCandidates`, `diagnostics`, and `strategicIntent`.
- Each root candidate records `action`, `score`, `policyPrior`, `tags`, `intentDelta`, and `forced`.
- Keep the worker request shape unchanged except for the richer `AiSearchResult`; no new user-facing toggles in v1.

## Test Plan
- Add regression fixtures for the user’s loop patterns and assert the AI chooses a non-looping equal-or-better move.
- Add phase tests: opening positions must prefer decongestion; clear `homeField` positions must prefer dispersion over local stack churn; clear `sixStacks` positions must prefer front-row scaffolds and completion.
- Add parity and stability tests: odd/even depth agreement, timeout fallback, quiescence boundaries, TT reuse, repetition avoidance, and self-undo rejection.
- Add creativity tests: in stable non-tactical roots, hard mode must produce at least 2 distinct openings across repeated runs without dropping below the near-equal threshold; in forced tactical roots, hard mode stays deterministic.
- Add learned-model tests: legal-action masking, worker fallback when ONNX is unavailable, single-load model caching, and no main-thread regression.
- Acceptance targets: hard mode completes at least depth `1` on the current `initialState` and `afterOpening` perf fixtures, cuts voluntary two-ply repeats by at least `75%`, and scores at least `+15%` more wins than the current hard engine over a 200-game mirrored gauntlet.

## Assumptions And References
- Defaults chosen: browser-local inference, offline Python training allowed, hard mode favors strategic and human-like variety, and plan-switching is allowed only when the new intent clearly beats the old one.
- Best-practice conclusion: use variable-depth/quiescence before deeper brute force, use game-specific phase/intention features before adding randomness, and use self-play policy/value learning once terminal rewards are too far away for hand-tuned eval to stay reliable.
- References: [Kaindl 1983](https://www.ijcai.org/Proceedings/83-2/Papers/039.pdf), [Browne et al. 2012](https://repository.essex.ac.uk/4117/1/MCTS-Survey.pdf), [Chaslot et al. 2008](https://cris.maastrichtuniversity.nl/en/publications/progressive-strategies-for-monte-carlo-tree-search/), [Lanctot et al. 2014](https://arxiv.org/abs/1406.0486), [Tesauro 1992](https://research.ibm.com/publications/temporal-difference-learning-of-backgammon-strategy), [Tesauro 2002](https://bkgm.com/articles/tesauro/ProgrammingBackgammon.pdf), [Silver et al. 2017](https://arxiv.org/abs/1712.01815).

Notes:
- Current repo already has partial phase-1 work: quiescence, repetition/self-undo penalties, root candidate diagnostics, and default threefold draws in computer matches.
- Remaining implementation work is focused on richer strategic evaluation, strategic move tags/variety, learned-guidance scaffolding, and broader regression coverage.

Update 2026-03-12:
- Implemented a cached strategic analysis layer in `src/ai/strategy.ts` and rewrote `src/ai/evaluation.ts` to score `home` / `sixStack` / `hybrid` plans instead of exact leaf mobility.
- Extended move ordering with strategic tags, intent deltas, novelty penalties, and optional policy priors.
- Added PVS, aspiration re-search accounting, richer diagnostics, and strategic-intent/root-candidate reporting in the alpha-beta search.
- Added optional ONNX guidance plumbing:
  - TS action-space and board encoders in `src/ai/model/`
  - worker-side optional model loading with cheap asset probing before importing ONNX runtime
  - offline self-play dataset export script in `scripts/ai-selfplay-dataset.ts`
  - Python/PyTorch training scaffold in `training/`
- Added/updated regression coverage for:
  - strategic intent and richer preset/result contracts
  - model encoding/action mapping/fallback
  - hard-mode variety selection
  - existing AI/store integration and soak behavior

Verification:
- `npm run build`
- `npm run test:run -- src/ai/model.test.ts src/ai/search.behavior.test.ts src/ai/search.timeout.test.ts src/app/store/createGameStore.ai.test.ts`
- `npm run test:run -- src/ai/search.soak.test.ts`
- `npm run ai:selfplay -- --games=1 --max-turns=2 --out=output/training/test.jsonl`
- Browser smoke via local Playwright against `npm run preview -- --host 127.0.0.1 --port 4177`

Known limitation:
- The optional learned-guidance path is integrated as root policy guidance in the browser worker. The recursive search remains synchronous, so the ONNX value head is loaded and exposed in guidance results but is not yet queried at deep leaf nodes inside negamax/quiescence.
