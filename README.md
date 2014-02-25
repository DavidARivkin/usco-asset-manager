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

   grunt build-browser-lib
