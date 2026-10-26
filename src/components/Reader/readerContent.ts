/** One rendered page of the book. The reader has no document engine yet, so
 *  the pages below stand in for whatever the Rust side will extract later. */
export interface ReaderPage {
  page: number;
  /** Set only on the first page of a chapter. */
  heading?: string;
  paragraphs: string[];
}

export interface TocEntry {
  title: string;
  page: number;
}

export const READER_PAGES: ReaderPage[] = [
  {
    page: 1,
    heading: "One · The 7:52",
    paragraphs: [
      "The 7:52 is late again. I know it before the announcer says so, because the man in the grey coat is still standing at the edge of the platform, checking his watch with the patience of someone who has nowhere in particular to be.",
      "I take the seat by the window, the one that faces the river, and put my bag on the empty seat beside me so that nobody will sit there. It is a small, petty defence and it works. The train pulls out, the houses slide away, and for eleven minutes I am nobody's wife, nobody's daughter, nobody's problem.",
    ],
  },
  {
    page: 2,
    paragraphs: [
      "At Hammersmith the carriage fills with the usual crowd: nurses finishing a night shift, a boy with a cello case too big for the aisle, two women arguing quietly about a wedding. I keep my eyes on the water.",
      "I have counted the bridges so often that I could draw them from memory — the way the light falls on the third one, the little garden that appears for eight seconds between the trees, the house with the green door that no one ever seems to leave.",
    ],
  },
  {
    page: 3,
    heading: "Two · The House With the Green Door",
    paragraphs: [
      "Number fifteen is much like the other houses along the terrace: Victorian semi-detached, two storeys, a narrow garden at the front and a strip of gravel where a car should be. There is a bicycle leaning against the wall, rusted at the chain, and a window box that has been dead since August.",
      "But the curtains are new. That is the thing I notice first, every morning, before I have finished my coffee. Last week they were cream; this week they are the colour of dark tea, and they are drawn at an hour when nobody sensible is still in bed.",
    ],
  },
  {
    page: 4,
    paragraphs: [
      "I tell myself that this is what people do. They buy curtains. They redecorate. They move a lamp from one corner to another and call it a fresh start. None of it has anything to do with me.",
      "And yet I find myself leaning forward as the train slows, counting the windows, checking which rooms are lit. It takes four seconds to pass the house. Four seconds, twice a day, five days a week. It should not add up to a life, but somehow it does.",
    ],
  },
  {
    page: 5,
    heading: "Three · What the Neighbour Saw",
    paragraphs: [
      "The woman at number seventeen is in her garden again, in a dressing gown, smoking with the particular defiance of someone who has been told to stop. She looks up as the train goes by. For a moment I am certain she is looking at me.",
      "That is the trouble with watching. Eventually you cannot tell any more whether you are the one doing it. The glass throws my own face back at me, and for a second the reflection is a stranger: a woman in a good coat, with a good job waiting for her at the other end of the line, who has not spoken to another person in three days.",
    ],
  },
  {
    page: 6,
    heading: "Four · Number Fifteen",
    paragraphs: [
      "On Friday the green door is open. Not ajar, not swinging — open, held back by a brick, the way you would on a day when you were expecting a delivery and did not want to keep getting up.",
      "The train slows. Four seconds. I see a woman in the hallway, her back to the window, her hand raised as if she is about to knock on a door inside her own house. Then the trees close over the gap and she is gone, and I am left with the taste of something I cannot name.",
    ],
  },
];

export const TABLE_OF_CONTENTS: TocEntry[] = [
  { title: "One · The 7:52", page: 1 },
  { title: "Two · The House With the Green Door", page: 3 },
  { title: "Three · What the Neighbour Saw", page: 5 },
  { title: "Four · Number Fifteen", page: 6 },
];
