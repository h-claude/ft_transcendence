#pragma once
#include "Events.hpp"
#include "SocketManager.hpp"
#include "Store.hpp"
#include "ixwebsocket/IXWebSocketMessage.h"
#include "ixwebsocket/IXWebSocketMessageType.h"
#include <cstdint>
#include <cstdlib>

typedef struct Coordinates {
	int32_t	x;
	int32_t	y;
} Coordinates_t;
typedef struct PaddleInfos {
	Coordinates_t	coords;
	int32_t			w;
	int32_t			h;
	int32_t			speed;
} PaddleInfos_t;
typedef struct BallInfos {
	Coordinates_t	coords;
	int32_t			vx;
	int32_t			vy;
	int32_t			r;
	bool			moving;
} BallInfos_t;
typedef struct GameInfos {
	int32_t	countdown;
	int32_t	scoreLeft;
	int32_t	scoreRight;
	bool	gameOver;
	bool	paused;
} GameInfos_t;
typedef enum MatchEndReason {
	SCORE, DISCONNECT
} MatchEndReason;
typedef struct MatchEnd {
	bool			gameOver = true;
	bool			result; // true: win false: loose
	bool			winner; // true: left false: right
	MatchEndReason	reason;
	int32_t			scoreLeft;
	int32_t			scoreRight;
} MatchEnd_t;
typedef struct Role {
	bool	isLeft; // true: left false: right
} Role_t;
typedef struct ServerMsg {
	PaddleInfos_t	leftPaddle;
	PaddleInfos_t	rightPaddle;
	BallInfos_t		ballInfos;
	GameInfos_t		gameInfos;
	MatchEnd_t		matchEnd;
	Role_t			role;
} ServerMsg_t;
typedef enum MessageType {
	UP, DOWN, PAUSE, START
} MessageType;

class GameServerMessage {
 public:
	GameServerMessage(): gameSocket("wss://" + g_store.hostname + ":" + "8443" + "/api/ws_game_logic/" + g_store.apiClient->getMatchInfosId() + "?opponentId=" + g_store.apiClient->getMatchOpponentId(), g_store.user->getToken(), [&](const ix::WebSocketMessagePtr& msg){
		if (msg->type == ix::WebSocketMessageType::Message) {
			auto data = nlohmann::json::parse(msg->str);
			std::string event = data["type"];
			if (event == "paddleLeft") {
				TsdEvents::GameWsPaddleLeft pl;
				pl.x = atol(data["x"].dump().c_str());
				pl.y = atol(data["y"].dump().c_str());
				pl.test = data.dump();
				g_store.emitter.emit(pl);
			} else if (event == "paddleRight") {
				TsdEvents::GameWsPaddleRight pr;
				pr.x = atol(data["x"].dump().c_str());
				pr.y = atol(data["y"].dump().c_str());
				pr.test = data.dump();
				g_store.emitter.emit(pr);
			} else if (event == "ball") {
				TsdEvents::GameWsBall ball;
				ball.x = atol(data["x"].dump().c_str());
				ball.y = atol(data["y"].dump().c_str());
				ball.test = data.dump();
				g_store.emitter.emit(ball);
			} else if (event == "info_game") {
				TsdEvents::GameWsInfoGame info;
				info.test = data.dump();
				info.scoreLeft = atol(data["score"]["scoreLeft"].dump().c_str());
				info.scoreRight = atol(data["score"]["scoreRight"].dump().c_str());
				info.countdown = atol(data["countdown"].dump().c_str());
				info.gameOver = data["gameOver"];
				g_store.emitter.emit(info);
			} else if (event == "role") {
				TsdEvents::GameWsRole role;
				role.test = data.dump();
				role.side = data["side"].dump();
				role.side = role.side == "\"left\"" ? "left" : "right";
				role.isLeft = role.side == "left";
				g_store.emitter.emit(role);
			} else {
				TsdEvents::GameWsNotFound nf;
				g_store.emitter.emit(nf);
			}
		}
	}){};
	void			stopSocket() {
		this->gameSocket.stop();
	}
	void			sendMessage(MessageType msg, std::string side) {
		json j;
		j["type"] = "controls";
		switch (msg) {
			case UP:
				j["controls"][side]["up"] = true;
				j["controls"][side]["down"] = false;
				break;
			case DOWN:
				j["controls"][side]["up"] = false;
				j["controls"][side]["down"] = true;
				break;
			case START:
				j["controls"]["start"] = true;
				break;
			case PAUSE:
				break;
		}
		this->gameSocket.send(j.dump());
	}
	ServerMsg_t		serverMsg;
 private:
	SocketManager	gameSocket;
};
