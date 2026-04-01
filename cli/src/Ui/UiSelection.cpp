#include "Ui.hpp"
#include "../Store.hpp"
#include <exception>
#include <ftxui/component/task.hpp>

Component Ui::MakeGameSelectionScreen(AppContext& ctx, std::atomic<int>& tick, std::function<void()> on_logout, Closure exitLoop) {
	auto playLocal		= Button("▶ Local Match", [&ctx, exitLoop](){
		ctx.gameType = GameTypes::Local;
		ctx.curState = UiStates::Game;
		exitLoop();
	});
	auto playDirect			= Button("▶ Direct Match", [&ctx, exitLoop](){
		ctx.curState = UiStates::OpponentSelection;
		exitLoop();
	});
	auto playMm				= Button("▶ MatchMaking", [&ctx, exitLoop](){
		ctx.gameType = GameTypes::Network;
		ctx.curState = UiStates::Matchmaking;
		try {
			g_store.apiClient->matchmakingSubscribe();
			g_store.user->userInfos.inMmQueue = true;
		} catch (const std::exception& e) {
			exitLoop();
		}
		exitLoop();
	});
	auto playAi				= Button("▶ Against Ai", [&ctx, exitLoop](){
		ctx.gameType = GameTypes::Network;
		ctx.curState = UiStates::Game;
		try {
			g_store.apiClient->startAiGame();
			exitLoop();
		} catch (const std::exception& e){
		}
	});
	auto playTournament		= Button("▶ Tournament", [](){});
	auto settings			= Button("⚙️  Settings", [&ctx, exitLoop](){
		ctx.gameType = GameTypes::Default;
		ctx.curState = UiStates::Settings;
		exitLoop();
	});
	auto logoutBtn 			= Button("⟲ Log out", on_logout);

	auto container = Container::Vertical({
		  playMm, playAi, settings, logoutBtn
	});

	auto intercepted = CatchEvent(container, [&ctx, exitLoop](Event event) {
		if (event == Event::Escape) {
			ctx.curState = UiStates::Login;
			ctx.loggedIn = false;
			g_store.socketManager->stop();
			g_store.isConnected = false;
			exitLoop();
		}
		return false;
	});

	return Renderer(
		intercepted,
		std::function<Element()>([settings, playLocal, playDirect, playMm, playAi, playTournament, logoutBtn, &ctx, &tick] {
			const int t = tick.load();
			const bool glow = (t / 4) % 2 == 0;

			Element title = text("CHOOSE YOUR GAME MODE") | bold | hcenter;
			title = title | color(glow ? Color::Magenta1 : Color::Cyan2);

			Element greeting = text("Player: " + ctx.username) | bold | hcenter;

			auto makeTile = [&](Component button_comp) {
				Element tile = button_comp->Render() | size(WIDTH, EQUAL, 28);

				if (button_comp->Focused()) {
					tile = tile | color(Color::Cyan2) | bold;
				} else {
					tile = tile | color(Color::LightCyan3);
				}

				return tile | hcenter;
			};

			Element list = vbox({
				text("Choose a Game Mode:") | bold | hcenter,
				separator(),
				makeTile(playMm),
				makeTile(playAi),
				makeTile(settings),
				makeTile(logoutBtn)
			}) | border | color(Color::Magenta1) | size(HEIGHT, LESS_THAN, 25) | center;

			Element footer = vbox({ text(""), text("[↑/↓] move • [Enter] select • [Esc] quit") | color(Color::LightPink1) | hcenter });

			return vbox({
				vbox({ text(""), title }),
				vbox({ text(""), greeting }),
				filler(),
				center(list),
				filler(),
				footer
			});
		})
	);
}
