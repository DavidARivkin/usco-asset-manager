var Resource;

Resource = (function() {
  function Resource(uri) {
    var _uriElems;
    this.uri = uri;
    _uriElems = uri.split("?");
    this.name = _uriElems.shift().split("/").pop();
    this.ext = this.name.split(".").pop().toLowerCase();
    this.queryParams = _uriElems.pop();
    this.data = null;
    this.error = null;
    this.rawData = null;
    this.rawDataType = null;
    this.size = 0;
    this.loaded = false;
    this.fetched = false;
    this.fetchProgress = 0;
    this.parseProgress = 0;
    this.totalRawSize = 0;
    this.totalDisplaySize = "";
    this.deferred = null;
  }

  return Resource;

})();

module.exports = Resource;

//# sourceMappingURL=resource.js.map
