/// WebRTC leak prevention module.
///
/// Provides a JavaScript scriptlet that is injected into all HTML responses
/// to prevent WebRTC STUN requests from leaking the user's real IP address.
/// This is critical for VPN privacy  - without it, websites can use
/// RTCPeerConnection to discover the client's real IP even behind the VPN.
///
/// This scriptlet is always active when the proxy is running (not gated by
/// subscription tier) because it's a privacy protection, not an ad-blocking feature.

/// JavaScript that overrides RTCPeerConnection to strip STUN servers,
/// preventing WebRTC IP leaks.
pub const WEBRTC_SHIELD_SCRIPT: &str = r#"(function(){
'use strict';
var origRTC=window.RTCPeerConnection||window.webkitRTCPeerConnection;
if(!origRTC)return;
var ProxiedRTC=function(config,constraints){
if(config&&config.iceServers){
config.iceServers=config.iceServers.filter(function(server){
var urls=Array.isArray(server.urls)?server.urls:(server.urls?[server.urls]:(server.url?[server.url]:[]));
return!urls.some(function(url){return url&&(typeof url==='string')&&url.indexOf('stun:')===0;});
});
}
return new origRTC(config,constraints);
};
ProxiedRTC.prototype=origRTC.prototype;
ProxiedRTC.generateCertificate=origRTC.generateCertificate;
Object.defineProperty(window,'RTCPeerConnection',{value:ProxiedRTC,writable:false,configurable:false});
if(window.webkitRTCPeerConnection){
Object.defineProperty(window,'webkitRTCPeerConnection',{value:ProxiedRTC,writable:false,configurable:false});
}
})();"#;
