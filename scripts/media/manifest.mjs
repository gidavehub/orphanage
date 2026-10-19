// Haven landing-page media manifest — every generated asset, its framing and prompt.
// Generated with Optiq Studio's Vertex models (see README → Regenerating media).
//
// Safeguarding (ToR §15 + per-project waiver): children appear only in dignified,
// hopeful, everyday moments. `child: true` assets are placeholders to replace with
// consented real photography before launch.
//
// People mix (founder, 2026-10-19 meeting, replacing the 2026-10-02 brief): many nationalities,
// "but more Black": at least 40% Black-led; inner-city American families (Chicago, Atlanta);
// some white children, shown within mixed groups so everybody sees Haven is for every child.
// Families are a mother and a father with their children (founder). `eth` tags every
// asset that shows people so `node scripts/media/audit-mix.mjs` can check the balance.

/* ── Style spines ─────────────────────────────────────────────────────── */

export const PHOTO_STYLE =
  "Documentary photograph in The Gambia, West Africa. Warm natural light, dignified and hopeful mood, " +
  "authentic everyday clothing with vibrant West African wax-print fabrics, natural skin texture and real " +
  "detail, shot on a full-frame camera with an 85mm lens, shallow depth of field, rich editorial colour grade. " +
  "No text, no captions, no logos, no watermarks, no borders.";

// Everywhere outside The Gambia: the country and the people are named in each prompt.
export const WORLD_STYLE =
  "Documentary lifestyle photograph. Warm natural golden light, joyful, dignified and hopeful mood, modest " +
  "everyday local clothing, natural skin texture and real detail, shot on a full-frame camera with an 85mm lens, " +
  "shallow depth of field, rich warm editorial colour grade with earthy tones. " +
  "No text, no captions, no logos, no watermarks, no borders.";

// School-context shots: Haven does not run a school, so nothing may read as a school uniform crest.
const NO_CRESTS = " Plain everyday clothes or plain uniforms with no crests, badges, emblems, signs or lettering anywhere.";

// Hero families: large in frame so faces read behind the headline.
const FAMILY_FRAMING = " Medium close shot from the waist up: the family is large in frame and fills the centre of the wide composition.";

export const PORTRAIT_STYLE =
  "Professional studio portrait photograph, waist-up, subject centred and looking into the lens with a warm, " +
  "confident smile. Soft beauty-dish key light, natural skin texture. Plain seamless backdrop as described. " +
  "No text, no logos, no watermarks, no props.";

export const BRUSH_STYLE =
  "Scanned artwork on pure white paper: a single solid black ink brush mark made with a large dry bristle brush, " +
  "high contrast, rough bristle edges and dry-brush streaks, a few ink flecks. Flat pure white background, " +
  "no shadows, no paper texture, no colour, no text.";

export const CHROMA_STYLE =
  "Photorealistic studio photograph isolated on a perfectly flat, evenly lit pure chroma-key green background " +
  "(#00FF00) with no shadows, no gradients and no other objects. Natural skin texture, soft light. No text.";

export const VIDEO_STYLE =
  "Cinematic documentary footage filmed in The Gambia, West Africa. Soft natural golden light, gentle slow camera " +
  "movement only (a slow push-in or a slow lateral drift), one continuous shot with no cuts and no whip pans. " +
  "Realistic people with natural skin texture, dignified, warm and hopeful. Vibrant West African wax-print clothing. " +
  "No text, no captions, no subtitles, no logos, no watermarks. Ambient natural sound only, no music.";

export const WORLD_VIDEO_STYLE =
  "Cinematic documentary footage. Soft natural golden light, gentle slow camera movement only, one continuous shot " +
  "with no cuts and no whip pans. Realistic people with natural skin texture, dignified, warm and hopeful, in modest " +
  "everyday local clothing. No text, no captions, no subtitles, no logos, no watermarks. Ambient natural sound only, no music.";

// "Every Child": one person grows up in a single seamless take (stitched into the manifesto loop).
const GROW =
  "A single continuous locked-off shot with a centred close-up framing on one face the whole time. The same person " +
  "gradually and seamlessly grows up before our eyes in one smooth, gentle morph with no cuts and no fades: ";
const GROW_END = " The face stays large and centred in the frame throughout; the background stays softly blurred and changes gently with each stage of life.";

/* ── Stills ───────────────────────────────────────────────────────────── */

/**
 * @typedef {"black"|"south-asian"|"se-asian"|"arab"|"mixed"} Eth
 * @type {Array<{id:string, aspect:string, size?:"1K"|"2K", kind:"photo"|"world"|"portrait"|"brush"|"chroma", child?:boolean, eth?:Eth, section:string, prompt:string}>}
 */
export const images = [
  // Hero (Donat slider): families from the poorest regions, Black families first, then South Asia,
  // Southeast Asia and the Arab world. Slide 1 is the Gambian family video (hero-1).
  { id: "hero-family-in", aspect: "16:9", size: "2K", kind: "world", child: true, eth: "south-asian", section: "hero",
    prompt: "An Indian family in a rural village in India: a mother in a bright marigold-yellow cotton sari and a father in a simple kurta, with their son and daughter, sitting close together on the doorstep of their modest mud-plastered home, laughing and hugging, a painted blue door heavily blurred behind, warm late-afternoon light." + FAMILY_FRAMING },
  { id: "hero-family-ph", aspect: "16:9", size: "2K", kind: "world", child: true, eth: "se-asian", section: "hero",
    prompt: "A Filipino family in a coastal village in the Philippines: a mother and a father with their three young children, laughing together on the bamboo porch of their simple stilt house, coconut palms and a small fishing boat heavily blurred behind, warm golden light." + FAMILY_FRAMING },
  { id: "hero-family-et", aspect: "16:9", size: "2K", kind: "world", child: true, eth: "black", section: "hero",
    prompt: "An Ethiopian family in a rural highland village in Ethiopia: a mother in a white cotton shawl with a colourful embroidered border and a father in a simple jacket, with their three children, laughing together outside their round thatched home, green terraced hills heavily blurred behind, warm golden light." + FAMILY_FRAMING },
  { id: "hero-family-pk", aspect: "16:9", size: "2K", kind: "world", child: true, eth: "south-asian", section: "hero",
    prompt: "A Pakistani family in a village in Punjab, Pakistan: a mother in a colourful shalwar kameez with a dupatta over her hair and a father in a cream shalwar kameez, with their son and daughter, smiling together in their brick courtyard beside a woven charpai bed, wheat fields heavily blurred behind, warm golden light." + FAMILY_FRAMING },
  { id: "hero-family-kh", aspect: "16:9", size: "2K", kind: "world", child: true, eth: "se-asian", section: "hero",
    prompt: "A Cambodian family in a rural village in Cambodia: a mother and a father with their two young children and a grandmother, smiling together on the wooden steps of their stilt house, rice paddies and sugar palms heavily blurred behind, warm golden light." + FAMILY_FRAMING },
  // Inner-city American families (founder, 2026-10-19): Chicago and Atlanta.
  { id: "hero-family-chicago", aspect: "16:9", size: "2K", kind: "world", child: true, eth: "black", section: "hero",
    prompt: "An African-American family in an inner-city neighbourhood of Chicago, Illinois, United States: a mother in a warm knit sweater and a father in a navy jacket, with their son of about nine and their daughter of about six, laughing and hugging together on the front steps of their red-brick two-flat apartment building, a tree-lined city street with parked cars and an elevated train line heavily blurred behind, crisp autumn golden light. Everyone in the family is Black. No signs, street names, lettering or logos anywhere." + FAMILY_FRAMING },
  { id: "hero-family-atlanta", aspect: "16:9", size: "2K", kind: "world", child: true, eth: "black", section: "hero",
    prompt: "An African-American family in a neighbourhood of Atlanta, Georgia, United States: a mother with natural curly hair in a bright yellow blouse and a father in a crisp white shirt, with their son of about fourteen and their daughter of about three on her father's hip, smiling together on the wooden front porch of their modest craftsman bungalow, tall green trees heavily blurred behind, warm late-afternoon light. Everyone in the family is Black. No signs, lettering or logos anywhere." + FAMILY_FRAMING },
  // Every child, every age (founder, 2026-10-19): "a whole nationality of just children, different
  // ages… from six months on up to 21", some white children among them, "but more Black".
  { id: "hero-children-world", aspect: "16:9", size: "2K", kind: "world", child: true, eth: "mixed", section: "hero",
    prompt: "A joyful group portrait of eleven children and young people of many different backgrounds and every age, gathered closely together on the grass of a sunny city park in Toronto, Canada: a Black West African young woman of about twenty-one holding a smiling Black baby of about six months, a Black toddler of about two, an African-American girl of about seven, a Black boy of about ten, a Black teenage boy of about seventeen, an Indian girl of about nine, an Arab boy of about twelve, a Latina girl of about thirteen, a white boy of about eight with freckles and a white girl of about five with blonde pigtails. Most of the group are Black, and every child looks clearly different from the others. They are laughing and leaning into one another with arms around shoulders, everyday modern clothes in bright colours, warm golden light, trees softly blurred behind. No text, logos or lettering anywhere. Medium wide shot: the group is large in frame and fills the centre of the wide composition, every face clearly visible." },
  { id: "hero-family-ye", aspect: "16:9", size: "2K", kind: "world", child: true, eth: "arab", section: "hero",
    prompt: "A Yemeni family in Yemen: a mother in a dark abaya with a colourful headscarf framing her smiling face and a father in a white thobe with a patterned shawl over his shoulder, with their son and daughter, smiling warmly together in the doorway of their old mudbrick home with carved wooden windows, warm golden light. No daggers, belts with blades or weapons of any kind." + FAMILY_FRAMING },

  // About (brush-masked)
  { id: "about", aspect: "1:1", kind: "photo", child: true, eth: "black", section: "about",
    prompt: "A joyful Gambian schoolboy of about eight laughing with his mouth open as he runs toward the camera with a friend just behind him, both in school uniforms with small backpacks, golden hour backlight glowing on dust in the air, village path softly blurred." + NO_CRESTS },

  // Volunteer / partner duo cards (tinted overlays)
  { id: "duo-volunteer", aspect: "16:9", kind: "photo", eth: "black", section: "duo",
    prompt: "Four Gambian adult volunteers, all Black West African men and women (two women in colourful head wraps, two men), in matching plain green T-shirts unpacking boxes of exercise books and school bags on a table in a community courtyard in The Gambia, smiling and talking, bright midday light. Every person in frame is Black West African." },
  { id: "duo-partner", aspect: "16:9", kind: "world", eth: "mixed", section: "duo",
    prompt: "Two adult professionals, an Indian woman in a smart kurta and an Arab man in a crisp shirt, shaking hands warmly across a wooden table in a bright community office with documents and a laptop." },

  // Programme appeals (Donat cause cards); place codes live in content/home.ts → appeals.
  { id: "appeal-education", aspect: "4:3", kind: "photo", child: true, eth: "black", section: "appeals",
    prompt: "Eager Gambian primary-school children in plain light-blue clothes at simple wooden desks in a sunlit classroom in The Gambia, raising their hands with big smiles, their smiling teacher in a colourful head wrap slightly out of focus in the foreground. The chalkboard shows only simple chalk drawings of shapes and numbers, no words. Everyone in the classroom is Black West African." + NO_CRESTS },
  { id: "appeal-medical", aspect: "4:3", kind: "world", child: true, eth: "se-asian", section: "appeals",
    prompt: "A friendly Cambodian nurse in a white coat gently checking a smiling seven-year-old Cambodian girl's heartbeat with a stethoscope at a clean village health centre in Cambodia while the girl's mother watches beside her." },
  { id: "appeal-counselling", aspect: "4:3", kind: "world", child: true, eth: "arab", section: "appeals",
    prompt: "A calm, kind female counsellor in a soft headscarf sitting on a low bench beside an Arab girl of about ten in a quiet sunlit room in Jordan, listening attentively as the girl talks and begins to smile, soft cushions and a small plant, warm and private atmosphere." + NO_CRESTS },
  { id: "appeal-ramadan", aspect: "4:3", kind: "world", child: true, eth: "south-asian", section: "appeals",
    prompt: "At sunset during Ramadan in a village in Bangladesh, volunteers in modest clothing hand boxed food packs of rice, dates, lentils and cooking oil to smiling mothers in colourful saris with their heads covered and their children, lanterns glowing softly, warm golden light. No text on the boxes." },
  { id: "appeal-eid", aspect: "4:3", kind: "photo", child: true, eth: "black", section: "appeals",
    prompt: "Joyful Gambian children dressed in bright new Eid clothes, girls in colourful embroidered dresses with matching head scarves and boys in crisp kaftans and caps, smiling and holding small wrapped gifts in a sunlit family compound." },
  { id: "appeal-christmas", aspect: "4:3", kind: "world", child: true, eth: "se-asian", section: "appeals",
    prompt: "In a simple community chapel hall in a village in the Philippines, decorated with a glowing star-shaped parol lantern and soft string lights, smiling Filipino volunteers hand wrapped gift boxes to happy Filipino children, cosy festive atmosphere. No text or lettering anywhere." },
  { id: "appeal-thanksgiving", aspect: "4:3", kind: "world", child: true, eth: "black", section: "appeals",
    prompt: "At an autumn community food drive in the United States, smiling African-American volunteers hand a basket of fresh vegetables, bread and a pie to a grateful African-American mother and father with their young daughter, orange autumn leaves, warm light. Everyone in the scene is Black. No banners, signs or lettering anywhere." },
  { id: "appeal-sponsor", aspect: "4:3", kind: "photo", child: true, eth: "black", section: "appeals",
    prompt: "A smiling Gambian caretaker and a group of happy children of different ages sitting together on a woven mat in the courtyard of a modest children's home, sharing a meal of rice from a large bowl, warm afternoon light." },

  // Pinned focus slides (VU full-bleed): one region per theme. Protection is the Gambian clip (focus-1).
  { id: "focus-2", aspect: "16:9", size: "2K", kind: "world", child: true, eth: "south-asian", section: "focus",
    prompt: "A smiling Indian girl of about nine in a simple cotton dress walking along a red dirt road in rural India toward school, a cloth book bag over her shoulder and exercise books held against her chest, a small simple school building in the far distance ahead among green fields under a wide sky, morning golden light with dust softly glowing, hopeful and determined. Wide composition with the girl on the right third." + NO_CRESTS },
  { id: "focus-4", aspect: "16:9", size: "2K", kind: "photo", child: true, eth: "black", section: "focus",
    prompt: "Two friendly Gambian police officers, a Black West African woman and a Black West African man in neat light-blue police shirts and dark trousers with no visible lettering or insignia, standing at the front of a sunlit primary classroom in The Gambia, smiling and talking with attentive, happy Gambian children seated at wooden desks, several raising their hands to ask questions, their teacher in a colourful head wrap watching from the side. Reassuring and approachable, no weapons visible. Everyone in the classroom is Black West African. Wide composition." + NO_CRESTS },

  // CTA floating hands (keyed to alpha)
  { id: "hand-left", aspect: "16:9", kind: "chroma", section: "doors",
    prompt: "A single adult human hand and forearm entering from the LEFT edge of the frame, palm facing up and cupped open as if offering or receiving, fingers relaxed, the forearm cut off by the left edge of the frame, medium-brown skin tone." },
  { id: "hand-right", aspect: "16:9", kind: "chroma", section: "doors",
    prompt: "A single adult human hand and forearm entering from the RIGHT edge of the frame, palm facing up and cupped open as if offering or receiving, fingers relaxed, the forearm cut off by the right edge of the frame, light-brown skin tone." },

  // Founder / success story (placeholder until the founder's portrait arrives)
  { id: "founder", aspect: "4:3", kind: "photo", child: true, eth: "black", section: "founder",
    prompt: "A focused Gambian boy of about ten in an orange vest sitting cross-legged on sandy ground reading a small book, a group of other children sitting and reading softly blurred behind him outdoors, warm late afternoon light." },

  // Team (Donat arch cards). CLIENT: placeholders until the real team's portraits arrive.
  { id: "team-1", aspect: "3:4", kind: "portrait", eth: "black", section: "team", prompt: "A Gambian woman in her thirties with a mustard-yellow head wrap and a matching blouse, arms crossed. Backdrop: plain light grey." },
  { id: "team-2", aspect: "3:4", kind: "portrait", eth: "south-asian", section: "team", prompt: "An Indian man in his late twenties with short dark hair and a light blue short-sleeved shirt, giving a friendly thumbs up. Backdrop: plain light grey." },
  { id: "team-3", aspect: "3:4", kind: "portrait", eth: "south-asian", section: "team", prompt: "A Pakistani woman in her twenties with long dark hair loosely covered by a soft orange dupatta, arms crossed, cheerful. Backdrop: plain light grey." },
  { id: "team-4", aspect: "3:4", kind: "portrait", eth: "black", section: "team", prompt: "A Gambian man in his forties with a neat beard wearing a grey blazer over a white T-shirt. Backdrop: plain light grey." },
  { id: "team-5", aspect: "3:4", kind: "portrait", eth: "se-asian", section: "team", prompt: "A Filipino woman in her forties wearing a green blouse and small gold earrings, kind smile. Backdrop: plain light grey." },
  { id: "team-6", aspect: "3:4", kind: "portrait", eth: "arab", section: "team", prompt: "A young Arab man in his twenties with short dark hair and a short neat beard wearing a denim shirt, relaxed smile. Backdrop: plain light grey." },

  // Restoring hope (B&W, Donat "needy people")
  { id: "restoring-bw", aspect: "4:3", kind: "world", eth: "south-asian", section: "restoring",
    prompt: "Black-and-white documentary portrait of a Bangladeshi brother and sister in their early twenties sitting close together, heads nearly touching, calm and resilient expressions looking into the camera, softly blurred village houses and trees behind them. Monochrome, rich tonal range." },

  // Testimonials
  { id: "testimonial-1", aspect: "3:4", kind: "photo", eth: "black", section: "testimonials",
    prompt: "Close-up of a Gambian mother's hands, in a colourful wax-print sleeve, holding a child's new exercise book and pencil on her lap, warm light, no face visible." },
  { id: "testimonial-2", aspect: "3:4", kind: "portrait", eth: "south-asian", section: "testimonials", prompt: "An Indian woman in her thirties wearing glasses and a soft yellow kurta, arms crossed, warm smile. Backdrop: plain warm marigold yellow." },
  { id: "testimonial-3", aspect: "3:4", kind: "portrait", eth: "se-asian", section: "testimonials", prompt: "A Filipino man in his twenties wearing a light grey hoodie, calm friendly expression. Backdrop: plain light grey." },
  { id: "testimonial-4", aspect: "3:4", kind: "portrait", eth: "south-asian", section: "testimonials", prompt: "A Pakistani female doctor in her forties in a white coat with a stethoscope around her neck and a soft headscarf, reassuring smile. Backdrop: plain pale mint green." },
  { id: "testimonial-5", aspect: "3:4", kind: "portrait", eth: "black", section: "testimonials", prompt: "An African-American woman in her fifties with short natural grey hair, wearing a soft rust-orange cardigan, arms crossed, warm smile. Backdrop: plain warm sand beige." },
  { id: "testimonial-6", aspect: "3:4", kind: "portrait", eth: "arab", section: "testimonials", prompt: "An Arab man in his forties with a neatly trimmed beard, wearing a navy sweater over a white collared shirt, calm friendly smile. Backdrop: plain light grey." },

  // Stories capsules (VU); place codes live in content/people.ts → stories.
  { id: "story-1", aspect: "3:4", kind: "photo", child: true, eth: "black", section: "stories", prompt: "A Gambian mother in a bright head wrap hugging her smiling school-age daughter outdoors, both looking at the camera, lush green garden behind." },
  { id: "story-2", aspect: "3:4", kind: "world", child: true, eth: "south-asian", section: "stories", prompt: "A proud Indian grandfather with a white moustache in a simple white kurta sitting on a woven charpai with two smiling grandchildren leaning on his shoulders in front of his village home in India." },
  { id: "story-3", aspect: "3:4", kind: "world", eth: "se-asian", section: "stories", prompt: "A young Filipino volunteer teacher holding an open picture book to her chest, smiling in a bright classroom doorway in the Philippines." + NO_CRESTS },
  { id: "story-4", aspect: "3:4", kind: "world", eth: "south-asian", section: "stories", prompt: "A nineteen-year-old Pakistani young woman with a soft dupatta over her hair and a light blue kameez, gentle confident smile, portrait in soft window light." },
  { id: "story-5", aspect: "3:4", kind: "world", eth: "se-asian", section: "stories", prompt: "An Indonesian school nurse in a light blue hijab and light blue scrubs with a stethoscope, warm smile, standing in a school courtyard in Indonesia." + NO_CRESTS },
  { id: "story-6", aspect: "3:4", kind: "photo", eth: "black", section: "stories", prompt: "A respected Gambian community elder with a grey beard and an embroidered cap, dignified portrait under a tree." },
  { id: "story-7", aspect: "3:4", kind: "photo", child: true, eth: "black", section: "stories", prompt: "A Gambian father carrying his small son on his shoulders, both laughing, village street in soft evening light." },
  { id: "story-8", aspect: "3:4", kind: "world", eth: "arab", section: "stories", prompt: "A Yemeni clinic nurse in a white coat and a dark headscarf holding a box of medical supplies, smiling in a clean clinic storeroom." },
  { id: "story-9", aspect: "3:4", kind: "world", eth: "south-asian", section: "stories", prompt: "A young Bangladeshi man in his twenties, a youth mentor in a green T-shirt, smiling on a football field at sunset in Bangladesh." },

  // Journey: "How We Reach Every Child". Steps 1–2 are the founder's own Gambia visits; 3–5 reach further.
  { id: "journey-outreach", aspect: "3:4", kind: "photo", eth: "black", section: "journey", prompt: "Two Gambian outreach workers with notebooks and shoulder bags walking along a sandy village path toward a cluster of homes, greeting a mother and father standing at their compound gate, warm morning light." },
  { id: "journey-orphanage", aspect: "3:4", kind: "photo", child: true, eth: "black", section: "journey", prompt: "A respected older Gambian man in a white kaftan and cap sitting with the director of a modest children's home and a teacher in its courtyard, talking warmly over a notebook, children playing softly blurred in the background." },
  { id: "journey-verify", aspect: "3:4", kind: "world", eth: "arab", section: "journey", prompt: "A programme officer at an office desk on a video call on her laptop with the smiling director of a children's home in Jordan, the director in a soft headscarf clearly visible on the laptop screen, warm daylight, a notebook and folder on the desk." },
  { id: "journey-needs", aspect: "3:4", kind: "world", eth: "se-asian", section: "journey", prompt: "A Filipino community worker with a notebook visiting a family's home in a village in the Philippines, talking warmly with a grandmother seated on a bamboo bench while two children look on." },
  { id: "journey-give", aspect: "3:4", kind: "world", child: true, eth: "south-asian", section: "journey", prompt: "Adult volunteers carrying sacks of rice and boxes of school supplies through the gate of a modest children's home in Bangladesh, a smiling caretaker in a sari welcoming them, children waving in the courtyard, warm midday light." + NO_CRESTS },

  // Recent projects (Donat hover-label cards)
  { id: "project-1", aspect: "1:1", kind: "photo", child: true, eth: "black", section: "projects", prompt: "Three smiling Gambian schoolboys shaking hands and laughing together in a schoolyard, playful friendship, bright daylight." + " Plain painted walls in the background." + NO_CRESTS },
  { id: "project-2", aspect: "1:1", kind: "world", child: true, eth: "south-asian", section: "projects", prompt: "An Indian mother in a sari and her daughter reading a book together at a table, the girl writing in an exercise book, warm yellow wall behind." },
  { id: "project-3", aspect: "1:1", kind: "world", eth: "se-asian", section: "projects", prompt: "A Filipino health worker in a blue uniform taking the blood pressure of a smiling woman at an outdoor community health day in the Philippines." },

  // FAQ (Donat collage)
  { id: "faq-main", aspect: "4:3", kind: "world", child: true, eth: "south-asian", section: "faq", prompt: "Two cheerful Pakistani boys grinning at the camera, one holding a worn football, dusty playground and warm afternoon light behind them." },
  { id: "faq-bw", aspect: "1:1", kind: "world", child: true, eth: "se-asian", section: "faq", prompt: "Black-and-white portrait of a calm Filipino girl of about eight with straight dark hair and a soft, gentle smile, looking into the camera, softly blurred background. Monochrome." },
  { id: "faq-heart", aspect: "1:1", kind: "photo", child: true, eth: "black", section: "faq", prompt: "Black-and-white photograph of a happy small child playing with building blocks on a mat, seen from slightly above. Monochrome." },

  // News
  { id: "news-1", aspect: "4:3", kind: "photo", child: true, eth: "black", section: "news", prompt: "Gambian children in school uniforms with backpacks walking happily together along a sunny village road toward school." + NO_CRESTS },
  { id: "news-2", aspect: "4:3", kind: "world", eth: "south-asian", section: "news", prompt: "A safeguarding training workshop in India: a group of Indian adult volunteers seated in a circle listening to a facilitator beside a flip chart that shows only simple drawings, no words, bright room." },
  { id: "news-3", aspect: "4:3", kind: "world", eth: "south-asian", section: "news", prompt: "A busy community health day under white tents in a village in Bangladesh, nurses talking with families in colourful clothing, midday light. No text or signs." },

  // Brush plates (traced to SVG with potrace)
  { id: "brush-corner", aspect: "16:9", kind: "brush", section: "art", prompt: "One large diagonal dry-brush sweep rising from the bottom-left corner toward the upper right, breaking into ragged fragments and small flecks at its top edge." },
  { id: "brush-patch", aspect: "1:1", kind: "brush", section: "art", prompt: "One bold, roughly square patch of paint made with several overlapping vertical dry-brush strokes, ragged bristle edges on every side, a few streaks trailing off the right side." },
  { id: "brush-band", aspect: "21:9", kind: "brush", section: "art", prompt: "One long horizontal band of paint spanning the full width, the top edge torn and ragged with dry-brush streaks, the bottom edge straight at the bottom of the image." },
  { id: "brush-strip", aspect: "9:16", kind: "brush", section: "art", prompt: "One tall vertical dry-brush stroke running the full height, with a ragged, streaky left edge that breaks into fragments." },
  { id: "brush-label", aspect: "16:9", kind: "brush", section: "art", prompt: "One thick horizontal paint swipe made with a wide dry brush, solid on the left and breaking into dry streaks and bristle marks on the right end." },
  { id: "brush-splash", aspect: "1:1", kind: "brush", section: "art", prompt: "One dramatic paint splash sweeping diagonally from top-left to bottom-right, with spiky streaks and fragments along its edges." },
  { id: "brush-strokes", aspect: "1:1", kind: "brush", section: "art", prompt: "Three loose parallel diagonal dry-brush strokes of different lengths, streaky and textured, with gaps between the bristle marks." },
  { id: "brush-edge", aspect: "9:16", kind: "brush", section: "art", prompt: "One tall vertical strip of paint on the right side with a jagged, torn, streaky left edge made by a dry brush dragged downward." },
  { id: "brush-drip", aspect: "3:4", kind: "brush", section: "art", prompt: "One energetic paint splat with long streaks shooting downward and to the right, like a brush flicked hard at the paper." },
  { id: "brush-torn", aspect: "21:9", kind: "brush", section: "art", prompt: "A horizontal strip of torn paper edge shape: solid black across the top two-thirds, the bottom edge irregular and softly torn with tiny fibres." },
];

/* ── Video ────────────────────────────────────────────────────────────── */

/**
 * `style: "world"` uses WORLD_VIDEO_STYLE; `stitch` clips are joined by stitch.mjs instead of
 * being published one by one.
 * @type {Array<{id:string, aspect:"16:9"|"9:16", child?:boolean, eth?:Eth, style?:"world", stitch?:string, trimStart?:number, section:string, scene:string}>}
 */
export const videos = [
  { id: "hero-1", aspect: "16:9", child: true, eth: "black", section: "hero",
    // Exactly four people, each dressed differently: an earlier take cloned the mother and grandmother
    // (same dress, same head wrap) and dressed two toddlers as twins.
    scene: "A slow push-in on a Gambian family of exactly four people sitting close together on a wooden bench in a sunlit village compound: a mother in her thirties wearing a plain marigold-yellow head wrap and a deep blue dress, a father in a cream kaftan and a dark embroidered cap, their daughter of about eight in a green and white patterned dress with braided hair, and their son of about five in a plain red T-shirt. The four look clearly different from one another, each in different clothing and colours; there is only one woman in the scene. They laugh and hug, then smile warmly at the camera; mango trees softly blurred behind." },

  // "Every Child" manifesto loop: four children grow up into their jobs (stitch.mjs → manifesto.mp4).
  { id: "grow-gm", aspect: "16:9", style: "world", stitch: "manifesto", child: true, eth: "black", section: "manifesto",
    scene: GROW + "first a laughing Gambian toddler boy of about three in a sunlit village compound, then a smiling schoolboy of about ten with a book bag strap on his shoulder, then a confident teenager, and finally a proud Gambian man in his late twenties wearing a white hard hat and a high-visibility vest as a civil engineer, smiling at the camera on a construction site." + GROW_END },
  { id: "grow-in", aspect: "16:9", style: "world", stitch: "manifesto", child: true, eth: "south-asian", section: "manifesto",
    scene: GROW + "first a giggling Indian toddler girl of about three with small gold earrings in a village courtyard in India, then a smiling schoolgirl of about ten with neat braids, then a focused university student, and finally a confident Indian woman in her late twenties as a doctor in a white coat with a stethoscope around her neck, smiling at the camera in a bright hospital corridor." + GROW_END },
  { id: "grow-ph", aspect: "16:9", style: "world", stitch: "manifesto", child: true, eth: "se-asian", section: "manifesto",
    scene: GROW + "first a cheerful Filipino toddler girl of about three on a bamboo porch in a village in the Philippines, then a smiling schoolgirl of about ten holding exercise books, then a bright teenager, and finally a warm Filipino woman in her late twenties as a teacher standing in front of a sunlit classroom, smiling at the camera." + GROW_END },
  { id: "grow-ye", aspect: "16:9", style: "world", stitch: "manifesto", child: true, eth: "arab", section: "manifesto",
    scene: GROW + "first a laughing Arab toddler boy of about three in the doorway of a mudbrick home in Yemen, then a smiling schoolboy of about ten, then a thoughtful teenager, and finally a kind Arab man in his late twenties as a nurse in teal hospital scrubs, smiling at the camera in a clean clinic." + GROW_END },

  { id: "focus-1", aspect: "16:9", child: true, eth: "black", section: "focus",
    scene: "In a leafy community courtyard, a kind female child-protection officer crouches to eye level and talks gently with a smiling girl of about eight wearing a plain everyday dress with no badges, emblems or lettering; the girl nods and laughs; slow push-in." },
  { id: "focus-3", aspect: "16:9", child: true, eth: "black", section: "focus",
    scene: "Beside a plain white mobile-clinic van with no writing on it, parked at the edge of a village schoolyard in The Gambia, a smiling Black Gambian nurse in light-blue scrubs kneels to gently listen to a young Gambian boy's heartbeat with a stethoscope while a second Black Gambian nurse in a white coat talks cheerfully with a small group of Gambian children waiting their turn; mango trees behind; slow lateral drift. Everyone in the scene is Black West African. No signs, lettering or logos anywhere." },
  { id: "donate", aspect: "16:9", style: "world", child: true, eth: "mixed", section: "donate",
    scene: "Children of many different backgrounds come walking from three different dirt roads that meet at a sunny crossroads, wave and smile as they meet, then walk on together side by side as one group toward the open doors of a welcoming community centre with a warm painted wall: a Black West African boy and girl, an African-American girl, a Black teenage boy, an Indian girl, an Arab boy and a white boy with freckles, aged from about six to sixteen, all carrying school bags. Most of the children are Black. Warm golden afternoon light. No signs, lettering or logos anywhere. Slow wide tracking shot following the group." },
  { id: "join", aspect: "16:9", style: "world", trimStart: 1, eth: "se-asian", section: "join",
    scene: "A close-up portrait of a young Filipino woman in her twenties, her face centred in the frame, looking calmly and steadily into the camera with a slow blink and a faint smile; people softly blurred behind her in a sunlit village. Almost still camera with a very slow push-in." },
  { id: "film", aspect: "16:9", eth: "black", section: "restoring",
    scene: "Gambian adult volunteers, every one of them Black West African men and women, in plain green T-shirts hand boxes of school supplies and backpacks to smiling Gambian families in a sandy community courtyard in The Gambia; a mother in a wax-print dress hugs her son who holds up a new backpack; slow lateral drift along the line. Every person in frame is Black West African. No signs, no lettering, no logos anywhere." },
];
