#include <exception>
#include <iostream>
#include <memory>
#define CPPHTTPLIB_OPENSSL_SUPPORT
#include "SocketManager.hpp"
#include "ixwebsocket/IXWebSocketHttpHeaders.h"
#include <cstdlib>
#include <sstream>
#include <string>
#include <httplib.h>
#include "../nlohmann-json/json.hpp"
#include "Store.hpp"
#include "Ui/Ui.hpp"
#include "ApiClient.hpp"
#include "SocketManager.hpp"
#include "User.hpp"

using namespace nlohmann;
Store g_store;

int main(int ac, char **av) {
	if (ac != 3) {
		std::cout << "usage: ./transcendence_cli hostname port" << std::endl;
		return 0;
	}
	g_store.hostname = av[1];
	g_store.port = std::atoll(av[2]);
	g_store.apiClient = std::make_unique<ApiClient>(g_store.hostname, g_store.port);
	g_store.user = std::make_unique<User>(*g_store.apiClient);

	try {
		Ui ui;
		ui.run();
	} catch (const std::exception& e) {
		std::cerr << "Error: " << e.what() << std::endl;
	}

	if (g_store.isConnected) g_store.socketManager->stop();
	return (0);
}
