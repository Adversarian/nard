"""Resident GNU Backgammon bridge for @nard/ai.

This is our protocol adapter, not GNU Backgammon source. It runs inside
gnubg's embedded Python interpreter and exchanges one JSON object per line.
"""

import json
import sys

import gnubg


MAX_MOVES = 10000


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


def configure():
    gnubg.command("set display off")
    gnubg.command("set player 0 human")
    gnubg.command("set player 1 human")
    gnubg.command("new match 0")
    gnubg.command("set jacoby off")

    # The defaults deepen only a filtered subset. Difficulty requires every
    # candidate to have an equity measured at the requested ply.
    gnubg.command("set evaluation movefilter 1 0 10000 0 0")
    gnubg.command("set evaluation movefilter 2 0 10000 0 0")


def rank_moves(params):
    position_id = params["positionId"]
    first, second = params["dice"]
    plies = params["plies"]

    if "matchId" not in params:
        gnubg.command("new match 0")
        gnubg.command("set jacoby off")
    gnubg.command("set board " + position_id)
    if "matchId" in params:
        gnubg.command("set matchid " + params["matchId"])
    gnubg.command("set evaluation chequerplay eval plies %d" % plies)
    gnubg.command("set dice %d %d" % (first, second))

    result = gnubg.hint(MAX_MOVES)
    if result.get("hinttype") != "chequer":
        raise RuntimeError("gnubg returned %r instead of checker hints" % result.get("hinttype"))

    moves = []
    for candidate in result.get("hint", ()):
        details = candidate.get("details", {})
        moves.append(
            {
                "move": candidate["move"],
                "positionId": resulting_position_id(position_id, candidate["move"]),
                "equity": candidate["equity"],
                "eqdiff": candidate["eqdiff"],
                "probs": details["probs"],
            }
        )

    return {"moves": moves}


def cube_decision(params):
    position_id = params["positionId"]
    cube_value = params["cubeValue"]

    board = gnubg.positionfromid(position_id)
    cube_info = gnubg.cubeinfo(
        cube_value,
        params["cubeOwner"],
        1,
        params["matchLength"],
        tuple(params["score"]),
        int(params["crawford"]),
        0,
    )
    cube_info["jacoby"] = int(params["jacoby"])
    cube_info = gnubg.calcgammonprice(cube_info)
    context = {
        "cubeful": 1,
        "plies": params["plies"],
        "deterministic": 1,
        "noise": 0.0,
        "prune": 1,
    }
    evaluation = gnubg.cfevaluate(board, cube_info, context)
    recommendation = evaluation[5]

    if recommendation.startswith(("No double", "No redouble", "Never double")):
        action = "no-double"
    elif recommendation.startswith("Too good"):
        action = "too-good"
    elif recommendation.startswith(("Double", "Redouble")):
        action = "double"
    else:
        raise RuntimeError("unknown gnubg cube recommendation: " + recommendation)

    response = "pass" if ", pass" in recommendation.lower() else "take"
    return {
        "action": action,
        "response": response,
        "equityNoDouble": evaluation[1],
        "equityDoubleTake": evaluation[2],
        "equityDoublePass": evaluation[3],
    }


def dispatch(request):
    method = request["method"]
    params = request.get("params", {})

    if method == "rank_moves":
        return rank_moves(params)
    if method == "cube_decision":
        return cube_decision(params)
    raise ValueError("unknown method: " + str(method))


def respond(payload):
    sys.stdout.write(json.dumps(payload, separators=(",", ":")) + "\n")
    sys.stdout.flush()


configure()

for line in sys.stdin:
    if not line.strip():
        continue

    request_id = None
    try:
        # PowerShell's redirected StandardInput may emit a UTF-8 BOM on the
        # first line. Rust and Node write BOM-free UTF-8, but accepting one
        # here keeps the same bridge portable across the Windows smoke path.
        request = json.loads(line.lstrip("\ufeff"))
        request_id = request.get("id")
        respond({"id": request_id, "ok": True, "result": dispatch(request)})
    except Exception as error:
        respond(
            {
                "id": request_id,
                "ok": False,
                "error": "%s: %s" % (type(error).__name__, error),
            }
        )
