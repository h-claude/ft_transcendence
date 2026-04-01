#pragma once

#include <cstdint>
#include <string>
namespace TsdEvents {
class GameMmFound {};
struct GameAiStarted {int32_t newGameId; int32_t aiUserId;};
class GameWsPaddleLeft {public: int32_t x; int32_t y; std::string test;};
class GameWsPaddleRight {public: int32_t x; int32_t y; std::string test;};
class GameWsBall {public: int32_t x; int32_t y; std::string test;};
class GameWsInfoGame {public:  std::string test; int32_t scoreLeft; int32_t scoreRight; int32_t countdown;bool gameOver = false;};
class GameWsRole {public:  std::string test; bool isLeft; std::string side;};
class GameWsNotFound {public:  std::string test;};
}
