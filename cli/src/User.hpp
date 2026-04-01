#pragma once
#include <cstddef>
#define CPPHTTPLIB_OPENSSL_SUPPORT
#include <cstdint>
#include <string>
#include <httplib.h>
#include "ApiClient.hpp"

class User {
 public:
	typedef struct Uinfo {
		std::string	token;
		uint32_t	id;
		std::string	username;
		std::string	password;
		std::string	email;
		uint32_t	wins;
		uint32_t	losses;
		uint32_t	highestKdr;
		bool		inMmQueue = false;
	} Uinfo_t;

	User(const ApiClient& apiClient);
	User(const ApiClient& apiClient, const std::string& username, const std::string& password);
	User(Uinfo_t userInfos);
	~User();
	User(const User& o) = delete;
	User operator=(const User& o) = delete;

	void							setUserInfos(Uinfo_t userInfos);
	const Uinfo_t					getUserInfos();
	void							setToken(const std::string& token);
	const std::string&				getToken();
	void							setId(const std::size_t id);
	std::size_t				getId();
	[[nodiscard]] ApiClient::Res_t	login(ApiClient& apiClient, const std::string& username, const std::string& password);
	Uinfo_t userInfos;
};
