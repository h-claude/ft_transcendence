#pragma once
#include "GameServerMessage.hpp"
#include <cstdint>
#include <string>

class GameData {
 public:
	GameData(): gameServerMessage() {}
	void	update() {
	};
	Coordinates_t	paddleLeft;
	Coordinates_t	paddleRight;
	Coordinates_t	ball;
	int32_t			scoreLeft;
	int32_t			scoreRight;
	bool			paused;
	bool			isLeft;
	GameServerMessage gameServerMessage;
 private:
};
