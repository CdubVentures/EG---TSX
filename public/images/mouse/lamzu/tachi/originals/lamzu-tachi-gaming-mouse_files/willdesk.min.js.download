(function(){
  class WilldeskPlatform{
    constructor(){
      this.developMode=false;
      this.defaultSrc='https://static.willdesk.com/c';
      this.src='https://u.willdesk.com';this.apiUrl='https://api.willdesk.com';
    }
  };
  const willdeskEnv=Object.freeze(new WilldeskPlatform());
  window.WilldeskPlatform=willdeskEnv;
  const willdeskCurrentMode=document.currentScript?document.currentScript.getAttribute('data-boot'):null;
  window.willdeskEntanceCallback = function (data) {
    if (!data || data.entranceJs.length == 0) {
      return
    }
    var entranceScript = document.createElement("script");
    willdeskCurrentMode && entranceScript.setAttribute("data-boot", willdeskEnv.developMode ? "dev" : true);
    entranceScript.type = "text/javascript";
    entranceScript.async = true;
    entranceScript.src = data.entranceJs;
    document.body.appendChild(entranceScript);
  };
  let shop = '';
  const origin = window.location.origin;
  if ('Shopify' in window) {
    shop = window.Shopify.shop || window.location.host;
  } else {
    shop = window.location.host
  };
  var mainScript = document.createElement("script");
  willdeskCurrentMode && mainScript.setAttribute("data-boot", willdeskEnv.developMode ? "dev" : true);
  mainScript.type = "text/javascript";
  mainScript.async = true;
  mainScript.src = willdeskEnv.apiUrl+"/api/v1/shop/local/entranceJs?customerDomain="+willdeskEnv.src+"&shopDomain="+shop+"&callback=willdeskEntanceCallback";
  document.body.appendChild(mainScript);
})()