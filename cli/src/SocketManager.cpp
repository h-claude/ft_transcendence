#include "SocketManager.hpp"
#include "Store.hpp"
#include "ixwebsocket/IXWebSocket.h"

SocketManager::SocketManager(const std::string& url, const std::string& token, const ix::OnMessageCallback& callback) {
    webSocket.setUrl(url);
	ix::SocketTLSOptions tlsOptions;
	tlsOptions.caFile = "NONE";
	tlsOptions.disable_hostname_validation = true;
	ix::WebSocketHttpHeaders headers;
	headers["Authorization"] = "Bearer " + token;
	webSocket.setExtraHeaders(headers);
	webSocket.setTLSOptions(tlsOptions);
    webSocket.setOnMessageCallback(callback);
    webSocket.start();
}

void SocketManager::send(const std::string& payload) {
    webSocket.send(payload);
}

void SocketManager::stop() {
	webSocket.stop();
	g_store.isConnected = false;
}
