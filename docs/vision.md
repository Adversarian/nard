# Vision

## The player

One person: an expert club-level backgammon player who has played his whole
life, on a real board, against real people. He is the entire user base and every
trade-off resolves in his favour.

What he wants from a computer opponent, in order:

1. **An opponent worth beating.** Strong enough that winning means something,
   and — crucially — *wrong* in believable ways at lower settings.
2. **To find out how well he actually plays.** He has never had a number. The
   analysis is the feature he doesn't know he wants yet.
3. **To not be cheated.** Or more precisely: to stop wondering.
4. **A board he enjoys looking at.** He plays on wood and bone. Plastic-looking
   software is an insult to the game.

What he does not want: to be taught, congratulated, gamified, or monetised.

## What success looks like

He opens it unprompted, more than once, after the novelty has worn off. That is
the only metric.

Concretely, the things that produce that:

- He loses a game, presses **Review**, and finds out the loss was three rolls of
  bad luck and one real error on move 14.
- His PR chart goes down over two months.
- He beats the last opponent on the ladder and tells someone about it.
- He checks the dice seed once, sees it verify, and never checks again.

## Non-goals

Stated so nobody re-litigates them:

- **No server, no accounts, no network.** Everything is local. The app does not
  phone home, does not collect telemetry, and works with the machine offline.
- **No free-to-play surface.** No currency, energy, streaks, daily rewards,
  loot, or achievements-for-attendance.
- **No strangers.** No public lobby, matchmaking, chat, or emotes.
- **Not a general backgammon platform.** We are not building a tournament
  server, a bot API, or a plugin system.
- **We are not trying to beat XG or GNU Backgammon.** We are trying to be
  strong enough that an expert club player is genuinely tested, and honest about
  the gap. Chasing world-championship strength would consume the project.

## The one soft feature

Asynchronous play against his son over a shared link is the single
social feature worth building, and only because of who the two players are. It
is scheduled late (M6) and must not compromise the offline-first architecture.
