"""GNU Backgammon oracle used by tools/difftest.ts.

This file runs inside gnubg's embedded Python interpreter. Input is a JSON array
of {positionId, dice} records. Output lines beginning with NARD_DIFF contain the
deduplicated GNU resulting-position set for the corresponding record.
"""

import json
import os

import gnubg


def resulting_position_id(position_id, notation):
    board = [list(side) for side in gnubg.positionfromid(position_id)]
    opponent, player = board

    for source, destination in gnubg.parsemove(notation):
        player[24 if source == 25 else source - 1] -= 1

        if destination == 0:
            continue

        opponent_index = 24 - destination
        if opponent[opponent_index] == 1:
            opponent[opponent_index] = 0
            opponent[24] += 1
        player[destination - 1] += 1

    return gnubg.positionid(board)


gnubg.command("set display off")
gnubg.command("set player 0 human")
gnubg.command("set player 1 human")
gnubg.command("new match 7")
gnubg.command("set evaluation chequerplay evaluation plies 0")

with open(os.environ["NARD_DIFF_INPUT"], encoding="utf-8") as source:
    cases = json.load(source)

for index, case in enumerate(cases):
    position_id = case["positionId"]
    first, second = case["dice"]
    gnubg.command("set board " + position_id)
    gnubg.command("set dice %d %d" % (first, second))
    result = gnubg.hint(10000)
    moves = result.get("hint", ()) if result.get("hinttype") == "chequer" else ()
    positions = sorted(
        {
            resulting_position_id(position_id, candidate["move"])
            for candidate in moves
        }
    )
    print(
        "NARD_DIFF "
        + json.dumps([index, positions], separators=(",", ":"))
        + " NARD_END"
    )
