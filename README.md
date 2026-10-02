# Inkline

An AI CV maker with a cinematic, scroll-driven home page.

**Live site:** https://8wpth7nhvn-creator.github.io/inkline/

- Make a CV with an AI interview, or fill in a template yourself
- Upload an old CV (PDF, Word, Pages, photos and more) and build a fresh one from it
- 11 original designs (6 colourful ones with a photo spot, 5 classic ones for online applications)
- 9 colours, 7 font styles, adjustable text sizes, free PDF download

Plain HTML, CSS and JavaScript with no build step. The AI runs through `api/ai.php` on a PHP host with a Claude API key in `api/config.php` (copy `api/config.example.php`). Without a key, or on static hosting such as GitHub Pages, the CV maker uses its built-in guided questions instead.

## Run it locally

```bash
php -S 127.0.0.1:8800
```

Then open http://127.0.0.1:8800.
