#pragma once
#include <cstddef>
#include <memory>
#include <string>
#include "ApiClient.hpp"
#include "SocketManager.hpp"
#include "User.hpp"
#include "EventEmitter.h"

typedef struct Store {
	Store(): socketManager(nullptr), user(nullptr), apiClient(nullptr), emitter() {};
	std::unique_ptr<SocketManager>			socketManager;
	std::unique_ptr<User>					user;
	std::unique_ptr<ApiClient>				apiClient;
	std::string								hostname;
	std::size_t								port;
	medooze::EventEmitter					emitter;
	bool									isConnected = false;
} Store;

extern Store g_store;
