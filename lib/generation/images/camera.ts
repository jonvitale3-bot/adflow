/**
 * Camera register.
 *
 * The owner's direction is that images should read as a real photo taken on a
 * phone or camera, not as AI creative or stock photography (docs/IMAGE-DIRECTION.md).
 *
 * Naming a camera explicitly is a genuine open question: it can push toward
 * authenticity, or it can make output look like a *simulation* of a phone
 * photo — fake grain, fake lens flare, fake vignette. So the register is a
 * variable and the two can be tested against the same scene rather than
 * argued about.
 */
export type CameraRegister = "phone" | "dslr" | "unspecified";

const PHONE = `PHOTOGRAPHIC CHARACTER:
This must look like a real photo someone actually took on their phone during the moment — not a produced advertisement, not a stock photo, not an AI image.
- Natural available light only, including imperfect light: harsh midday sun, backlight, overcast flatness, uneven golden hour. No studio lighting, no fill light, no ring light, no obviously even exposure.
- Handheld framing. Slightly off-centre, horizon not perfectly level, the framing a real person gets when they lift a phone quickly.
- Deep focus, the way a phone camera renders. Avoid shallow cinematic bokeh and avoid an artificially blurred background.
- True-to-life colour. No boosted saturation, no heavy grading, no HDR halos, no plastic skin.
- An ordinary moment rather than a posed hero shot. Nobody making eye contact with the camera. Nobody arranged into a group pose.
- Real-world texture is welcome: wear, water spots, a towel out of place, wind in hair, a slightly messy deck.
Do NOT simulate a phone photo with fake artifacts — no added grain, no fake lens flare, no vignette, no visible UI, no timestamp. It should simply BE an ordinary well-taken photo.`;

const DSLR = `PHOTOGRAPHIC CHARACTER:
Authentic candid feel captured naturally on a high-end DSLR with a 35mm lens — not overly staged, not stock-photo perfect, not cinematic Hollywood. The goal is emotional realism, a real weekend moment rather than a photoshoot.
- Natural golden hour lighting or bright summer daylight.
- Natural interaction and movement, candid rather than posed.
- Realistic environment with accurate detail and correct proportions.
- Wider composition with environmental context visible; people occupy roughly 30-50% of the frame.`;

const UNSPECIFIED = `PHOTOGRAPHIC CHARACTER:
A real, natural photograph of a real moment. Candid, not staged. Natural light. No stock-photo staging, no posed eye contact with the camera, no studio lighting, no heavy colour grading.`;

export function cameraBlock(register: CameraRegister): string {
  if (register === "phone") return PHONE;
  if (register === "dslr") return DSLR;
  return UNSPECIFIED;
}

export const DEFAULT_CAMERA_REGISTER: CameraRegister = "phone";
