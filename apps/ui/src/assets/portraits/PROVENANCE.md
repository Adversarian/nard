# Portraits

The six ladder opponents. **Generated images**, not photographs and not likenesses
of real people — generated with `gpt-image-2` from written character briefs.

Deliberately one visual technique across the set: an antique woodblock engraving
in ebony-brown ink on bone paper with a single brass-ochre accent. That is the
same material vocabulary as the board itself, so the opponents look as though
they belong to the same object rather than having been dropped in from a
different app.

Each brief describes **someone sitting across the board from you mid-game**,
looking straight at their opponent — competitive, playful, alive. The first
attempt asked for "dignified" portraits and got portrait-studio stiffness:
technically good, but scholarly, and nothing like how the game is actually played.
Backgammon at a real table is full of relish and banter, and the faces should say
so.

They are opponents the player is meant to enjoy meeting, not obstacles.

| File | Character |
| --- | --- |
| `davoud.webp` | early twenties, eager, still delighted to have been taught |
| `nasrin.webp` | thirties, sharp, already thinking about leaving |
| `keyvan.webp` | forties, moustache, laughing, coffee-house player |
| `mehrdad.webp` | fifties, spectacles, entirely unhurried |
| `parvaneh.webp` | sixties, serene, content to wait a very long time |
| `ostad.webp` | seventies, amused, completely unbothered |

512×512 WebP. Regenerate from the briefs above if a larger size is ever needed.

## Keep the 4:5 frame they were drawn in

**The image model does not honour a requested square size.** Asking for
1024×1024 returned 1122×1402, 1024×1536 and 1183×1329 — all portrait.

Two mistakes came out of that, in order. Scaling them to 512×512 squashed every
face; that is obvious once someone says it. Cropping them square instead fixed
the proportions but threw away a fifth to a third of each image — Ostad, whose
source is 2:3, lost his coat entirely, and these are portraits where the
clothing is half the character.

So the frame fits the pictures rather than the other way round. **4:5 costs
almost nothing**: four of the six lose no pixels at all, Davoud loses 10% of his
width and Ostad 17% of his height, against 20–33% for a square.

```
ffmpeg -i in.png -vf \
  "crop=w='min(iw,ih*0.8)':h='min(ih,iw/0.8)':x='(iw-min(iw,ih*0.8))/2':y=0,\
   scale=512:640:flags=lanczos" -frames:v 1 out.png
```

Tall images crop from the top, which keeps the head and as much of the clothing
as the ratio allows. They are shown as framed prints, not circular avatars — a
circle would undo all of this.

Check the aspect ratio of whatever the model returns before converting, and
check what the crop actually removed. Do not assume the size you asked for is
the size you got.


## A note on likeness

These are invented people. During generation one portrait came back with a
noticeable resemblance to a real and highly political Iranian public figure, and
was regenerated with a different facial structure. Worth watching for if these
are ever regenerated: an unintended likeness is not a small problem, particularly
in something made as a gift.
