#include "User.hpp"
#include "httplib.h"
#include <stdexcept>

User::User(const ApiClient& apiClient) {}

User::User(const ApiClient& apiClient, const std::string& username, const std::string& password) {
	userInfos.username = username;
	userInfos.password = password;
}

User::User(User::Uinfo_t userInfos) {
}

User::~User() {
}

void User::setUserInfos(Uinfo_t userInfos) {
	this->userInfos = userInfos;
}

void	User::setToken(const std::string& token) {
	this->userInfos.token = token;
}

ApiClient::Res_t	User::login(ApiClient& apiClient, const std::string& username, const std::string& password) {
	this->userInfos.username = username;
	this->userInfos.password = password;
	return (apiClient.login(userInfos.username, userInfos.password));
}

void	User::setId(const std::size_t id) {
	this->userInfos.id = id;
}

std::size_t	User::getId() {
	return (this->userInfos.id);
}

const std::string& User::getToken() {
	return (this->userInfos.token);
}

const User::Uinfo_t User::getUserInfos() {
	return (this->userInfos);
}
