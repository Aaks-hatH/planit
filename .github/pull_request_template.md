## What does this PR do?

<!-- Write 2-4 sentences. What problem does it solve? What changed? -->



## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Refactor / cleanup
- [ ] Docs / comments only
- [ ] Other: ___________

---

## Safety checklist

**Every box below must be ticked before requesting review.**
If you cannot tick a box, explain why in a comment.

###  Secrets & credentials
- [ ] I have NOT hardcoded any API keys, tokens, passwords, or connection strings
- [ ] I have NOT committed a `.env` file or any real credentials
- [ ] Any new config values I need are added to `.env.example` with a placeholder value (e.g. `STRIPE_SECRET_KEY=sk_test_YOUR_KEY_HERE`)
- [ ] I have searched my diff for the words: `sk_live`, `mongodb+srv`, `redis://`, `cloudinary`, `secret`, `password`, `token` — and none are real values

###  Dependencies (skip if no `package.json` changes)
- [ ] I discussed adding this new package with the repo owner BEFORE adding it
- [ ] I checked the package on npmjs.com (weekly downloads > 1000, published recently, trusted maintainer)
- [ ] I ran `npm audit` locally and there are no high/critical vulnerabilities
- [ ] I did NOT install a package that duplicates something already in the project (check existing `package.json` first)
###  Testing
- [ ] I tested my changes locally (`node server.js` runs without errors)
- [ ] I tested the specific feature/fix I changed in the browser
- [ ] I did NOT break any existing functionality I can see

###  Code quality
- [ ] My code follows the same style as the surrounding file (same quote style, same error handling pattern)
- [ ] I have not left `console.log` debug statements in the code
- [ ] I have not left commented-out blocks of old code
- [ ] If I touched `backend/middleware/auth.js` or `backend/keys.js`, I have a very good reason and explained it above

###  Security (backend changes only)
- [ ] Any new route that modifies data uses the appropriate auth middleware (`verifyToken`, `verifyOrganizer`, `verifyAdmin`)
- [ ] Any new route that accepts user input uses `express-validator` to validate and sanitize it
- [ ] I have not removed or weakened any existing auth/rate-limit middleware
- [ ] I have not changed the Stripe webhook handler without discussing it first

---

## Screenshots (if UI changed)

<!-- Paste before/after screenshots here. Delete this section if backend-only. -->

---

## Anything else the reviewer should know?

<!-- Edge cases, known issues, follow-up work needed, etc. -->
