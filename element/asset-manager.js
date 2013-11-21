Polymer('asset-manager', {
  created: function() {
    AssetManager = require("AssetManager");
    console.log("AssetManager",AssetManager);
    this._assetManager = new AssetManager();
  },
  ready:function(){
  },
  enteredView: function() {
  },
  //API
  addParser: function( extension, parser )
  {
    return this._assetManager.addParser( extension, parser );
  },
  load: function( fileUri, parentUri, cachingParams )
  {
    //return this._assetManager.load( fileUri, parentUri, cachingParams );
    var promise = this._assetManager._testDeferred( fileUri );
    promise.then(function(result){

      console.log("Promise resolved with value", result);
    });
  }
});
