#pragma once
#include <functional>
#include <string>
#include "ixwebsocket/IXWebSocket.h"
#include "ixwebsocket/IXSocketTLSOptions.h"

class SocketManager {
 public:
	SocketManager(const std::string& url, const std::string& token, const ix::OnMessageCallback& callback);
	SocketManager(const SocketManager& other) = delete;
	SocketManager& operator=(const SocketManager& other) = delete;
	SocketManager& operator=(SocketManager& other) = delete;
	SocketManager& operator=(SocketManager&& other) = delete;
	SocketManager(SocketManager&& other) = delete;

	void	connect() noexcept(false);
	void	stop() noexcept(false);
	void	setCallback(const ix::OnMessageCallback& callback);
	void	send(const std::string& payload) noexcept(false);
 private:
	ix::WebSocket	webSocket;
};
