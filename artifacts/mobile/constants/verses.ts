export interface BibleVerse {
  ref: string;
  text: string;
  category: string;
}

export const BIBLE_VERSES: BibleVerse[] = [
  { ref: "John 3:16", text: "For God so loved the world that he gave his one and only Son, that whoever believes in him shall not perish but have eternal life.", category: "Love" },
  { ref: "1 John 4:3", text: "But every spirit that does not acknowledge Jesus is not from God. This is the spirit of the antichrist, which you have heard is coming and even now is already in the world.", category: "Faith" },
  { ref: "Psalm 23:1", text: "The Lord is my shepherd, I lack nothing.", category: "Comfort" },
  { ref: "Philippians 4:13", text: "I can do all this through him who gives me strength.", category: "Strength" },
  { ref: "Romans 8:28", text: "And we know that in all things God works for the good of those who love him, who have been called according to his purpose.", category: "Hope" },
  { ref: "Proverbs 3:5", text: "Trust in the Lord with all your heart and lean not on your own understanding.", category: "Wisdom" },
  { ref: "Jeremiah 29:11", text: "For I know the plans I have for you, declares the Lord, plans to prosper you and not to harm you, plans to give you hope and a future.", category: "Hope" },
  { ref: "Isaiah 40:31", text: "But those who hope in the Lord will renew their strength. They will soar on wings like eagles; they will run and not grow weary, they will walk and not be faint.", category: "Strength" },
  { ref: "Matthew 6:33", text: "But seek first his kingdom and his righteousness, and all these things will be given to you as well.", category: "Faith" },
  { ref: "Psalm 46:1", text: "God is our refuge and strength, an ever-present help in trouble.", category: "Comfort" },
  { ref: "1 Corinthians 2:3", text: "I came to you in weakness with great fear and trembling.", category: "Humility" },
  { ref: "Galatians 5:22", text: "But the fruit of the Spirit is love, joy, peace, forbearance, kindness, goodness, faithfulness.", category: "Character" },
  { ref: "Ephesians 2:8", text: "For it is by grace you have been saved, through faith—and this is not from yourselves, it is the gift of God.", category: "Grace" },
  { ref: "2 Timothy 1:7", text: "For the Spirit God gave us does not make us timid, but gives us power, love and self-discipline.", category: "Courage" },
  { ref: "Hebrews 11:1", text: "Now faith is confidence in what we hope for and assurance about what we do not see.", category: "Faith" },
  { ref: "James 1:17", text: "Every good and perfect gift is from above, coming down from the Father of the heavenly lights, who does not change like shifting shadows.", category: "Gratitude" },
  { ref: "1 Peter 5:7", text: "Cast all your anxiety on him because he cares for you.", category: "Comfort" },
  { ref: "Psalm 119:105", text: "Your word is a lamp for my feet, a light on my path.", category: "Scripture" },
  { ref: "Matthew 28:19", text: "Therefore go and make disciples of all nations, baptizing them in the name of the Father and of the Son and of the Holy Spirit.", category: "Mission" },
  { ref: "John 14:6", text: "Jesus answered, I am the way and the truth and the life. No one comes to the Father except through me.", category: "Salvation" },
  { ref: "Romans 5:8", text: "But God demonstrates his own love for us in this: While we were still sinners, Christ died for us.", category: "Love" },
  { ref: "Proverbs 22:6", text: "Start children off on the way they should go, and even when they are old they will not turn from it.", category: "Wisdom" },
  { ref: "Psalm 27:1", text: "The Lord is my light and my salvation—whom shall I fear? The Lord is the stronghold of my life—of whom shall I be afraid?", category: "Courage" },
  { ref: "Isaiah 41:10", text: "So do not fear, for I am with you; do not be dismayed, for I am your God. I will strengthen you and help you; I will uphold you with my righteous right hand.", category: "Comfort" },
];

export const VERSE_CATEGORIES = [...new Set(BIBLE_VERSES.map(v => v.category))];
