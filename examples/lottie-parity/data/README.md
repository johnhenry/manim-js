# Lottie corpus

Real-world samples: the five `demo/*/data.json` animations from the
official lottie-web repository (github.com/airbnb/lottie-web, MIT),
fetched 2026-07-10 — adrock (690x913, precomps/masks/solids), bodymovin
(the logo wordmark, trim paths), gatin (800x800 shape animation),
happy2016 (1920x1080 precomp-heavy), navidad (1920x1080, track mattes).

Feature census (layers reached through assets too):
- adrock: group, mask, null, precomp, shape, solid
- bodymovin: group, mask, null, precomp, shape, TRIM
- gatin: group, null, shape, solid
- happy2016: group, mask, null, precomp, shape
- navidad: group, mask, MATTE, null, precomp, shape, solid

Features NOT exercised by the real corpus (gradients, repeaters,
polystar, text layers, isolated bezier-eased keyframes) are covered by
authored minimal fixtures in `fixtures/` (written for this test suite,
no external provenance).
