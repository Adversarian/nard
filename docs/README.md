# docs

The specifications are the primary artifact; the code is derived from them.
If code and spec disagree, that is a bug in one of them — decide which and fix
it, don't leave them out of sync.

| Doc | What it settles |
| --- | --- |
| [vision.md](vision.md) | Who this is for, what "done" means, what we refuse to build |
| [architecture.md](architecture.md) | Package boundaries, data flow, dependency choices |
| [design-language.md](design-language.md) | **Binding.** Colour, type, spacing, motion, board anatomy |
| [rules-spec.md](rules-spec.md) | The exact backgammon rules the engine implements |
| [ai-spec.md](ai-spec.md) | Evaluator, search, difficulty ladder, personalities |
| [analysis-spec.md](analysis-spec.md) | Equity loss, PR scoring, luck/skill split, drills |
| [dice-fairness.md](dice-fairness.md) | The commit–reveal protocol and how a player verifies it |
| [playtesting.md](playtesting.md) | How an agent runs, sees, and plays the game |
| [roadmap.md](roadmap.md) | Milestones, in order, with exit criteria |
| [adr/](adr/) | Why things are the way they are. Append-only. |
