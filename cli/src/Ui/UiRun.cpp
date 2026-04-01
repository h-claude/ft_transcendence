#include <ftxui/component/task.hpp>
#include <memory>
#include "Ui.hpp"
#include "../Store.hpp"
#include "../GameData.hpp"

void Ui::run() {
	AppContext			ctx;

	auto 				screen = ScreenInteractive::Fullscreen();
	Closure				exitLoop = screen.ExitLoopClosure();

	std::atomic<int>	tick{0};
	std::atomic_bool	running{true};

	std::thread ticker([&]{
		while (running.load()) {
			std::this_thread::sleep_for(10ms);
			tick.fetch_add(1);
			screen.PostEvent(Event::Custom);
		}
	});

	for (;;) {
		switch (ctx.curState) {
			case UiStates::Login:
				screen.Loop(Ui::MakeLoginScreen(ctx, exitLoop, tick, screen));
				if (!ctx.loggedIn) goto finish;
				break;
			case UiStates::GameSelection:
				screen.Loop(MakeGameSelectionScreen(ctx, tick, [&ctx, exitLoop]() {
					ctx.loggedIn = false;
					ctx.username.clear();
					ctx.errorMessage.clear();
					g_store.isConnected = false;
					ctx.curState = UiStates::Login,
					g_store.socketManager->stop();
					exitLoop();
				}, exitLoop));
				break;
			case UiStates::Settings:
				screen.Loop(MakeSettings(ctx, exitLoop));
				break;
			case UiStates::Matchmaking:
				screen.Loop(Ui::MakeMatchmaking(ctx, tick, exitLoop));
				break;
			case UiStates::OpponentSelection:
				screen.Loop(Ui::MakeOpponentSelection(ctx, tick, exitLoop));
				break;
			case UiStates::Game:
				switch (ctx.gameType) {
					case GameTypes::Local:
						screen.Loop(Ui::MakeLocalGame(ctx, tick, exitLoop, screen));
						break;
					case GameTypes::Network:
						screen.Loop(Ui::MakeNetworkGame(ctx, tick, exitLoop, screen, std::make_unique<GameData>()));
						break;
					case GameTypes::Direct:
						screen.Loop(Ui::MakeNetworkGame(ctx, tick, exitLoop, screen, std::make_unique<GameData>()));
						break;
					case GameTypes::Default:
						break;
					case GameTypes::Tournament:
						break;
					case GameTypes::Matchmaking:
						break;
				}
				break;
			case UiStates::Defeat:
				break;
			case UiStates::Victory:
				break;
		}
	}

finish:
	running.store(false);
	if (ticker.joinable()) ticker.join();
}
