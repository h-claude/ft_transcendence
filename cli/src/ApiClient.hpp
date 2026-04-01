#pragma once
#define CPPHTTPLIB_OPENSSL_SUPPORT
#include <stdexcept>
#include "httplib.h"
#include <cstddef>
#include "../nlohmann-json/json.hpp"

using namespace nlohmann;

class ApiClient {
 public:
	typedef struct Res_s {
		bool		ok = true;
		int			status;
		std::string	body;
	} Res_t;
	ApiClient(const std::string& hostname, const std::size_t port): _hostname(hostname), _port(port), _client(hostname, port) {
		_client.enable_server_hostname_verification(false);
		_client.enable_server_certificate_verification(false);
	}
	ApiClient(const ApiClient& o) = delete;
	ApiClient(ApiClient&& o) = delete;
	ApiClient operator=(const ApiClient& o) = delete;
	ApiClient operator=(ApiClient&& o) = delete;

	const Res_t login(const std::string& username, const std::string& password) {
		json j;
		j["username"] = username;
		j["password"] = password;

		auto res = _client.Post("/api/login", j.dump(), "application/json");
		if (!res || res->status == 409) {
			return {false, res->status, res->body};
		}
		return {true, res->status, res->body};
	}

	void	setToken(const std::string& token) {
		_token = token;
	}

	int getId() noexcept(false) {
		auto res = _client.Get("/api/users", _genHeaders());
		if (!res || res->status == 409) {
			throw (std::runtime_error(res->body));
		}
		json message = json::parse(json::parse(res->body)["message"].dump());
		return (message["id"]);
	}

	int	getUserIdByUsername(const std::string& username) noexcept(false) {
		auto res = _client.Get("/api/users/id/" + username, _genHeaders());
		if (!res || res->status == 404 || res->status == 409) {
			throw (std::runtime_error(res->body));
		}
		json message = json::parse(res->body)["message"].dump();
		return (message);
		// return (message["id"]);
	}

	void	matchmakingSubscribe() noexcept(false) {
		auto res = _client.Post("/api/game/mm/subscribe", _genHeaders());
		if (!res || res->status == 400 || res->status == 409) {
			throw (std::runtime_error(res->body));
		}
	}

	void	matchmakingUnsubscribe() noexcept(false) {
		auto res = _client.Delete("/api/game/mm/unsubscribe", _genHeaders());
		if (!res || res->status == 400 || res->status == 409) {
			throw (std::runtime_error(res->body));
		}
	}

	std::string	getMathmakingQueueCount() noexcept {
		auto res = _client.Get("/api/game/mm/count", _genHeaders());
		json message = json::parse(res->body)["count"].dump();
		return message;
	}

	void startAiGame() noexcept(false) {
		auto res = _client.Post("/api/game/ai/start", _genHeaders());
		if (!res) {
			throw (std::runtime_error("Cannot start ai game"));
		}
	}

	std::string	getMatchInfosId() noexcept {
		auto res = _client.Get("/api/game/infos", _genHeaders());
		auto id = json::parse(res->body);
		return id["id"].dump();
	}

	std::string getMatchOpponentId() noexcept {
		auto res = _client.Get("/api/game/infos", _genHeaders());
		auto id = json::parse(res->body);
		return id["opponent_id"].dump();
	}

 private:
	std::string			_hostname;
	std::size_t			_port;
	std::string			_token;
	httplib::SSLClient	_client;
	const httplib::Headers	_genHeaders() {
		(void)_port;
		httplib::Headers h = {
			{ "Cookie: token=" + _token, "" }
		};
		return (h);
	}
};
