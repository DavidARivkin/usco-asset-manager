asset manager for usco project:
Handles resource loading and unloading in a centralized, controlled manner.
Main entry point for parsing and serializing.

General information
-------------------
This repository contains both the:
- node.js version:
assetManager.coffee in the src folder
- polymer.js/browser version which is a combo of
lib/asset-manager.js (browserified version of the above)
usco-asset-manager.html


How to generate browser/polymer.js version (with require support):
------------------------------------------------------------------
Type: 

    browserify stl-serializer.js -r ./stl-serializer.js:stl-serializer -o lib/stl-serializer.js -x composite-detect -x three

    browserify -x path -x url -x q -x composite-detect -x minilog  -r ./src/assetManager.coffee:AssetManager -t coffeeify --extension '.coffee' > lib/asset-manager.js



then replace (manually for now) all entries like this one in the generated file:

  "composite-detect":"awZPbp"

with the correct module names, ie:

   "composite-detect":"composite-detect"
