# Image generation — creative direction

Decided by the owner, 2026-09-03. This is the standard the image prompts are
rebuilt against.

## The goal

**Generated images must read as a real photo someone took on a phone or
camera — not as AI creative, and not as stock photography.**

In feed, a native-looking photo does not register as an ad until the viewer has
already stopped scrolling. A polished, evenly-lit, perfectly-composed image
announces itself as advertising immediately and gets scrolled past.

## Correction: there was no three-way contradiction

`docs/SPEC.md` §8 claims the live `app_settings.master_image_prompt` instructs
the model to bake in typography, a logo, a benefits list and a yellow JOIN
TODAY button, contradicting `REALISM_CONSTRAINTS`.

**That claim is false.** The actual stored row was retrieved on 2026-09-03 and
opens with:

> CRITICAL: This is a PHOTOGRAPH ONLY. The brand chrome (headline, logo, CTA
> strip, buttons, benefit icons, microcopy) will be composited on top of this
> photo in code afterward.

followed by six explicit DO NOT rules covering text, logos, buttons, icons and
colour bars. All three prompts agree; the spec's own summary misdescribed the
row it was describing.

Treat SPEC.md as a secondary source with at least one confirmed error. Where it
matters, check against the retrieved source in this repo.

The live prompt was also already pointing at this direction — it asked for "a
real candid summer moment captured naturally... not overly staged, not
stock-photo perfect, not cinematic Hollywood" and "a real weekend moment, not a
photoshoot". What changes is the register (phone rather than DSLR) and removing
the Carefree-specific parts, not the intent.

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
