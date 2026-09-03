# Image generation — creative direction

Decided by the owner, 2026-09-03. This is the standard the image prompts are
rebuilt against.

## The goal

**Generated images must read as a real photo someone took on a phone or
camera — not as AI creative, and not as stock photography.**

In feed, a native-looking photo does not register as an ad until the viewer has
already stopped scrolling. A polished, evenly-lit, perfectly-composed image
announces itself as advertising immediately and gets scrolled past.

## What this settles

The Lovable build carried **three contradictory master image prompts**
(docs/SPEC.md §8):

| Source | Instruction |
|---|---|
| `app_settings.master_image_prompt` (the one actually running) | Bake in typography, a logo, a benefits list and a yellow JOIN TODAY button |
| `DEFAULT_MASTER_PROMPT` in the component | Clean photo, **no** text or chrome |
| A third default in `generate-images` | Shorter variant |

The direction above resolves it: **the clean-photo version is correct.** A real
phone photo does not have a call-to-action button rendered into it. Brand chrome
is composited afterwards — that is what the overlay path exists for.

This also removes a live conflict inside a single request: the DB prompt asked
for on-image text while `REALISM_CONSTRAINTS`, appended to every prompt,
forbade it.

## What the master prompt should push toward

- Natural available light, including imperfect light — backlight, harsh midday
  sun, overcast flatness, golden hour that is actually uneven
- Handheld framing. Slightly off-centre, imperfect horizon, real perspective
- Phone-camera depth of field: mostly deep focus, not shallow cinematic bokeh
- Authentic colour, not boosted saturation or heavy grading
- Ordinary moments over posed hero shots
- Real-world texture: wear, water spots, wind, a towel out of place

## What it must push away from

- Studio or ring lighting, obvious fill, evenly-lit everything
- Perfect symmetry and centred hero composition
- Over-saturated skies, HDR halos, plastic skin
- Stock-photo staging: eye contact with camera, arranged group shots
- Any text, logo, watermark, button or graphic element rendered into the image
- The AI tells listed in `REALISM_CONSTRAINTS` — malformed hands, duplicated
  limbs, impossible object placement

## Still true regardless

The physical-plausibility rules carry over unchanged, because they are about
whether a scene could exist, not how it is lit:

- Loose gear must sit where it would not fall
- The boat's state must match the scene's verb — a "cruising" shot cannot be
  tied to a dock, an anchored boat has no wake
- Dock exclusivity when a scene calls for open water, including in the
  background
- Passenger poses must be physically possible

## Composition constraint

Generated images still need **clean negative space at top and bottom** for
headline overlay, and wide framing (docs/SPEC.md §9 rule 26). "Looks like a
phone photo" must not become "tightly cropped", or the overlay has nowhere to
sit.

## Open

Whether a phone-photo look needs an explicit camera/lens description in the
prompt, or whether naming it directly makes the output look like a *simulation*
of a phone photo. Worth testing both against the same scene.
