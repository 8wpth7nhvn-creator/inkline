/* Inkline in English or Dutch. The pages are written in English; in Dutch, every piece of interface text
   is swapped for its translation as it appears on screen, so layouts, animations and features stay exactly
   the same. The visitor's CV, their typed text and the CV previews are never touched.
   The choice is remembered on this device; ?lang=nl or ?lang=en in a link also sets it. */
(function (global) {
  'use strict';
  const KEY = 'inkline:lang';
  function chosen() {
    try {
      const fromLink = new URLSearchParams(location.search).get('lang');
      if (fromLink === 'nl' || fromLink === 'en') { localStorage.setItem(KEY, fromLink); return fromLink; }
      const saved = localStorage.getItem(KEY);
      if (saved === 'nl' || saved === 'en') return saved;
    } catch (e) { /* storage blocked: fall back to the browser's language */ }
    return /^nl\b/i.test(navigator.language || '') ? 'nl' : 'en';
  }
  const lang = chosen();
  document.documentElement.lang = lang;

  // English (with spaces tidied) -> Dutch
  const NL = {
    // ---------- shared ----------
    'Inkline home': 'Inkline homepage', 'Privacy': 'Privacy', 'Start my CV': 'Start mijn cv', 'Make it with AI': 'Maak het met AI',

    // ---------- home page ----------
    'Inkline · The AI CV maker that asks the right questions': 'Inkline · De AI-cv-maker die de juiste vragen stelt',
    'Make your CV with AI, or fill in a beautiful template yourself. Add your photo, pick from 20 designs and download your PDF free. No card, no watermark.': 'Maak je cv met AI, of vul zelf een mooi sjabloon in. Voeg je foto toe, kies uit 20 ontwerpen en download je pdf gratis. Geen creditcard, geen watermerk.',
    'Skip to content': 'Naar de inhoud', 'How it works': 'Hoe het werkt', 'Designs': 'Ontwerpen', 'Questions': 'Vragen',
    'Inkline · The AI CV maker': 'Inkline · De AI-cv-maker',
    "Don't know what to write?": 'Geen idee wat je moet schrijven?',
    "Most people don't. You just need someone to ask the right questions.": 'De meeste mensen niet. Je hebt gewoon iemand nodig die de juiste vragen stelt.',
    'So just talk.': 'Dus vertel gewoon.',
    'Our AI asks easy questions, one at a time, like a good recruiter would.': 'Onze AI stelt makkelijke vragen, één voor één, zoals een goede recruiter dat doet.',
    'Your words, made clear.': 'Jouw woorden, helder gemaakt.',
    'It turns your answers into strong, honest lines that still sound like you.': 'Hij maakt van je antwoorden sterke, eerlijke zinnen die nog steeds als jou klinken.',
    'Free. No card. No watermark.': 'Gratis. Geen creditcard. Geen watermerk.',
    'A CV that gets read.': 'Een cv dat gelezen wordt.',
    'Colourful designs with your photo, or clean classics that hiring software reads best. Ready in about ten minutes.': 'Kleurrijke ontwerpen met je foto, of strakke klassiekers die sollicitatiesoftware het best leest. Klaar in ongeveer tien minuten.',
    'See the designs': 'Bekijk de ontwerpen', 'Your CV, made clear.': 'Jouw cv, helder gemaakt.',
    'Talk to our AI or fill in a template yourself. Pick a beautiful design, add your photo, and download it free.': 'Praat met onze AI of vul zelf een sjabloon in. Kies een mooi ontwerp, voeg je foto toe en download het gratis.',
    'Scroll to begin': 'Scroll om te beginnen',
    'From blank page to finished CV.': 'Van leeg vel naar compleet cv.',
    'Talk to the AI, or fill in a template yourself. No account, no card, nothing to install.': 'Praat met de AI of vul zelf een sjabloon in. Geen account, geen creditcard, niets te installeren.',
    'Talk or type': 'Praat of typ',
    'Answer easy questions in a chat, upload your old CV, or fill in a simple form yourself. Ask anything along the way.': 'Beantwoord makkelijke vragen in een chat, upload je oude cv of vul zelf een eenvoudig formulier in. Stel onderweg gerust vragen.',
    'Polish': 'Verfijnen',
    'The AI turns your answers into clear, strong lines. It only uses facts you give it, and you can change any word.': 'De AI maakt van je antwoorden heldere, sterke zinnen. Hij gebruikt alleen feiten die jij geeft, en je kunt elk woord aanpassen.',
    'Download': 'Downloaden',
    'Pick one of 20 designs, add your photo if you like, then save your PDF. Free, with no watermark.': 'Kies een van de 20 ontwerpen, voeg eventueel je foto toe en sla je pdf op. Gratis, zonder watermerk.',
    'Try it': 'Probeer het', 'Watch a weak line get stronger.': 'Zie een zwakke zin sterker worden.',
    'Press and hold the button. This is what Inkline does with your answers.': 'Houd de knop ingedrukt. Dit doet Inkline met je antwoorden.',
    'The AI only uses facts you tell it. When a number would help, it asks you for one. It never makes them up.': 'De AI gebruikt alleen feiten die jij vertelt. Als een getal zou helpen, vraagt hij je erom. Hij verzint ze nooit.',
    'Social media assistant · Bloom Florists': 'Socialmedia-assistent · Bloom Bloemisten',
    'Responsible for social media.': 'Verantwoordelijk voor social media.',
    'Grew our Instagram from 2,000 to 18,000 followers in one year.': 'Liet ons Instagram-account in één jaar groeien van 2.000 naar 18.000 volgers.',
    'Barista · Corner Café': 'Barista · Café op de Hoek',
    'Worked on the coffee machine and the till.': 'Werkte achter de koffiemachine en de kassa.',
    'Served 250 customers a day and trained four new baristas.': "Hielp 250 klanten per dag en leerde vier nieuwe barista's het vak.",
    'Retail assistant · City Books': 'Winkelmedewerker · City Books',
    'Helped with customer complaints.': 'Hielp bij klachten van klanten.',
    'Solved about 30 customer problems a week, so fewer people asked for refunds.': "Loste zo'n 30 klantproblemen per week op, waardoor minder mensen hun geld terugvroegen.",
    'Before': 'Voor', 'After': 'Na', 'Hold to rewrite': 'Houd vast om te herschrijven', 'Rewritten': 'Herschreven', 'Rewritten:': 'Herschreven:',
    'Try another line': 'Probeer een andere zin',
    'Press and hold, or hold the space bar, to rewrite the line.': 'Houd de knop of de spatiebalk ingedrukt om de zin te herschrijven.',
    'The designs': 'De ontwerpen', 'Designs that get you noticed.': 'Ontwerpen die opvallen.',
    'Eleven colourful designs with a spot for your photo, and nine clean classics. Use a colourful one when you email or hand in your CV. Use a classic for online application forms, because hiring software reads one clean column best.': 'Elf kleurrijke ontwerpen met plek voor je foto, en negen strakke klassiekers. Gebruik een kleurrijk ontwerp als je je cv mailt of afgeeft. Gebruik een klassiek ontwerp voor online sollicitatieformulieren, want sollicitatiesoftware leest één strakke kolom het best.',
    '20 designs': '20 ontwerpen', 'Add and crop your photo': 'Foto toevoegen en bijsnijden', '19 colours, or any colour': '19 kleuren, of elke kleur',
    '18 font styles': '18 lettertypes', 'Icons for your social media': 'Iconen voor je social media', 'Headings in 9 languages': 'Kopjes in 9 talen',
    'Colourful, with your photo': 'Kleurrijk, met je foto', 'Use this': 'Gebruik dit',
    'Classic, best for online applications': 'Klassiek, het best voor online sollicitaties',
    'Samples show a made-up person. Yours will show you, and your photo.': 'De voorbeelden tonen een verzonnen persoon. Die van jou toont jou, en je foto.',
    'FREE TO DOWNLOAD · NO CARD ·': 'GRATIS · GEEN CREDITCARD ·',
    'Pricing': 'Prijzen', 'Free. Really.': 'Gratis. Echt.',
    'Make as many CVs as you like, and download every one of them.': "Maak zoveel cv's als je wilt, en download ze allemaal.",
    'Many CV sites': 'Veel cv-sites', 'Free to build, then pay to download': 'Gratis maken, betalen om te downloaden',
    'A $2.95 trial that turns into about $30 a month': "Een proefperiode van $2,95 die verandert in zo'n $30 per maand",
    'A watermark on your PDF': 'Een watermerk op je pdf', 'Pay again to edit later': 'Opnieuw betalen om later te bewerken',
    'Free to build and download': 'Gratis maken en downloaden', 'No trial and no card': 'Geen proefperiode en geen creditcard',
    'No watermark': 'Geen watermerk', 'Edit whenever you like': 'Bewerk wanneer je wilt',
    'Questions people ask.': 'Vragen die mensen stellen.', 'Your story stays yours.': 'Jouw verhaal blijft van jou.',
    'No account. Your CV is saved in your own browser, and Start over deletes it in one click.': 'Geen account. Je cv wordt in je eigen browser bewaard, en met Opnieuw beginnen wis je het in één klik.',
    'Is Inkline really free?': 'Is Inkline echt gratis?',
    "Yes. Building, editing and downloading your CV costs nothing. There's no trial, no card and no watermark.": 'Ja. Je cv maken, bewerken en downloaden kost niets. Geen proefperiode, geen creditcard en geen watermerk.',
    'Will my CV sound like a robot wrote it?': 'Klinkt mijn cv alsof een robot het heeft geschreven?',
    'No. The AI writes from your own answers and keeps your way of saying things. You can change any word before you download.': 'Nee. De AI schrijft op basis van je eigen antwoorden en houdt jouw manier van zeggen aan. Je kunt elk woord aanpassen voordat je downloadt.',
    'Can I upload my old CV?': 'Kan ik mijn oude cv uploaden?',
    "Yes. Upload it as a Word file, PDF, Pages file, or even a photo or screenshot of it (OpenDocument, RTF and text files work too). Inkline reads it right in your browser, so it isn't sent anywhere, fills in a fresh CV, then asks what has changed since, like a new job. A sharp, straight photo in good light reads best.": 'Ja. Upload het als Word-bestand, pdf, Pages-bestand of zelfs als foto of screenshot (OpenDocument-, RTF- en tekstbestanden werken ook). Inkline leest het direct in je browser, dus het wordt nergens heen gestuurd. Daarna vult het een nieuw cv in en vraagt wat er sindsdien is veranderd, zoals een nieuwe baan. Een scherpe, rechte foto bij goed licht leest het best.',
    'Can I ask the AI questions while I make my CV?': 'Kan ik de AI vragen stellen terwijl ik mijn cv maak?',
    'Yes. Ask things like how long your CV should be, or how to explain a gap. It answers, then carries on with your CV. When you are done, it shows your CV in a few designs so you can pick one.': 'Ja. Vraag bijvoorbeeld hoe lang je cv moet zijn, of hoe je een gat in je loopbaan uitlegt. Hij antwoordt en gaat dan verder met je cv. Als je klaar bent, laat hij je cv in een paar ontwerpen zien zodat je er een kunt kiezen.',
    'Do I have to use the AI?': 'Moet ik de AI gebruiken?',
    'No. You can fill in any template yourself, like a simple form, and watch your CV update as you type. You can switch between the AI and the form at any time.': 'Nee. Je kunt elk sjabloon zelf invullen, zoals een eenvoudig formulier, en je cv zien bijwerken terwijl je typt. Je kunt altijd wisselen tussen de AI en het formulier.',
    'Can I add my photo?': 'Kan ik mijn foto toevoegen?',
    'Yes. Upload a photo and it appears in every design with a photo spot. It stays in your browser and is never sent to the AI. Click it on your CV to move or zoom it until it sits just right. In the US and UK, CVs usually leave the photo out. In much of Europe, the Middle East and Asia, employers often expect one.': 'Ja. Upload een foto en hij verschijnt in elk ontwerp met een fotoplek. Hij blijft in je browser en wordt nooit naar de AI gestuurd. Klik erop in je cv om hem te verschuiven of in te zoomen tot hij precies goed zit. In de VS en het VK laten cv\'s de foto meestal weg. In een groot deel van Europa, het Midden-Oosten en Azië verwachten werkgevers er vaak een.',
    'Can I change the sections or write the headings in another language?': 'Kan ik de onderdelen aanpassen of de kopjes in een andere taal zetten?',
    'Yes. Every design keeps its look, but you choose which sections show, add your own (like Projects or Volunteering), and rename any heading by clicking it. Pick a heading language, such as Arabic, Dutch, French or German, and the headings, the word between dates and "Present" all change with it.': 'Ja. Elk ontwerp behoudt zijn uiterlijk, maar jij kiest welke onderdelen je toont, voegt je eigen onderdelen toe (zoals Projecten of Vrijwilligerswerk) en hernoemt elk kopje door erop te klikken. Kies een taal voor de kopjes, zoals Arabisch, Nederlands, Frans of Duits, en de kopjes, het woord tussen datums en "heden" veranderen allemaal mee.',
    'Will it get past hiring software?': 'Komt het door sollicitatiesoftware heen?',
    'For online application forms, choose a Classic design. They are one clean column of real text, the layout hiring software reads best. The colourful designs are made for emailing or handing in your CV, where a person reads it first.': 'Kies voor online sollicitatieformulieren een klassiek ontwerp. Dat is één strakke kolom echte tekst, de opmaak die sollicitatiesoftware het best leest. De kleurrijke ontwerpen zijn bedoeld om je cv te mailen of af te geven, waar eerst een mens het leest.',
    "I don't have much work experience. Can I still make one?": 'Ik heb weinig werkervaring. Kan ik toch een cv maken?',
    'Yes. The AI asks about school, volunteering, side projects, part-time work and skills, so a first CV still looks full and confident.': 'Ja. De AI vraagt naar school, vrijwilligerswerk, eigen projecten, bijbanen en vaardigheden, zodat ook een eerste cv vol en zelfverzekerd oogt.',
    'What happens to my information?': 'Wat gebeurt er met mijn gegevens?',
    'Your CV is saved in your own browser, not in an account. While the AI is helping, your answers are sent to it only to write your CV. Start over deletes everything from your browser.': 'Je cv wordt in je eigen browser bewaard, niet in een account. Terwijl de AI helpt, worden je antwoorden alleen naar hem gestuurd om je cv te schrijven. Met Opnieuw beginnen wis je alles uit je browser.',
    'Can I make my CV in another language?': 'Kan ik mijn cv in een andere taal maken?',
    'Yes. Write to the AI in your language and it replies, and writes your CV, in that language too.': 'Ja. Schrijf de AI in jouw taal en hij antwoordt, en schrijft je cv, ook in die taal.',
    'Can I come back and edit it later?': 'Kan ik later terugkomen om het te bewerken?',
    'Yes. Your CV stays saved in the browser you made it in. Open Inkline again and carry on where you left off.': 'Ja. Je cv blijft bewaard in de browser waarin je het hebt gemaakt. Open Inkline opnieuw en ga verder waar je gebleven was.',
    'Your next job starts with one answer.': 'Je volgende baan begint met één antwoord.',
    'It takes about ten minutes.': 'Het kost ongeveer tien minuten.', 'Fill in a template': 'Vul een sjabloon in',
    '© 2026 Inkline. Your CV stays in your browser.': '© 2026 Inkline. Je cv blijft in je browser.',
    'Main': 'Hoofdmenu', 'Inkline, back to top': 'Inkline, terug naar boven', 'Introduction': 'Introductie',
    'A single drop of ink falling into clear water': 'Eén druppel inkt die in helder water valt',
    'The ink blooming into a soft cloud': 'De inkt die openbloeit tot een zachte wolk',
    'The ink settled into a calm layer': 'De inkt die tot rust komt in een kalme laag',
    'Colourful designs': 'Kleurrijke ontwerpen', 'Classic designs': 'Klassieke ontwerpen', 'Footer': 'Voettekst',

    // ---------- CV maker: page ----------
    'Make your CV · Inkline': 'Maak je cv · Inkline',
    'Make your CV with AI, or fill in a beautiful template yourself. Add your photo, pick a design and download your PDF free.': 'Maak je cv met AI, of vul zelf een mooi sjabloon in. Voeg je foto toe, kies een ontwerp en download je pdf gratis.',
    'Skip to the editor': 'Naar de editor',
    'Name': 'Naam', 'Job': 'Baan', 'Contact': 'Contact', 'Experience': 'Ervaring', 'Education': 'Opleiding', 'Skills': 'Vaardigheden',
    'Extras': 'Extra', 'Ready': 'Klaar', 'Languages': 'Talen', 'Profile': 'Profiel',
    'Guided mode': 'Begeleide modus', 'AI interviewer': 'AI-interviewer', 'Start over': 'Opnieuw beginnen',
    'With AI': 'Met AI', 'Fill in myself': 'Zelf invullen', 'Your answer or question': 'Je antwoord of vraag', 'Type your answer…': 'Typ je antwoord…',
    'Your CV is saved in this browser only.': 'Je cv wordt alleen in deze browser bewaard.',
    'Your CV is saved in this browser. Your answers go to the AI only to write your CV.': 'Je cv wordt in deze browser bewaard. Je antwoorden gaan alleen naar de AI om je cv te schrijven.',
    'Fonts & size': 'Lettertype & grootte', 'Sections': 'Onderdelen', 'Add photo': 'Foto toevoegen', 'Edit photo': 'Foto bewerken',
    'Colour': 'Kleur', 'Icons & links': 'Iconen & links', 'Paper': 'Papier', 'US Letter': 'US Letter',
    'Copy as text': 'Kopieer als tekst', 'Copied': 'Gekopieerd', 'Copy failed': 'Kopiëren mislukt', 'Download PDF': 'Pdf downloaden',
    'Click any text on your CV to change it.': 'Klik op een tekst in je cv om die te wijzigen.', 'Fits on 1 page': 'Past op 1 pagina',
    'Fonts and text size': 'Lettertype en tekstgrootte', 'Done': 'Klaar', 'Or pick any colour': 'Of kies zelf een kleur',
    'Very light colours are darkened a little, so white text on them stays easy to read.': 'Hele lichte kleuren worden iets donkerder gemaakt, zodat witte tekst erop goed leesbaar blijft.',
    'That colour was darkened a little, so white text on it stays easy to read.': 'Die kleur is iets donkerder gemaakt, zodat witte tekst erop goed leesbaar blijft.',
    'Icons and links': 'Iconen en links', 'Sections and headings': 'Onderdelen en kopjes', 'Choose a design': 'Kies een ontwerp',
    'Close': 'Sluiten', 'Edit': 'Bewerken', 'Your CV': 'Je cv', 'Chat': 'Chat',
    "Let's make your CV": 'Laten we je cv maken', 'How would you like to make it?': 'Hoe wil je het maken?',
    'Both ways are free, and you can switch between them any time.': 'Beide manieren zijn gratis, en je kunt altijd wisselen.',
    'Answer a few easy questions in a chat. Your CV writes itself as you talk.': 'Beantwoord een paar makkelijke vragen in een chat. Je cv schrijft zichzelf terwijl je praat.',
    'About 10 minutes': 'Ongeveer 10 minuten', 'Fill in a template myself': 'Zelf een sjabloon invullen',
    'Pick a design and type your details into a simple form. Every change shows instantly.': 'Kies een ontwerp en typ je gegevens in een eenvoudig formulier. Elke wijziging zie je meteen.',
    'No AI needed': 'Geen AI nodig',
    'Adjust your photo': 'Pas je foto aan',
    'Drag the photo to move it. Zoom with the slider, by pinching, or with your mouse wheel.': 'Sleep de foto om hem te verschuiven. Zoom met de schuifregelaar, door te knijpen of met je muiswiel.',
    'Zoom': 'Zoom', 'Choose another': 'Kies een andere', 'Remove': 'Verwijderen', 'Cancel': 'Annuleren', 'Use photo': 'Foto gebruiken',
    'Interview progress': 'Voortgang van het interview', 'Edit your CV': 'Bewerk je cv', 'How you make your CV': 'Hoe je je cv maakt',
    'Upload your old CV': 'Upload je oude cv', 'Send': 'Versturen', 'Ready-made colours': 'Kant-en-klare kleuren', 'Switch view': 'Weergave wisselen',
    'Your photo. Use the arrow keys to move it and the plus and minus keys to zoom.': 'Je foto. Gebruik de pijltjestoetsen om hem te verschuiven en de plus- en mintoets om te zoomen.',

    // ---------- CV maker: form ----------
    'Start from your old CV': 'Begin met je oude cv',
    'Upload a Word file, a PDF or a photo of it. It is read right here in your browser, never sent anywhere, and fills in your new CV.': 'Upload een Word-bestand, een pdf of een foto ervan. Het wordt hier in je browser gelezen, nergens heen gestuurd, en vult je nieuwe cv in.',
    'Upload a PDF, Word file or a photo of it. The AI reads it and fills in your new CV, then asks what has changed.': 'Upload een pdf, Word-bestand of een foto ervan. De AI leest het, vult je nieuwe cv in en vraagt daarna wat er is veranderd.',
    'Upload my old CV': 'Upload mijn oude cv', 'Photo': 'Foto',
    'Shows in designs with a photo spot. It stays in your browser and is never sent to the AI.': 'Verschijnt in ontwerpen met een fotoplek. Hij blijft in je browser en wordt nooit naar de AI gestuurd.',
    'Upload a photo': 'Upload een foto', 'Change photo': 'Andere foto', 'Move or zoom': 'Verschuiven of zoomen', 'Your photo': 'Je foto',
    'Tip: in the US and UK, CVs usually have no photo. In much of Europe, the Middle East and Asia, employers often expect one.': "Tip: in de VS en het VK hebben cv's meestal geen foto. In een groot deel van Europa, het Midden-Oosten en Azië verwachten werkgevers er vaak een.",
    'Pick a font and make the name, headings or text bigger or smaller.': 'Kies een lettertype en maak de naam, kopjes of tekst groter of kleiner.',
    'Design default': 'Standaard van het ontwerp', "Each design's own fonts": 'De eigen lettertypes van elk ontwerp', 'Classic serif': 'Klassieke schreef',
    'Bold': 'Krachtig', 'Friendly': 'Vriendelijk', 'Professional': 'Professioneel', 'Minimal': 'Minimaal', 'Geometric': 'Geometrisch', 'Neutral': 'Neutraal',
    'Fashion': 'Mode', 'Condensed': 'Smal', 'Book': 'Boek', 'Warm serif': 'Warme schreef', 'Traditional': 'Traditioneel',
    'Arabic modern': 'Arabisch modern', 'Arabic classic': 'Arabisch klassiek', 'Font': 'Lettertype',
    'Section headings': 'Kopjes', 'Main text': 'Hoofdtekst', 'Reset sizes': 'Groottes herstellen',
    'Keep your design, but choose which sections show and what they are called, in any language.': 'Behoud je ontwerp, maar kies welke onderdelen je toont en hoe ze heten, in elke taal.',
    'Heading language': 'Taal van de kopjes',
    'Untick a section to hide it. To rename one, type a new name here or click its heading on your CV.': 'Vink een onderdeel uit om het te verbergen. Om het te hernoemen, typ je hier een nieuwe naam of klik je op het kopje in je cv.',
    'Word between dates': 'Woord tussen datums', 'Sections you added': 'Onderdelen die je hebt toegevoegd', 'None yet. Add one below.': 'Nog geen. Voeg er hieronder een toe.',
    'You can have up to 8 added sections.': 'Je kunt maximaal 8 onderdelen toevoegen.', '+ Your own section': '+ Je eigen onderdeel',
    'Your details': 'Je gegevens', 'The basics at the top of your CV.': 'De basis bovenaan je cv.', 'Full name': 'Volledige naam', 'Job title': 'Functietitel',
    'Email': 'E-mail', 'Phone': 'Telefoon', 'City': 'Woonplaats', 'LinkedIn or website': 'LinkedIn of website',
    'Two or three sentences about you and the job you want.': 'Twee of drie zinnen over jou en de baan die je wilt.',
    'Most recent job first. Part-time and volunteer work count too.': 'Meest recente baan eerst. Bijbanen en vrijwilligerswerk tellen ook mee.',
    'New job': 'Nieuwe baan', 'Company': 'Bedrijf', 'Start': 'Begin', 'End': 'Einde', 'What you did': 'Wat je deed', 'Add a job': 'Baan toevoegen',
    'Your highest qualification first.': 'Je hoogste diploma eerst.', 'New qualification': 'Nieuwe opleiding', 'Qualification': 'Diploma', 'School': 'School',
    'Details (optional)': 'Details (optioneel)', 'Add education': 'Opleiding toevoegen',
    'Type a skill and press Enter.': 'Typ een vaardigheid en druk op Enter.', 'Add a skill': 'Vaardigheid toevoegen', 'Add': 'Toevoegen',
    'Add how well you speak each one.': 'Geef aan hoe goed je elke taal spreekt.', 'Add a language': 'Taal toevoegen',
    'More sections': 'Meer onderdelen', 'Certifications, volunteering, projects or awards.': 'Certificaten, vrijwilligerswerk, projecten of prijzen.',
    'New section': 'Nieuw onderdeel', 'Section title': 'Naam van het onderdeel', 'Items': 'Regels', 'Move up': 'Omhoog', 'Move down': 'Omlaag',
    'e.g. Sara Ahmed': 'bijv. Sara Ahmed', 'e.g. Customer Service Manager': 'bijv. Teamleider klantenservice', 'you@email.com': 'jij@email.nl',
    'e.g. +971 50 123 4567': 'bijv. 06 12345678', 'e.g. Dubai, UAE': 'bijv. Utrecht', 'linkedin.com/in/yourname': 'linkedin.com/in/jouwnaam',
    'e.g. Customer service manager with five years in busy cafés and shops. I keep teams calm and customers happy.': 'bijv. Teamleider klantenservice met vijf jaar ervaring in drukke cafés en winkels. Ik houd teams rustig en klanten tevreden.',
    'e.g. Shift supervisor': 'bijv. Shiftleider', 'e.g. Marina Café': 'bijv. Café de Haven', 'e.g. Dubai': 'bijv. Utrecht', 'e.g. Mar 2021': 'bijv. mrt 2021',
    'e.g. Present': 'bijv. heden', 'One point per line, e.g. Led a team of 6 Served 300 customers a day': 'Eén punt per regel, bijv.\nGaf leiding aan een team van 6\nHielp 300 klanten per dag',
    'e.g. BA Marketing': 'bijv. Bachelor Marketing', 'e.g. University of Leeds': 'bijv. Hogeschool van Amsterdam', 'e.g. Leeds': 'bijv. Amsterdam',
    'e.g. 2016': 'bijv. 2016', 'e.g. 2019': 'bijv. 2019', 'e.g. First-class honours': 'bijv. Cum laude', 'e.g. Customer service': 'bijv. Klantenservice',
    'e.g. Arabic (native)': 'bijv. Arabisch (moedertaal)', 'e.g. Certifications': 'bijv. Certificaten',
    'One per line, e.g. First aid certificate, 2022': 'Eén per regel, bijv.\nEHBO-diploma, 2022',
    'Communication': 'Communicatie', 'Teamwork': 'Samenwerken', 'Customer service': 'Klantenservice', 'Problem solving': 'Probleemoplossend', 'Leadership': 'Leiderschap',
    'English (fluent)': 'Engels (vloeiend)', 'Arabic (native)': 'Arabisch (moedertaal)', 'French (basic)': 'Frans (basis)',

    // ---------- the CV while editing ----------
    'Your name': 'Je naam', 'The job you want': 'De baan die je wilt', 'A short profile will appear here.': 'Hier komt een kort profiel.',
    'Skill': 'Vaardigheid', 'Language': 'Taal', 'Section name': 'Naam van het onderdeel', 'Website or LinkedIn': 'Website of LinkedIn',
    'Type here, then press Enter for the next line': 'Typ hier en druk op Enter voor de volgende regel', 'Add your photo': 'Voeg je foto toe',
    'Move, zoom or change your photo': 'Verschuif, zoom of wijzig je foto', 'Click to move, zoom or change your photo': 'Klik om je foto te verschuiven, te zoomen of te wijzigen',
    'Click to rename this section': 'Klik om dit onderdeel te hernoemen', 'Click to change this word': 'Klik om dit woord te wijzigen', 'Drag to move': 'Sleep om te verplaatsen',

    // ---------- CV maker: icons ----------
    'Tap an icon to put it on your CV. Then drag it anywhere on the page and type your text next to it.': 'Tik op een icoon om het op je cv te zetten. Sleep het daarna naar elke plek op de pagina en typ je tekst ernaast.',
    'On your CV': 'Op je cv', 'Everyday': 'Dagelijks', 'Social media and sites': 'Social media en sites',
    'LinkedIn or profile': 'LinkedIn of profiel', 'Location': 'Locatie', 'Date': 'Datum', 'Message': 'Bericht', 'Writing': 'Schrijven',
    'Photography': 'Fotografie', 'Music': 'Muziek', 'Driving licence': 'Rijbewijs', 'Travel': 'Reizen', 'Star': 'Ster', 'Award': 'Prijs', 'Heart': 'Hart', 'Just text': 'Alleen tekst',
    "Logos belong to their companies. They're shown unchanged, in dark or white, to point to your own profiles.": "Logo's zijn van hun bedrijven. Ze worden onveranderd getoond, in donker of wit, om naar je eigen profielen te verwijzen.",
    'Dark': 'Donker', 'White, for dark areas': 'Wit, voor donkere vlakken', 'Design colour': 'Kleur van het ontwerp', 'Small': 'Klein', 'Medium': 'Middel', 'Large': 'Groot',
    'yourwebsite.com': 'jouwwebsite.nl', '+971 50 123 4567': '06 12345678', 'Dubai, UAE': 'Utrecht', 'your-link.com': 'jouw-link.nl', 'My portfolio': 'Mijn portfolio',
    'Available from June': 'Beschikbaar vanaf juni', 'Happy to chat': 'Graag in gesprek', 'My projects': 'Mijn projecten', 'My blog': 'Mijn blog', 'My photos': "Mijn foto's",
    'My music': 'Mijn muziek', 'Full driving licence': 'Rijbewijs B', 'Happy to travel': 'Bereid om te reizen', 'A highlight': 'Een hoogtepunt',
    'Employee of the year': 'Medewerker van het jaar', 'Volunteer': 'Vrijwilliger', 'Your text': 'Jouw tekst', '@yourname': '@jouwnaam', 'yourname': 'jouwnaam',
    'facebook.com/yourname': 'facebook.com/jouwnaam', 'youtube.com/@yourchannel': 'youtube.com/@jouwkanaal', 'github.com/yourname': 'github.com/jouwnaam',
    'behance.net/yourname': 'behance.net/jouwnaam', 'dribbble.com/yourname': 'dribbble.com/jouwnaam', 'pinterest.com/yourname': 'pinterest.com/jouwnaam',
    'medium.com/@yourname': 'medium.com/@jouwnaam', 'gitlab.com/yourname': 'gitlab.com/jouwnaam',

    // ---------- CV maker: design picker ----------
    'Eye-catching designs for emailing or handing in your CV, where a person reads it first.': 'Opvallende ontwerpen om je cv te mailen of af te geven, waar eerst een mens het leest.',
    'One clean column of text. The safest choice when you apply through a website, because hiring software reads it perfectly.': 'Eén strakke kolom tekst. De veiligste keuze als je via een website solliciteert, want sollicitatiesoftware leest het perfect.',
    'Colour sidebar with photo': 'Gekleurde zijbalk met foto', 'Bold colour header': 'Opvallende gekleurde kop', 'Soft and minimal': 'Zacht en minimalistisch',
    'Warm and creative': 'Warm en creatief', 'Elegant dark sidebar': 'Elegante donkere zijbalk', 'Timeline layout': 'Tijdlijn-opmaak',
    'Gradient sidebar, bold labels': 'Zijbalk met kleurverloop, opvallende labels', 'Two-tone slanted header': 'Schuine kop in twee tinten',
    'Magazine photo on top': 'Tijdschriftfoto bovenaan', 'Warm paper, centred': 'Warm papier, gecentreerd', 'Soft cards on a tint': 'Zachte kaarten op een tint',
    'Ink serif, quiet rules': 'Inktschreef, rustige lijnen', 'Clean and modern': 'Strak en modern', 'Classic, centred': 'Klassiek, gecentreerd',
    'Colour header, photo if you like': 'Gekleurde kop, foto als je wilt', 'Compact, fits more': 'Compact, er past meer op', 'Headings in the margin': 'Kopjes in de marge',
    'Typewriter, ruled': 'Typemachine, met lijnen', 'Big name, highlighter': 'Grote naam, markeerstift', 'Numbered sections, strong bar': 'Genummerde onderdelen, sterke balk',

    // ---------- CV maker: messages ----------
    "This browser couldn't save your CV, so keep this page open until you download it.": 'Deze browser kon je cv niet bewaren, dus houd deze pagina open tot je het hebt gedownload.',
    'Please choose a photo, like a JPG or PNG.': 'Kies een foto, zoals een JPG of PNG.',
    "That photo couldn't be used. Try another one.": 'Die foto kon niet worden gebruikt. Probeer een andere.',
    "That photo couldn't be opened. Try a JPG or PNG.": 'Die foto kon niet worden geopend. Probeer een JPG of PNG.',
    'Photo added. It shows in designs with a photo spot, like Atlas, Vertex or Bloom.': 'Foto toegevoegd. Hij verschijnt in ontwerpen met een fotoplek, zoals Atlas, Vertex of Bloom.',
    'Photo added. Click it on your CV any time to move or zoom it.': 'Foto toegevoegd. Klik er altijd op in je cv om hem te verschuiven of in te zoomen.',
    'Photo updated.': 'Foto bijgewerkt.',
    'Start a new CV? This deletes your CV, photo and chat from this browser, and the chat from our server.': 'Een nieuw cv beginnen? Dit wist je cv, foto en chat uit deze browser, en de chat van onze server.',
    'Section added. Type the first line, then press Enter for the next one.': 'Onderdeel toegevoegd. Typ de eerste regel en druk op Enter voor de volgende.',
    'Section added. Type its name, then its first line.': 'Onderdeel toegevoegd. Typ de naam en daarna de eerste regel.',
    'Remove {item}': 'Verwijder {item}', 'Remove the "{name}" section from your CV?': 'Het onderdeel "{name}" uit je cv verwijderen?', 'untitled': 'zonder naam',
    'You can place up to 24 icons on your CV.': 'Je kunt maximaal 24 iconen op je cv zetten.',
    'Remove this from your CV?': 'Dit uit je cv verwijderen?',
    'Replace your current CV with the details from this file?': 'Je huidige cv vervangen door de gegevens uit dit bestand?',
    'Got it. What else should we add?': 'Duidelijk. Wat moeten we nog toevoegen?',
    "Sorry, I couldn't reach the AI just now.": 'Sorry, ik kon de AI nu niet bereiken.',
    'Try again': 'Opnieuw proberen', 'Continue without AI': 'Verder zonder AI', 'Edit it myself': 'Zelf bewerken',
    "What's your full name?": 'Wat is je volledige naam?',
    'Nice to meet you. What job are you going for?': 'Leuk je te ontmoeten. Voor welke baan ga je?',
    'What email address should employers use?': 'Op welk e-mailadres kunnen werkgevers je bereiken?', 'Skip': 'Overslaan',
    'And a phone number?': 'En een telefoonnummer?', 'Which city or town do you live in?': 'In welke stad of plaats woon je?',
    'Do you have a LinkedIn page or website to add?': 'Heb je een LinkedIn-pagina of website om toe te voegen?', 'No': 'Nee',
    'Would you like a photo on your CV? Many of the colourful designs have a photo spot.': 'Wil je een foto op je cv? Veel van de kleurrijke ontwerpen hebben een fotoplek.',
    'Add a photo': 'Foto toevoegen', 'No photo': 'Geen foto',
    'Have you had any jobs? Part-time, summer and volunteer work all count.': 'Heb je al eens gewerkt? Bijbanen, zomerwerk en vrijwilligerswerk tellen allemaal mee.',
    'Yes': 'Ja', 'Not yet': 'Nog niet',
    "What's the job title of your new job?": 'Wat is de functietitel van je nieuwe baan?',
    "Let's start with your most recent job. What was your job title?": 'Laten we beginnen met je meest recente baan. Wat was je functietitel?',
    'What was the job title?': 'Wat was de functietitel?',
    "Where did you work? The company name and city, like 'Greenway Stores, Leeds'.": "Waar werkte je? De naam van het bedrijf en de plaats, zoals 'Albert Heijn, Utrecht'.",
    "When did you start and finish? For example '2021 to now' or 'Mar 2019 to Jun 2021'.": "Wanneer begon en stopte je? Bijvoorbeeld '2021 tot nu' of 'mrt 2019 tot jun 2021'.",
    'What did you do there? Tell me two or three things, each on a new line. Numbers help, like how many customers you served or how much sales grew.': 'Wat deed je daar? Noem twee of drie dingen, elk op een nieuwe regel. Getallen helpen, zoals hoeveel klanten je hielp of hoeveel de omzet groeide.',
    "Your old CV says you still work in your last job. When did that job end? For example 'Dec 2024'.": "Volgens je oude cv werk je nog in je laatste baan. Wanneer stopte die baan? Bijvoorbeeld 'dec 2024'.",
    'I still work there': 'Ik werk daar nog', 'Do you want to add another job?': 'Wil je nog een baan toevoegen?', 'Add another job': 'Nog een baan toevoegen',
    "What's the new qualification? For example 'BA Marketing' or 'First aid certificate'.": "Wat is je nieuwe diploma of certificaat? Bijvoorbeeld 'Bachelor Marketing' of 'EHBO-diploma'.",
    "What's your highest qualification? For example 'BA Marketing' or 'High school diploma'.": "Wat is je hoogste opleiding? Bijvoorbeeld 'Bachelor Marketing' of 'havo-diploma'.",
    'Where did you study? The school name and city.': 'Waar heb je gestudeerd? De naam van de school en de plaats.',
    "When did you study there? For example '2014 to 2017'.": "Wanneer studeerde je daar? Bijvoorbeeld '2014 tot 2017'.",
    'Add another qualification?': 'Nog een opleiding toevoegen?', 'Add another': 'Nog een toevoegen',
    "What are your top skills? List them with commas, like 'Excel, customer service, cooking'.": "Wat zijn je belangrijkste vaardigheden? Noem ze met komma's, zoals 'Excel, klantenservice, koken'.",
    'Which languages do you speak, and how well?': 'Welke talen spreek je, en hoe goed?', 'Just English': 'Alleen Engels',
    'Anything else worth adding? Certifications, volunteering, projects or awards. Put each on a new line.': 'Nog iets dat het toevoegen waard is? Certificaten, vrijwilligerswerk, projecten of prijzen. Zet elk op een nieuwe regel.',
    'Last one. In a sentence or two, what makes you good at this kind of work?': 'Laatste vraag. Wat maakt jou, in een zin of twee, goed in dit soort werk?',
    'Write one for me': 'Schrijf er een voor mij', 'Anything else that has changed?': 'Is er nog iets anders veranderd?',
    'What has changed since you wrote it? I can add a new job or qualification for you. For anything else, click the text on your CV and type.': 'Wat is er veranderd sinds je het schreef? Ik kan een nieuwe baan of opleiding voor je toevoegen. Voor al het andere klik je op de tekst in je cv en typ je.',
    'Add a new job': 'Nieuwe baan toevoegen', 'Add a qualification': 'Opleiding toevoegen', 'Nothing else': 'Verder niets',
    'Your CV is ready. Here it is in a few designs. Tap the one you like, and you can still change anything afterwards.': 'Je cv is klaar. Hier zie je het in een paar ontwerpen. Tik op het ontwerp dat je mooi vindt; je kunt daarna nog alles aanpassen.',
    'Start a new CV': 'Nieuw cv beginnen',
    "I can help with questions about your CV, like how long it should be or how to explain a gap. Let's keep building your CV.": 'Ik help graag met vragen over je cv, zoals hoe lang het moet zijn of hoe je een gat uitlegt. Laten we verder bouwen aan je cv.',
    "To add it, press Add a new job or Add a qualification and I'll ask for the details. For anything else, click the text on your CV and type.": 'Druk op Nieuwe baan toevoegen of Opleiding toevoegen; dan vraag ik naar de details. Voor al het andere klik je op de tekst in je cv en typ je.',
    'You can change anything by clicking the text on your CV, or switch to Fill in myself for a simple form. When it looks right, press Download PDF.': 'Je kunt alles aanpassen door op de tekst in je cv te klikken, of ga naar Zelf invullen voor een eenvoudig formulier. Ziet het er goed uit? Druk dan op Pdf downloaden.',
    'See all designs': 'Alle ontwerpen bekijken',
    'That file is too big. Please use one under 15 MB.': 'Dat bestand is te groot. Gebruik er een van minder dan 15 MB.',
    "I couldn't find anything readable inside that Pages file. In Pages, choose File, then Export To, then PDF, and upload the PDF.": 'Ik kon niets leesbaars vinden in dat Pages-bestand. Kies in Pages Archief, dan Exporteer naar, dan PDF, en upload de pdf.',
    'That file is too big. Each file can be up to 8 MB, and 10 MB together.': 'Dat bestand is te groot. Elk bestand mag maximaal 8 MB zijn, en samen 10 MB.',
    "I couldn't open that file. If it's a photo, try a JPG or PNG. If it's a document, try saving it as a PDF and uploading that.": 'Ik kon dat bestand niet openen. Is het een foto? Probeer dan een JPG of PNG. Is het een document? Sla het dan op als pdf en upload dat.',
    "Sorry, I couldn't read that file just now. You can try again, or just tell me about your experience instead.": 'Sorry, ik kon dat bestand nu niet lezen. Je kunt het opnieuw proberen, of vertel me gewoon over je ervaring.',
    'Try the upload again': 'Opnieuw uploaden',
    "I've read your old CV and filled in your new one. What has changed since you wrote it?": 'Ik heb je oude cv gelezen en je nieuwe ingevuld. Wat is er veranderd sinds je het schreef?',
    'Note: that Pages file only let me see its first page. If your CV is longer, export it from Pages as a PDF and upload that too.': 'Let op: van dat Pages-bestand kon ik alleen de eerste pagina zien. Is je cv langer? Exporteer het dan vanuit Pages als pdf en upload dat ook.',
    'Reading the text in your picture. This can take up to a minute…': 'De tekst in je afbeelding wordt gelezen. Dit kan tot een minuut duren…',
    'your name': 'je naam', 'your contact details': 'je contactgegevens', 'your profile': 'je profiel', 'your {section}': 'je {section}', 'and': 'en',
    '{n} job': '{n} baan', '{n} jobs': '{n} banen', '{n} qualification': '{n} opleiding', '{n} qualifications': '{n} opleidingen',
    '{n} skill': '{n} vaardigheid', '{n} skills': '{n} vaardigheden', '{n} language': '{n} taal', '{n} languages': '{n} talen',
    "I read your old CV right here on your device, so it wasn't sent anywhere. I found {list}.": 'Ik heb je oude cv hier op je apparaat gelezen, dus het is nergens heen gestuurd. Ik vond {list}.',
    'Reading text from a picture is never perfect, so please check your new CV carefully and click any text to fix it.': 'Tekst lezen uit een afbeelding is nooit perfect, dus controleer je nieuwe cv goed en klik op een tekst om die te verbeteren.',
    'Please check your new CV and click any text to fix it.': 'Controleer je nieuwe cv en klik op een tekst om die te verbeteren.',
    "I couldn't start the picture reader in this browser. Try another browser, or upload your CV as a Word or PDF file. Or let's go through it together now.": "Ik kon de afbeeldingslezer in deze browser niet starten. Probeer een andere browser, of upload je cv als Word- of pdf-bestand. Of laten we het nu samen doorlopen.",
    "This browser can't open that kind of photo (often an iPhone HEIC photo). Take a screenshot of it, or save it as a JPG, and upload that. Or let's go through it together now.": "Deze browser kan dat soort foto niet openen (vaak een HEIC-foto van een iPhone). Maak er een screenshot van, of sla hem op als JPG, en upload die. Of laten we het nu samen doorlopen.",
    "That Pages file doesn't include a copy I can read. In Pages, choose File, then Export To, then PDF, and upload the PDF. Or let's go through it together now.": 'Dat Pages-bestand bevat geen versie die ik kan lezen. Kies in Pages Archief, dan Exporteer naar, dan PDF, en upload de pdf. Of laten we het nu samen doorlopen.',
    "I couldn't read enough from that picture. A sharp, straight photo in good light works best, or a screenshot of the CV. Or let's fill it in together now.": 'Ik kon niet genoeg lezen uit die afbeelding. Een scherpe, rechte foto bij goed licht werkt het best, of een screenshot van het cv. Of laten we het nu samen invullen.',
    "I couldn't read enough from that picture (only {list}). A sharp, straight photo in good light works best, or a screenshot of the CV. Or let's fill it in together now.": 'Ik kon niet genoeg lezen uit die afbeelding (alleen {list}). Een scherpe, rechte foto bij goed licht werkt het best, of een screenshot van het cv. Of laten we het nu samen invullen.',
    "I could only find {list} in that file. If you have the original Word or PDF file, try that. Or let's fill in the rest together.": 'Ik kon alleen {list} vinden in dat bestand. Heb je het originele Word- of pdf-bestand? Probeer dat dan. Of laten we de rest samen invullen.',
    "I couldn't find any text in that file. If you have the original Word or PDF file, try that. Or let's go through it together now.": 'Ik kon geen tekst vinden in dat bestand. Heb je het originele Word- of pdf-bestand? Probeer dat dan. Of laten we het nu samen doorlopen.',
    'It depends on where you apply. In the US and UK, CVs usually have no photo. In much of Europe, the Middle East and Asia, a friendly, professional photo is common. Many of the colourful designs have a photo spot.': "Dat hangt af van waar je solliciteert. In de VS en het VK hebben cv's meestal geen foto. In een groot deel van Europa, het Midden-Oosten en Azië is een vriendelijke, professionele foto gebruikelijk. Veel van de kleurrijke ontwerpen hebben een fotoplek.",
    'Keep it to one page if you have less than about ten years of experience, and two pages at most. Short, clear lines beat long paragraphs.': 'Houd het bij één pagina als je minder dan ongeveer tien jaar ervaring hebt, en maximaal twee pagina\'s. Korte, heldere zinnen werken beter dan lange alinea\'s.',
    "You don't need to list references on your CV. Employers will ask for them later if they want them.": 'Je hoeft geen referenties op je cv te zetten. Werkgevers vragen er later om als ze die willen.',
    "Be honest and keep it short. A line like 'Career break, caring for family' or 'Studying for a certificate' is fine. Gaps are very common.": "Wees eerlijk en houd het kort. Een regel als 'Loopbaanonderbreking, zorg voor familie' of 'Studie voor een certificaat' is prima. Gaten in je cv komen heel vaak voor.",
    "Add your grades if they're good and you finished studying in the last few years. Otherwise you can leave them out.": 'Zet je cijfers erbij als ze goed zijn en je de afgelopen jaren bent afgestudeerd. Anders kun je ze weglaten.',
    'Only add hobbies if they show a useful skill, like team sports or volunteering. Otherwise they take space you need for experience.': 'Zet alleen hobby\'s erbij als ze een nuttige vaardigheid laten zien, zoals teamsport of vrijwilligerswerk. Anders nemen ze ruimte in die je nodig hebt voor ervaring.',
    "For online application forms, choose a Classic design. They're one clean column, which hiring software reads best.": 'Kies voor online sollicitatieformulieren een klassiek ontwerp. Dat is één strakke kolom, die sollicitatiesoftware het best leest.',
    "Leave salary off your CV. It's usually discussed later, once they're interested.": 'Laat je salaris van je cv af. Dat bespreek je meestal later, als ze interesse hebben.',
    "In many countries you shouldn't add your age, date of birth or marital status. In some places, like the Gulf, nationality is often expected. Add it only if it's normal where you apply.": 'In veel landen zet je je leeftijd, geboortedatum of burgerlijke staat beter niet op je cv. Op sommige plekken, zoals in de Golfstaten, wordt je nationaliteit vaak verwacht. Zet het er alleen bij als dat gebruikelijk is waar je solliciteert.',
    'A short cover letter helps: three short paragraphs saying why this job, what you bring, and that you would love to talk.': 'Een korte motivatiebrief helpt: drie korte alinea\'s over waarom deze baan, wat je meebrengt en dat je graag een gesprek hebt.',
    'Inkline is free. No card, no trial and no watermark on your PDF.': 'Inkline is gratis. Geen creditcard, geen proefperiode en geen watermerk op je pdf.',
    'Use the Fonts & size button above your CV to pick a font and make the name, headings or text bigger or smaller.': 'Gebruik de knop Lettertype & grootte boven je cv om een lettertype te kiezen en de naam, kopjes of tekst groter of kleiner te maken.',
    'When your CV is ready, press Download PDF above it and choose Save as PDF.': 'Als je cv klaar is, druk je op Pdf downloaden erboven en kies je Opslaan als pdf.',
    'You can upload your old CV with the paperclip button next to the message box.': 'Je kunt je oude cv uploaden met de paperclipknop naast het berichtvak.',
    'Click any text on your CV and type to change it, or switch to Fill in myself to edit everything in a simple form.': 'Klik op een tekst in je cv en typ om die te wijzigen, of ga naar Zelf invullen om alles in een eenvoudig formulier te bewerken.',
    'Always keep your CV honest. Employers check, and a strong, true line beats a big claim.': 'Houd je cv altijd eerlijk. Werkgevers controleren het, en een sterke, ware zin wint het van een grote bewering.',
    "The AI isn't available right now, so I'll keep going with the guided questions.": 'De AI is nu niet beschikbaar, dus ik ga verder met de begeleide vragen.',
    "Hi, I'm your Inkline interviewer. I'll ask a few easy questions and write your CV as we go. You can skip anything, ask me questions any time, or upload your old CV with the paperclip. First, what's your full name?": "Hoi, ik ben je Inkline-interviewer. Ik stel een paar makkelijke vragen en schrijf je cv terwijl we praten. Je kunt alles overslaan, me altijd vragen stellen, of je oude cv uploaden met de paperclip.\n\nEerst: wat is je volledige naam?",
    // messages from the server (when the AI is switched on)
    'This request is not allowed.': 'Dit verzoek is niet toegestaan.', 'Requests must be sent as JSON.': 'Verzoeken moeten als JSON worden verstuurd.',
    "You're sending messages very quickly. Please wait a minute and try again.": 'Je stuurt heel snel berichten. Wacht een minuut en probeer het opnieuw.',
    "You've used the AI a lot this hour. Please try again a bit later.": 'Je hebt de AI dit uur veel gebruikt. Probeer het over een tijdje opnieuw.',
    'Slow down a little. Please wait a moment before sending again.': 'Rustig aan. Wacht even voordat je opnieuw verstuurt.', 'That was just sent. Please wait a moment.': 'Dat is net verstuurd. Wacht even.',
    'Please slow down.': 'Rustig aan, alsjeblieft.',
    'The AI has reached its limit for today. Please try again tomorrow. You can still fill in a template yourself.': 'De AI heeft zijn limiet voor vandaag bereikt. Probeer het morgen opnieuw. Je kunt nog wel zelf een sjabloon invullen.',
    "You've reached today's limit for the AI. It resets tomorrow. You can still fill in a template yourself.": 'Je hebt de limiet voor de AI van vandaag bereikt. Morgen begint die opnieuw. Je kunt nog wel zelf een sjabloon invullen.',
    'Something went wrong on our side. Please try again in a moment.': 'Er ging iets mis aan onze kant. Probeer het zo opnieuw.',
    'The AI is not switched on yet.': 'De AI is nog niet ingeschakeld.', 'That is too much to send at once.': 'Dat is te veel om in één keer te versturen.',
    'The request could not be read.': 'Het verzoek kon niet worden gelezen.', 'Unknown request.': 'Onbekend verzoek.', 'Please type a message.': 'Typ een bericht.',
    "Sorry, the AI couldn't answer just now. Please try again.": 'Sorry, de AI kon nu geen antwoord geven. Probeer het opnieuw.',
    'This chat has expired. Starting a fresh one.': 'Deze chat is verlopen. Er wordt een nieuwe gestart.',
    "I can only help with your CV here, so I can't answer that. Shall we carry on with your CV?": 'Ik kan je hier alleen helpen met je cv, dus daar kan ik geen antwoord op geven. Zullen we verdergaan met je cv?',
    'Carry on with my CV': 'Verder met mijn cv', 'Show me designs': 'Laat ontwerpen zien',
    'This CV chat has reached its length limit. Your CV is saved: you can keep editing it yourself, or start a new chat tomorrow.': 'Deze cv-chat heeft zijn maximale lengte bereikt. Je cv is bewaard: je kunt het zelf verder bewerken, of morgen een nieuwe chat beginnen.',
    "That file isn't what its name says it is. Please upload a real PDF or photo.": 'Dat bestand is niet wat de naam zegt. Upload een echte pdf of foto.',
    "That image couldn't be read. Please try another photo.": 'Die afbeelding kon niet worden gelezen. Probeer een andere foto.',
    'That document is too long to read. Please upload a shorter CV.': 'Dat document is te lang om te lezen. Upload een korter cv.',
    'That file type is not supported. Please upload a PDF, a Word or Pages document, or a photo (JPG, PNG, WebP).': 'Dat bestandstype wordt niet ondersteund. Upload een pdf, een Word- of Pages-document, of een foto (JPG, PNG, WebP).',
    'The upload could not be read.': 'De upload kon niet worden gelezen.', 'Please choose a file to upload.': 'Kies een bestand om te uploaden.',

    // ---------- privacy page ----------
    'Privacy policy · Inkline': 'Privacybeleid · Inkline', 'Privacy policy': 'Privacybeleid',
    'How Inkline handles your information: your CV and photo stay in your browser, no cookies, no tracking.': 'Hoe Inkline met je gegevens omgaat: je cv en foto blijven in je browser, geen cookies, geen tracking.',
    'Last updated: 12 October 2026': 'Laatst bijgewerkt: 12 oktober 2026', 'The short version': 'De korte versie',
    "Only if you use the AI interviewer (when it's switched on) does what you type go to our server and an AI company, just to write your CV. It is deleted after 24 hours and isn't used to train AI.": 'Alleen als je de AI-interviewer gebruikt (zodra die aanstaat), gaat wat je typt naar onze server en een AI-bedrijf, uitsluitend om je cv te schrijven. Het wordt na 24 uur gewist en niet gebruikt om AI te trainen.',
    'Paid features': 'Betaalde functies', 'Hosting': 'Hosting',
    'This box shows what is active right now. The sections below also explain what happens once the AI interviewer or paid features are switched on, so you know in advance.': 'Dit vak laat zien wat er nu actief is. De onderdelen hieronder leggen ook uit wat er gebeurt zodra de AI-interviewer of betaalde functies worden ingeschakeld, zodat je het van tevoren weet.',
    '1. Who is responsible': '1. Wie is verantwoordelijk', '2. What stays on your device': '2. Wat er op je apparaat blijft',
    "To keep your work safe between visits, the CV maker saves these in your browser's own storage on your device:": 'Om je werk tussen bezoeken veilig te bewaren, slaat de cv-maker het volgende op in de eigen opslag van je browser op je apparaat:',
    'your CV text, the messages shown in the chat, and your choices (design, colour, font, sections, icons)': 'de tekst van je cv, de berichten in de chat en je keuzes (ontwerp, kleur, lettertype, onderdelen, iconen)',
    'your photo, and the uncropped photo so you can crop it again': 'je foto, en de onbijgesneden foto zodat je hem opnieuw kunt bijsnijden',
    'the file the text reader needs to read photos of CVs (no personal information)': "het bestand dat de tekstlezer nodig heeft om foto's van cv's te lezen (geen persoonsgegevens)",
    "This storage is needed to give you the service you asked for, so the law doesn't require a cookie banner for it. It isn't used to track you.": 'Deze opslag is nodig om je de dienst te geven waar je om vroeg, dus de wet vereist hiervoor geen cookiebanner. Het wordt niet gebruikt om je te volgen.',
    '3. Visiting the website': '3. De website bezoeken',
    "We don't use analytics, advertising, social media buttons or any other tracking. If that ever changes, we'll ask for your permission first.": 'We gebruiken geen analytics, advertenties, socialemediaknoppen of andere tracking. Verandert dat ooit, dan vragen we eerst je toestemming.',
    '4. When you use the AI interviewer': '4. Als je de AI-interviewer gebruikt',
    'This applies only once the AI interviewer is switched on (see the box at the top), and only if you choose to use it. You can always make your CV without the AI.': 'Dit geldt pas zodra de AI-interviewer is ingeschakeld (zie het vak bovenaan), en alleen als je ervoor kiest hem te gebruiken. Je kunt je cv altijd zonder de AI maken.',
    'What we receive': 'Wat we ontvangen', 'the messages you type in the chat and the CV as it stands': 'de berichten die je in de chat typt en het cv zoals het er op dat moment uitziet',
    'an old CV you upload while the AI is on. The file itself is passed on to the AI and not stored by us; the details read from it are kept with your chat (see below).': 'een oud cv dat je uploadt terwijl de AI aanstaat. Het bestand zelf wordt aan de AI doorgegeven en niet door ons opgeslagen; de gegevens die eruit worden gelezen, worden bij je chat bewaard (zie hieronder).',
    'What happens with it': 'Wat ermee gebeurt', 'Why we may do this': 'Waarom we dit mogen doen',
    'We use what you send to provide the service you asked for: writing your CV (GDPR article 6(1)(b)). The scrambled IP address, counters and logs protect the service from misuse (legitimate interest, article 6(1)(f)).': 'We gebruiken wat je stuurt om de dienst te leveren waar je om vroeg: je cv schrijven (AVG artikel 6 lid 1 sub b). Het versleutelde IP-adres, de tellers en de logboeken beschermen de dienst tegen misbruik (gerechtvaardigd belang, artikel 6 lid 1 sub f).',
    'The AI never makes decisions about you. It only suggests text that you can change.': 'De AI neemt nooit beslissingen over jou. Hij stelt alleen tekst voor die je kunt aanpassen.',
    '5. When you buy something': '5. Als je iets koopt', 'This applies only once paid features exist. Inkline is free right now.': 'Dit geldt pas zodra er betaalde functies zijn. Inkline is nu gratis.',
    'A payment company (such as Stripe or Mollie) handles your payment. We never see or store your full card or bank details. The company will be named here before payments start.': 'Een betaalbedrijf (zoals Stripe of Mollie) handelt je betaling af. We zien of bewaren nooit je volledige kaart- of bankgegevens. Het bedrijf wordt hier genoemd voordat betalingen starten.',
    'We receive what we need for the order and the law: your name, email address, what you bought, the amount, the date and a payment reference.': 'We ontvangen wat we nodig hebben voor de bestelling en de wet: je naam, e-mailadres, wat je kocht, het bedrag, de datum en een betalingskenmerk.',
    'We use this to deliver what you bought and handle refunds (article 6(1)(b)), and to meet tax law (article 6(1)(c)).': 'We gebruiken dit om te leveren wat je kocht en terugbetalingen af te handelen (artikel 6 lid 1 sub b), en om aan de belastingwet te voldoen (artikel 6 lid 1 sub c).',
    '6. Who else receives information': '6. Wie er verder gegevens ontvangt',
    'Only the companies named above that help run the service: the web host, the AI company (if you use the AI) and the payment company (if you buy something). We never sell your information or share it for advertising.': 'Alleen de hierboven genoemde bedrijven die helpen de dienst te laten werken: de webhost, het AI-bedrijf (als je de AI gebruikt) en het betaalbedrijf (als je iets koopt). We verkopen je gegevens nooit en delen ze nooit voor advertenties.',
    "Some of these companies are in the USA. Where information goes outside the EU, it is protected by the safeguards EU law requires, such as the EU–US Data Privacy Framework or the EU's Standard Contractual Clauses.": 'Sommige van deze bedrijven zitten in de VS. Als gegevens buiten de EU gaan, worden ze beschermd met de waarborgen die de EU-wet vereist, zoals het EU-VS Data Privacy Framework of de standaardcontractbepalingen van de EU.',
    '7. How long information is kept': '7. Hoe lang gegevens worden bewaard', 'Information': 'Gegevens', 'How long': 'Hoe lang',
    'Your CV and photo in your browser': 'Je cv en foto in je browser', "Until you press Start over or clear your browser's site data": 'Tot je op Opnieuw beginnen drukt of de sitegegevens in je browser wist',
    'AI chat on our server': 'AI-chat op onze server', 'Up to 24 hours, or until you press Start over': 'Maximaal 24 uur, of tot je op Opnieuw beginnen drukt',
    'Old CV uploaded to the AI': 'Oud cv dat naar de AI is geüpload',
    "The file isn't stored. The details read from it are kept with your chat for up to 24 hours": 'Het bestand wordt niet bewaard. De gegevens die eruit zijn gelezen, worden maximaal 24 uur bij je chat bewaard',
    'Scrambled IP address and usage counters': 'Versleuteld IP-adres en gebruikstellers', 'Up to 3 days': 'Maximaal 3 dagen',
    'Technical logs (no CV contents)': 'Technische logboeken (geen cv-inhoud)', '30 days': '30 dagen',
    'Purchase records (once paid features exist)': 'Aankoopgegevens (zodra er betaalde functies zijn)', '7 years, as Dutch tax law requires': '7 jaar, zoals de Nederlandse belastingwet vereist',
    '8. Children': '8. Kinderen', '9. Your rights': '9. Je rechten',
    'You can ask to see, correct or delete your information, ask us to limit or stop using it, object to how we use it, or receive a copy of it. Because we keep so little, you can do most of this yourself: your CV lives in your browser, and Start over deletes your AI chat from our server.': 'Je kunt vragen om je gegevens in te zien, te corrigeren of te wissen, ons vragen het gebruik ervan te beperken of te stoppen, bezwaar maken tegen hoe we ze gebruiken, of een kopie ervan krijgen. Omdat we zo weinig bewaren, kun je het meeste hiervan zelf doen: je cv staat in je browser, en Opnieuw beginnen wist je AI-chat van onze server.',
    '10. How we protect it': '10. Hoe we het beschermen', 'The connection to the website is encrypted (HTTPS).': 'De verbinding met de website is versleuteld (HTTPS).',
    "Keys for the AI service are kept on the server, never in the website's code.": 'Sleutels voor de AI-dienst staan op de server, nooit in de code van de website.',
    'Uploaded files are checked and never saved. Logs never contain what you wrote.': 'Geüploade bestanden worden gecontroleerd en nooit opgeslagen. Logboeken bevatten nooit wat je schreef.',
    'Limits on use protect against spam and misuse.': 'Gebruikslimieten beschermen tegen spam en misbruik.', '11. Changes to this policy': '11. Wijzigingen in dit beleid',
    'When something changes, for example when the AI interviewer or payments are switched on, we update this page and the date at the top. Important changes will also be shown on the website.': 'Als er iets verandert, bijvoorbeeld wanneer de AI-interviewer of betalingen worden ingeschakeld, werken we deze pagina en de datum bovenaan bij. Belangrijke wijzigingen worden ook op de website getoond.',
    'Home': 'Home', 'Make my CV': 'Maak mijn cv', 'What is switched on right now': 'Wat er nu is ingeschakeld'
  };

  // Names that only appear in attributes (colour swatches); kept apart so design names like "Sage" are never touched.
  const NL_ATTR = {
    'Navy': 'Marineblauw', 'Teal': 'Petrol', 'Sage': 'Saliegroen', 'Ochre': 'Oker', 'Rose': 'Roze', 'Plum': 'Pruim', 'Charcoal': 'Antraciet',
    'Royal blue': 'Koningsblauw', 'Ocean': 'Oceaan', 'Emerald': 'Smaragd', 'Forest': 'Bosgroen', 'Olive': 'Olijf', 'Crimson': 'Karmijn',
    'Burgundy': 'Bordeaux', 'Mocha': 'Mokka', 'Slate': 'Leisteen'
  };

  // Paragraphs with bold words or links inside, matched as a whole.
  const NL_HTML = {
    "<b>Have an old CV?</b> Upload it as a Word file, PDF or even a photo. Inkline fills in a fresh CV from it, then asks what's new.": '<b>Heb je een oud cv?</b> Upload het als Word-bestand, pdf of zelfs als foto. Inkline vult er een nieuw cv mee in en vraagt daarna wat er nieuw is.',
    'Your CV and photo stay saved in this browser. <a href="privacy.html">Privacy</a> · <a href="index.html">Back to the home page</a>': 'Je cv en foto blijven bewaard in deze browser. <a href="privacy.html">Privacy</a> · <a href="index.html">Terug naar de homepage</a>',
    'Your CV, your photo and your design choices are saved <strong>in your own browser</strong>, not on our servers.': 'Je cv, je foto en je ontwerpkeuzes worden bewaard <strong>in je eigen browser</strong>, niet op onze servers.',
    "Reading your old CV (Word, PDF, photos) happens <strong>on your own device</strong>. The file isn't uploaded.": "Het lezen van je oude cv (Word, pdf, foto's) gebeurt <strong>op je eigen apparaat</strong>. Het bestand wordt niet geüpload.",
    "<strong>No cookies, no tracking, no ads.</strong> The website doesn't contact Google, Facebook or any other company while you use it.": '<strong>Geen cookies, geen tracking, geen advertenties.</strong> De website neemt geen contact op met Google, Facebook of een ander bedrijf terwijl je hem gebruikt.',
    'Your photo is <strong>never sent anywhere</strong>, not even to the AI.': 'Je foto wordt <strong>nooit ergens heen gestuurd</strong>, zelfs niet naar de AI.',
    '<span class="off">Not switched on yet.</span> The guided questions work entirely in your browser.': '<span class="off">Nog niet ingeschakeld.</span> De begeleide vragen werken volledig in je browser.',
    '<span class="off">None yet.</span> Inkline is free.': '<span class="off">Nog geen.</span> Inkline is gratis.',
    'Inkline is run by <strong>Modar Abou Shahin</strong>, based in the Netherlands. I am responsible for your personal information under the EU General Data Protection Regulation (GDPR).': 'Inkline wordt gerund door <strong>Modar Abou Shahin</strong>, gevestigd in Nederland. Ik ben verantwoordelijk voor je persoonsgegevens onder de Algemene verordening gegevensbescherming (AVG) van de EU.',
    "<strong>Contact:</strong> a dedicated email address for privacy questions is being set up and will appear here before the AI interviewer or any paid feature is switched on. Until then, the website doesn't collect personal information about you, so there is nothing stored with us to look up or delete.": '<strong>Contact:</strong> er wordt een apart e-mailadres voor privacyvragen ingericht. Dat verschijnt hier voordat de AI-interviewer of een betaalde functie wordt ingeschakeld. Tot die tijd verzamelt de website geen persoonsgegevens over jou, dus er is bij ons niets opgeslagen om in te zien of te wissen.',
    "We can't see any of this. It never leaves your device unless you use the AI interviewer (section 4). To delete it, press <strong>Start over</strong> in the CV maker, or clear this website's data in your browser settings.": 'Wij kunnen hier niets van zien. Het verlaat je apparaat nooit, tenzij je de AI-interviewer gebruikt (onderdeel 4). Om het te wissen, druk je in de cv-maker op <strong>Opnieuw beginnen</strong>, of wis je de gegevens van deze website in je browserinstellingen.',
    'The website is hosted by GitHub Pages (GitHub, Inc., USA). Like any web host, GitHub processes technical information such as your IP address and browser type to deliver the pages and keep the service secure. See <a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement" rel="noopener">GitHub\'s privacy statement</a>.': 'De website wordt gehost door GitHub Pages (GitHub, Inc., VS). Zoals elke webhost verwerkt GitHub technische gegevens zoals je IP-adres en browsertype om de pagina\'s te leveren en de dienst veilig te houden. Zie de <a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement" rel="noopener">privacyverklaring van GitHub</a>.',
    "We <strong>don't</strong> receive your photo. Please don't put sensitive information in your CV that you don't need, such as your health, religion, ID or passport numbers.": 'We ontvangen je foto <strong>niet</strong>. Zet geen gevoelige informatie in je cv die je niet nodig hebt, zoals je gezondheid, geloof of je ID- of paspoortnummer.',
    '<strong>Our server</strong> keeps your chat for up to <strong>24 hours</strong> so the conversation can continue, then deletes it automatically. Pressing Start over deletes it straight away.': '<strong>Onze server</strong> bewaart je chat maximaal <strong>24 uur</strong> zodat het gesprek verder kan, en wist hem daarna automatisch. Met Opnieuw beginnen wis je hem meteen.',
    "<strong>An AI company</strong> writes the replies and the CV text. We use one of these: OpenAI (the maker of ChatGPT) or Anthropic (the maker of Claude). The one in use will be named in the box at the top. We use their business service, whose terms don't let them train their AI on your information. They may keep it for a short time to check for misuse, as their terms describe.": '<strong>Een AI-bedrijf</strong> schrijft de antwoorden en de tekst van het cv. We gebruiken een van deze: OpenAI (de maker van ChatGPT) of Anthropic (de maker van Claude). Welke in gebruik is, wordt in het vak bovenaan genoemd. We gebruiken hun zakelijke dienst, waarvan de voorwaarden niet toestaan dat ze hun AI met jouw gegevens trainen. Ze mogen die gegevens korte tijd bewaren om op misbruik te controleren, zoals hun voorwaarden beschrijven.',
    '<strong>To stop abuse and keep costs under control</strong>, we keep a scrambled (hashed) version of your IP address with counters of how often the AI was used. Counters are deleted after 3 days. Our technical logs record events like "a reply was written" and how long it took, never what you wrote. Logs are deleted after 30 days.': '<strong>Om misbruik te stoppen en de kosten in de hand te houden</strong>, bewaren we een versleutelde (gehashte) versie van je IP-adres met tellers van hoe vaak de AI is gebruikt. Tellers worden na 3 dagen gewist. Onze technische logboeken registreren gebeurtenissen zoals "er is een antwoord geschreven" en hoe lang dat duurde, nooit wat je schreef. Logboeken worden na 30 dagen gewist.',
    'Dutch tax law requires us to keep these records for <strong>7 years</strong>.': 'De Nederlandse belastingwet verplicht ons deze gegevens <strong>7 jaar</strong> te bewaren.',
    "Anyone can make a CV with Inkline without the AI. The AI interviewer and paid features are for people aged <strong>16 and over</strong>, or younger with a parent's or guardian's permission. If you think a child under 16 sent us information without permission, contact us and we will delete it.": 'Iedereen kan zonder de AI een cv maken met Inkline. De AI-interviewer en betaalde functies zijn voor mensen van <strong>16 jaar en ouder</strong>, of jonger met toestemming van een ouder of voogd. Denk je dat een kind onder de 16 ons zonder toestemming gegevens heeft gestuurd? Neem dan contact met ons op, dan wissen we ze.',
    'If you\'re unhappy with how we handle your information, you can complain to the Dutch data protection authority, the <a href="https://autoriteitpersoonsgegevens.nl" rel="noopener">Autoriteit Persoonsgegevens</a>.': 'Ben je niet tevreden over hoe we met je gegevens omgaan, dan kun je een klacht indienen bij de Nederlandse toezichthouder, de <a href="https://autoriteitpersoonsgegevens.nl" rel="noopener">Autoriteit Persoonsgegevens</a>.'
  };

  // Sentences with a changing part (a name, a number) are matched by pattern.
  const SECTION = { 'Contact details': 'Contactgegevens', Profile: 'Profiel', Experience: 'Ervaring', Education: 'Opleiding', Skills: 'Vaardigheden', Languages: 'Talen' };
  const lookup = s => (NL[s] != null ? NL[s] : s);
  // "your name, 2 jobs and your certifications" -> "je naam, 2 banen en je certifications"
  const COUNT = { job: ['baan', 'banen'], qualification: ['opleiding', 'opleidingen'], skill: ['vaardigheid', 'vaardigheden'], language: ['taal', 'talen'] };
  function listNL(s) {
    const items = s.replace(/ and ([^,]+)$/, ', $1').split(', ').map(x => {
      if (NL[x] != null) return NL[x];
      let m = x.match(/^(\d+) (job|qualification|skill|language)s?$/);
      if (m) return `${m[1]} ${COUNT[m[2]][m[1] === '1' ? 0 : 1]}`;
      m = x.match(/^your (.+)$/);
      return m ? 'je ' + m[1] : x;
    });
    return items.length > 1 ? items.slice(0, -1).join(', ') + ' en ' + items[items.length - 1] : items[0];
  }
  const PATTERNS = [
    [/^I read your old CV right here on your device, so it wasn't sent anywhere\. I found (.+?)\. (Reading text from a picture is never perfect, so please check your new CV carefully and click any text to fix it\.|Please check your new CV and click any text to fix it\.)$/,
      (m, a, b) => `Ik heb je oude cv hier op je apparaat gelezen, dus het is nergens heen gestuurd. Ik vond ${listNL(a)}. ${lookup(b)}`],
    [/^I couldn't read enough from that picture(?: \(only (.+)\))?\. A sharp, straight photo in good light works best, or a screenshot of the CV\. Or let's fill it in together now\.$/,
      (m, a) => `Ik kon niet genoeg lezen uit die afbeelding${a ? ` (alleen ${listNL(a)})` : ''}. Een scherpe, rechte foto bij goed licht werkt het best, of een screenshot van het cv. Of laten we het nu samen invullen.`],
    [/^I could only find (.+) in that file\. If you have the original Word or PDF file, try that\. Or let's fill in the rest together\.$/,
      (m, a) => `Ik kon alleen ${listNL(a)} vinden in dat bestand. Heb je het originele Word- of pdf-bestand? Probeer dat dan. Of laten we de rest samen invullen.`],
    [/^Design: (.+)$/, (m, a) => 'Ontwerp: ' + a],
    [/^About (\d+) pages$/, (m, n) => `Ongeveer ${n} pagina's`],
    [/^Use the (\S+) design$/, (m, a) => `Gebruik het ontwerp ${a}`],
    [/^Show (.+)$/, (m, a) => SECTION[a] ? 'Toon ' + SECTION[a] : null],
    [/^Heading for (.+)$/, (m, a) => SECTION[a] ? 'Kopje voor ' + SECTION[a] : null],
    [/^Name of added section (\d+)$/, (m, n) => `Naam van toegevoegd onderdeel ${n}`],
    [/^Text next to the (.+) icon$/, (m, a) => `Tekst naast het icoon ${lookup(a)}`],
    [/^Colour of the (.+) icon$/, (m, a) => `Kleur van het icoon ${lookup(a)}`],
    [/^Size of the (.+) icon$/, (m, a) => `Grootte van het icoon ${lookup(a)}`],
    [/^Move this (.+) icon$/, (m, a) => `Verplaats het icoon ${lookup(a)}`],
    [/^Remove (.+)$/, (m, a) => `Verwijder ${a}`],
    [/^Nice to meet you, (.+)\. What job are you going for\?$/, (m, a) => `Leuk je te ontmoeten, ${a}. Voor welke baan ga je?`],
    [/^See all (\d+) designs$/, (m, n) => `Bekijk alle ${n} ontwerpen`],
    [/^Your CV in (\d+) designs\. Tap one to use it\.$/, (m, n) => `Je cv in ${n} ontwerpen. Tik op een ontwerp om het te gebruiken.`],
    [/^(.+) it is\. Click any text on your CV to change it, or edit everything in the form\. You can also try other colours and fonts above your CV\.$/,
      (m, a) => `${a} wordt het. Klik op een tekst in je cv om die te wijzigen, of bewerk alles in het formulier. Je kunt boven je cv ook andere kleuren en lettertypes proberen.`],
    [/^Your old CV says you still work at (.+)\. When did that job end\? For example 'Dec 2024'\.$/, (m, a) => `Volgens je oude cv werk je nog bij ${a}. Wanneer stopte die baan? Bijvoorbeeld 'dec 2024'.`],
    [/^Headings are now in (.+)\. You can still rename any of them\.$/, (m, a) => `Taal van de kopjes: ${a}. Je kunt ze nog steeds allemaal hernoemen.`],
    [/^(.+) added\. Drag the (icon|dots) to move it, and type your text next to it\.$/,
      (m, a, w) => `${lookup(a)} toegevoegd. Sleep ${w === 'icon' ? 'het icoon' : 'de puntjes'} om het te verplaatsen en typ je tekst ernaast.`],
    [/^Uploaded my old CV: (.+)$/, (m, a) => `Mijn oude cv geüpload: ${a}`],
    [/^I can't read "(.+)"\. Word, PDF, Pages, OpenDocument, RTF and text files all work, and so do photos and screenshots of a CV\. If it's another kind, try saving it as a PDF\.$/,
      (m, a) => `Ik kan "${a}" niet lezen. Word-, pdf-, Pages-, OpenDocument-, RTF- en tekstbestanden werken allemaal, net als foto's en screenshots van een cv. Is het een ander soort bestand? Sla het dan op als pdf.`],
    [/^Reading the text in your picture(?: \((\d+) of (\d+)\))?… (\d+)%$/,
      (m, i, n, p) => `De tekst in je afbeelding wordt gelezen${i ? ` (${i} van ${n})` : ''}… ${p}%`],
    [/^Hi (.+?)\. I can see you've started your CV\. I'll ask about anything that's missing, and you can skip whatever you like\.$/,
      (m, a) => `Hoi${a === 'there' ? '' : ' ' + a}. Ik zie dat je al aan je cv bent begonnen. Ik vraag naar alles wat nog ontbreekt, en je kunt overslaan wat je wilt.`],
    [/^Press the Design button above your CV to see all (\d+) designs\. The Colour button next to it has (\d+) colours, or pick any colour you like\.$/,
      (m, d, c) => `Druk op de knop Ontwerp boven je cv om alle ${d} ontwerpen te zien. De knop Kleur ernaast heeft ${c} kleuren, of kies zelf een kleur.`],
    [/^(.+) Your answers are safe\.$/, (m, a) => `${lookup(a)} Je antwoorden zijn veilig.`],
    [/^That is too much to send at once\. Files can be up to (\d+) MB in total\.$/, (m, n) => `Dat is te veel om in één keer te versturen. Bestanden mogen samen maximaal ${n} MB zijn.`],
    [/^Please upload up to (\d+) files at a time\.$/, (m, n) => `Upload maximaal ${n} bestanden tegelijk.`],
    [/^Each file can be up to (\d+) MB\.$/, (m, n) => `Elk bestand mag maximaal ${n} MB zijn.`],
    [/^Your files can be up to (\d+) MB together\.$/, (m, n) => `Je bestanden mogen samen maximaal ${n} MB zijn.`],
    [/^That message is too long\. Please keep it under (\d+) characters\.$/, (m, n) => `Dat bericht is te lang. Houd het onder de ${n} tekens.`],
    [/^You've made (\d+) AI CVs today, which is the daily limit\. It resets tomorrow\. You can still fill in a template yourself\.$/,
      (m, n) => `Je hebt vandaag ${n} AI-cv's gemaakt, het maximum per dag. Morgen begint het opnieuw. Je kunt nog wel zelf een sjabloon invullen.`],
    [/^You've uploaded (\d+) files today, which is the daily limit\. It resets tomorrow\.$/, (m, n) => `Je hebt vandaag ${n} bestanden geüpload, het maximum per dag. Morgen begint het opnieuw.`]
  ];

  const norm = s => String(s).replace(/\s+/g, ' ').trim();
  function tr(s, attr) {
    const k = norm(s);
    if (!k) return null;
    if (NL[k] != null) return NL[k];
    if (attr && NL_ATTR[k] != null) return NL_ATTR[k];
    for (const [re, f] of PATTERNS) {
      const m = k.match(re);
      if (m) { const v = f(...m); if (v != null) return v; }
    }
    return null;
  }
  // For code: t('Text with {name}', { name }) gives the Dutch (or English) text with the parts filled in.
  function t(s, vars) {
    let out = s;
    if (lang === 'nl') {
      const lead = s.match(/^\s*/)[0], trail = s.match(/\s*$/)[0], v = tr(s);
      if (v != null) out = lead + v + trail;
    }
    return vars ? out.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m)) : out;
  }

  // ---------- translating what is on screen ----------
  const SKIP = 'script,style,noscript,template,.cv,#sheet,#print-root,[data-no-i18n],.tagchip';
  const INLINE = /^(B|STRONG|EM|I|A|SPAN|BR|CODE|SMALL|U)$/;
  const ATTRS = ['placeholder', 'aria-label', 'title', 'alt'];
  const letters = s => /[A-Za-z]{2}/.test(s);
  function doAttr(el, a) {
    const v = el.getAttribute(a);
    if (v && letters(v)) { const nv = tr(v, true); if (nv != null && nv !== v) el.setAttribute(a, nv); }
  }
  function doText(node) {
    const raw = node.nodeValue;
    if (!raw || !letters(raw)) return;
    const v = tr(raw);
    if (v == null) return;
    const nv = raw.match(/^\s*/)[0] + v + raw.match(/\s*$/)[0];
    if (nv !== raw) node.nodeValue = nv;   // writing the same text again would wake the watcher below forever
  }
  function sampleCV(el) {
    // the design samples on the home page show a made-up person in English; only their headings follow the language
    const H = { Profile: 'Profiel', Experience: 'Werkervaring', Education: 'Opleiding', Skills: 'Vaardigheden', Languages: 'Talen', Contact: 'Contact', Certifications: 'Certificaten' };
    el.querySelectorAll('h2').forEach(h => { const k = norm(h.textContent); if (H[k]) h.textContent = H[k]; });
    el.querySelectorAll('.cv-dates').forEach(d => { d.textContent = d.textContent.replace(' to ', ' tot ').replace('Present', 'heden'); });
  }
  function walk(node) {
    if (node.nodeType === 3) return doText(node);
    if (node.nodeType !== 1) return;
    if (node.matches('input,textarea')) { ATTRS.forEach(a => node.hasAttribute(a) && doAttr(node, a)); return; }
    if (node.matches(SKIP)) { if (node.matches('.mini .cv, .mini>.cv')) sampleCV(node); return; }
    ATTRS.forEach(a => node.hasAttribute(a) && doAttr(node, a));
    const kids = node.childNodes;
    if (kids.length > 1 && [...kids].some(k => k.nodeType === 1 && INLINE.test(k.tagName)) && [...kids].some(k => k.nodeType === 3 && letters(k.nodeValue))) {
      const v = NL_HTML[norm(node.innerHTML)];
      if (v != null) { if (norm(v) !== norm(node.innerHTML)) node.innerHTML = v; return; }
    }
    [...kids].forEach(walk);
  }
  const skipped = n => { const el = n.nodeType === 1 ? n : n.parentElement; return !el || (el.closest(SKIP) && !(n.nodeType === 1 && n.matches('input,textarea') && !(n.parentElement && n.parentElement.closest(SKIP)))); };

  function translatePage() {
    if (lang !== 'nl') return;
    const title = tr(document.title);
    if (title != null) document.title = title;
    const desc = document.querySelector('meta[name="description"]');
    if (desc) { const v = tr(desc.content); if (v != null) desc.content = v; }
    walk(document.body);
    // everything the page adds later (chat messages, panels, the form) is translated as it appears
    new MutationObserver(records => {
      for (const r of records) {
        if (r.type === 'childList') r.addedNodes.forEach(n => { if (!skipped(n)) walk(n); });
        else if (r.type === 'characterData') { if (!skipped(r.target)) doText(r.target); }
        else if (r.type === 'attributes' && !skipped(r.target)) doAttr(r.target, r.attributeName);
      }
    }).observe(document.body, { childList: true, characterData: true, attributes: true, attributeFilter: ATTRS, subtree: true });
  }

  // ---------- the EN | NL switch ----------
  function setLang(code) {
    if (code === lang) return;
    try { localStorage.setItem(KEY, code); } catch (e) { /* storage blocked: the link parameter still works */ }
    const u = new URL(location.href);
    u.searchParams.set('lang', code);
    location.replace(u.toString());
  }
  function mountSwitches() {
    document.querySelectorAll('[data-lang-switch]').forEach(box => {
      box.classList.add('lang-switch');
      box.setAttribute('role', 'group');
      box.setAttribute('aria-label', lang === 'nl' ? 'Taal' : 'Language');
      box.setAttribute('data-no-i18n', '');
      box.innerHTML = '';
      [['en', 'EN', 'English'], ['nl', 'NL', 'Nederlands']].forEach(([code, short, full]) => {
        const b = document.createElement('button');
        b.type = 'button'; b.lang = code; b.textContent = short; b.title = full;
        b.setAttribute('aria-label', full);
        b.setAttribute('aria-pressed', String(code === lang));
        b.addEventListener('click', () => setLang(code));
        box.appendChild(b);
      });
    });
  }
  const css = document.createElement('style');
  css.textContent = '.lang-switch{display:inline-flex;flex:none;gap:2px;padding:3px;border-radius:99px;background:rgba(255,255,255,.72);border:1px solid rgba(16,18,63,.14);box-shadow:0 6px 20px -12px rgba(16,18,63,.4);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px)}' +
    '.lang-switch button{border:0;background:transparent;color:#4A5279;border-radius:99px;padding:7px 10px;min-width:38px;font:600 12.5px/1 "Hanken Grotesk",system-ui,sans-serif;letter-spacing:.05em;cursor:pointer;transition:background-color .2s ease,color .2s ease}' +
    '.lang-switch button:hover{color:#10123F}.lang-switch button[aria-pressed="true"]{background:#10123F;color:#fff}' +
    '.lang-switch button:focus-visible{outline:2px solid #4C51B8;outline-offset:2px}' +
    '@media (pointer:coarse){.lang-switch button{min-height:36px;padding:8px 11px}}';
  document.head.appendChild(css);

  mountSwitches();
  translatePage();
  global.I18N = { lang, t, setLang };
})(window);
