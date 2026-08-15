StockPilot v41.1 FLAT

Bu paketde alt qovluq yoxdur. Bütün fayllar eyni qovluqdadir.

Deploy:
  npx.cmd wrangler deploy

PIN reset lazim olsa:
  node reset-pin.mjs krenz
  npx.cmd wrangler d1 execute stockpilot-db --remote --file reset-pin.sql

Qeyd: worker.js, schema.sql, wrangler.jsonc ve reset-pin.mjs .assetsignore ile statik web asset kimi yayinlanmir.
