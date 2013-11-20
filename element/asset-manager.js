Polymer('asset-manager', {
  created: function() {
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
    return this._assetManager.load( fileUri, parentUri, cachingParams );
  }
});
