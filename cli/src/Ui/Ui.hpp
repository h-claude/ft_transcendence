#pragma once
#include <ftxui/component/task.hpp>
#include <ftxui/dom/elements.hpp>
#include <ftxui/screen/screen.hpp>
#include <ftxui/screen/string.hpp>
#include <ftxui/component/component.hpp>
#include <ftxui/component/component_base.hpp>
#include <ftxui/component/screen_interactive.hpp>
#include <thread>
#include <atomic>
#include <memory>
#include <functional>
#include <string>
#include "../GameData.hpp"
using namespace ftxui;
using namespace std::chrono_literals;

enum class UiStates {Login, OpponentSelection, GameSelection, Game, Victory, Defeat, Matchmaking, Settings};
enum class GameTypes {Local, Network, Direct, Matchmaking, Tournament, Default};
struct AppContext {
	std::string	username;
	bool		loggedIn = false;
	std::string	errorMessage;
	GameTypes	gameType = GameTypes::Default;
	UiStates	curState = UiStates::Login;
};

class Ui {
 public:
	Ui() = default;
	Ui(const Ui& other) = delete;
	Ui(Ui&& other) = delete;
	void run();
	Component MakeLoginScreen(AppContext& ctx,
							  Closure onSuccess,
							  std::atomic<int>& tick,
							  ScreenInteractive& screen);
	Component MakeGameSelectionScreen(AppContext& ctx,
									  std::atomic<int>& tick,
									  Closure on_logout,
								   	  Closure exitLoop);
	Component MakeLocalGame(AppContext& ctx,
							std::atomic<int>& tick,
							Closure exitLoop,
							ScreenInteractive& screen);
	Component MakeNetworkGame(AppContext& ctx,
						   	  std::atomic<int>& tick,
						   	  Closure exitLoop,
						   	  ScreenInteractive& screen,
							 std::unique_ptr<GameData> gameData);
	Component MakeOpponentSelection(AppContext& ctx,
									std::atomic<int>& tick,
									Closure exitLoop);
	Component MakeMatchmaking(AppContext& ctx,
									std::atomic<int>& tick,
									Closure exitLoop);
	Component MakeSettings(AppContext& ctx,
						   Closure exitLoop);
 private:
	static constexpr int INPUT_WIDTH = 48;
	static constexpr int PANEL_WIDTH = 64;
};
