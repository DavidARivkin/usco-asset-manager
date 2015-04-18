
import path from 'path'

export let parseFileUri = function(fileUri) {
  var fileName, pathInfo, storeName, url;
  url = require('url');
  pathInfo = url.parse(fileUri);
  storeName = pathInfo.protocol;
  fileName = pathInfo.host + pathInfo.pathname;
  storeName = storeName.replace(":", "");
  if (storeName === null) {
    if (pathInfo.path[0] === "/") {
      storeName = "local";
    } else {

    }
  } else if (storeName === "http" || storeName === "https") {
    storeName = "xhr";
    fileName = pathInfo.href;
  }
  return [storeName, fileName];
};

export let toAbsoluteUri = function(fileName, parentUri, store) {
  var fullPath, isXHr, rootUri, segments;
  path = require('path');
  segments = fileName.split("/");
  if (segments[0] !== '.' && segments[0] !== '..') {
    return fileName;
  }
  rootUri = parentUri || store.rootUri || "";
  fileName = path.normalize(fileName);
  isXHr = rootUri.indexOf("http") !== -1;
  if (isXHr) {
    fullPath = rootUri + fileName;
  } else {
    rootUri = rootUri[rootUri.length - 1] === "/" ? rootUri += "a" : rootUri;
    rootUri = path.normalize(rootUri);
    rootUri = path.dirname(rootUri);
    fullPath = path.join(rootUri, fileName);
  }
  return fullPath;
};

