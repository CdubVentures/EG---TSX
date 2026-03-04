DEBUG_KEY = "__olDebug";

if (typeof olCreateStorage == 'undefined') {
    var olCreateStorage = function (name, value) {
        localStorage.setItem(name, JSON.stringify(value));
    };
}

if (typeof olReadStorage == 'undefined') {
    var olReadStorage = function (name) {
        return JSON.parse(localStorage.getItem(name));
    };
}

if (typeof getOlCacheBuster == 'undefined') {
    var getOlCacheBuster = function() {
        if ( typeof getOlCacheBuster.olCacheBuster == 'undefined') {
            scriptsArray = Array.prototype.slice.call(document.getElementsByTagName("script"));
            scriptsArray = scriptsArray.concat(Array.prototype.slice.call(document.getElementsByTagName("noscript")));
            for (var i=0; i<scriptsArray.length; i++) {
                cacheBusterArray = scriptsArray[i].innerHTML.match(/orderlogicapp.com\\\/embedded_js\\\/production_base.js\?(\d+)/);
                if (cacheBusterArray == null) {
                    cacheBusterString = scriptsArray[i].getAttribute('src');
                    if (cacheBusterString != null) {
                        cacheBusterArray = cacheBusterString.match(/orderlogicapp.com\/embedded_js\/production_base.js\?(\d+)/);
                    }
                }
                if (cacheBusterArray != null) {
                    getOlCacheBuster.olCacheBuster = cacheBusterArray[1];
                    break;
                }
            }
        }
        return getOlCacheBuster.olCacheBuster;
    }
}

if (typeof ol_hostname == 'undefined') {
    var ol_hostname = 'www.orderlogicapp.com';
    var ol_debug = olReadStorage(DEBUG_KEY);
    if (window.location.search.replace("?", "").substring(0, 7) == 'olDebug') {
        ol_debug = window.location.search.replace("?olDebug=", "");
        if (ol_debug == 'false') ol_debug = false;
        olCreateStorage(DEBUG_KEY, ol_debug);
    }
}

var ol_cachebuster = getOlCacheBuster();
if (( typeof ol_cachebuster != 'undefined') || (ol_debug)) {
    if (typeof ol_script == 'undefined') {
        var ol_script = document.createElement('script');
        ol_script.type = 'text/javascript';
        ol_script.async = true;
        ol_script.src = "https://" + (ol_debug ? 'dev.orderlogicapp.com' : ol_hostname) + "/embedded_js/store.js?" + ol_cachebuster;
        document.head.appendChild(ol_script);
    }
}
