/**
 * How each shot is framed.
 *
 * Six images of the same subject taken from the same distance at the same
 * height are six copies, whatever the scene says. A real photographer covering
 * a job moves: a wide establishing frame, then close on the hands, then one
 * from the doorway. That variety is most of what separates a set of photos
 * from a set of renders.
 *
 * Dealt from a shuffled deck like scenes, so a batch uses every framing once
 * before repeating any.
 */

export interface Framing {
  id: string;
  text: string;
}

export const FRAMINGS: Framing[] = [
  {
    id: "wide_context",
    text: "Wide establishing frame. The whole space is visible and the subject occupies perhaps a third of it. Shot from standing height, a few steps back.",
  },
  {
    id: "close_hands",
    text: "Close on the hands and what they are working on, from about arm's length. The person's face may be out of frame entirely. Shallow enough that the background falls away naturally.",
  },
  {
    id: "over_shoulder",
    text: "From just behind and slightly above the subject's shoulder, looking at what they are looking at.",
  },
  {
    id: "low_angle",
    text: "Low, from around knee height, looking slightly up. The kind of angle you get crouching to see something properly.",
  },
  {
    id: "doorway",
    text: "From a doorway or the far side of the room, with some of the near wall or door frame in shot. The subject is unaware of the camera.",
  },
  {
    id: "detail",
    text: "Tight on the equipment itself, a gauge, a fitting, a label. The person is present only as a hand or a sleeve at the edge of frame, or not at all.",
  },
  {
    id: "shoulder_height_side",
    text: "From the side at shoulder height, a normal standing distance away, the subject in profile and mid-task.",
  },
];

/**
 * Framings for a batch, each used once before any repeats.
 *
 * Takes its own random source so a test can pin the order.
 */
export function selectFramings(count: number, random: () => number = Math.random): Framing[] {
  const out: Framing[] = [];

  while (out.length < count) {
    const deck = [...FRAMINGS];
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [deck[i], deck[j]] = [deck[j]!, deck[i]!];
    }
    for (const framing of deck) {
      if (out.length >= count) break;
      out.push(framing);
    }
  }

  return out;
}
