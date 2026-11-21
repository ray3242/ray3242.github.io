# Qbodrop

Bank CSV/Excel to QuickBooks `.qbo` / `.ofx` converter. Static, runs fully in the browser, hosted on GitHub Pages at https://ray3242.github.io/qbodrop/.

- `converter.js`: parsing (CSV, dates, amounts, column detection) and the OFX/QBO writer. Tests: `node qbodrop/tests/converter.test.js`.
- `app.js`: the page logic (file in, column mapping, preview, licence key, download).
- `vendor/xlsx.full.min.js`: SheetJS 0.20.3 (Apache-2.0), loaded only for Excel files.
- `assets/`: the parts of [taste-skill](https://github.com/Leonxlnx/taste-skill) (MIT) the page uses.

## Taking payment (Gumroad)

1. Create a Gumroad product priced at $29 and switch on "Generate a unique license key per sale".
2. Put the product's URL and `product_id` (shown in the licence key module) in `config.js`.

With both values set, files over 10 transactions need a key; the page checks it against Gumroad's public licence API from the browser (no secret involved). With them empty, everything is open.
