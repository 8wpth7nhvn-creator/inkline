# Inkline

An AI CV maker with a cinematic, scroll-driven home page.

**Live site:** https://8wpth7nhvn-creator.github.io/inkline/

- Make a CV with an AI interview, or fill in a template yourself
- Upload an old CV (PDF, Word, Pages, photos and more) and build a fresh one from it
- 11 original designs (6 colourful ones with a photo spot, 5 classic ones for online applications)
- 9 colours, 7 font styles, adjustable text sizes, free PDF download

Plain HTML, CSS and JavaScript with no build step. The AI runs through `api/ai.php` on any PHP 8.1+ host.
Without a key, or on static hosting such as GitHub Pages, the CV maker uses its built-in guided questions.

## Switching the AI on

1. Copy `.env.example` to `.env` and add your key (`OPENAI_API_KEY`, or `ANTHROPIC_API_KEY` with `AI_PROVIDER=anthropic`).
2. Put `.env` **one folder above the website folder** (for example above `public_html`), where no browser can reach it.
3. Set a monthly spending limit in your AI provider's dashboard as well.

`.env` is in `.gitignore`. Never commit it.

## Security and privacy

- **The key stays on the server.** Only `api/ai.php` uses it. It never appears in browser code, responses, logs or git.
- **Every limit is enforced on the server:** speed limits, bot detection with temporary blocks, daily limits per visitor
  (requests, new CVs, uploads), a site-wide daily ceiling, message and file size limits. All configurable in `.env`.
- **Conversations live on the server**, so the browser sends only each new message and cannot fake the history.
  They are deleted after `CONVERSATION_RETENTION_HOURS` (default 24), or immediately when the visitor presses Start over.
- **Uploads are checked by their real contents** (PDF, JPG, PNG, WebP, GIF only), never saved to disk, and sent to the AI once.
- **Photos never leave the visitor's browser.**
- **Nothing private is logged:** no CV contents, no messages, no IP addresses (hashed), no keys.
- **Strict Content Security Policy**: the pages run only this site's own code; fonts and libraries are self-hosted,
  so visitors never connect to third parties.
- Visitor limits use a hashed IP today. When accounts exist, make `current_user_id()` in `api/lib/limits.php`
  return the user's id and every limit becomes per account.

Security log summary on the server: `php api/tools/ai-stats.php`

## Run it locally

```bash
php -S 127.0.0.1:8800 dev-router.php
```

Then open http://127.0.0.1:8800. The router applies the same file protections as `.htaccess`.
