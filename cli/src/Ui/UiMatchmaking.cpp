#include <ftxui/component/component.hpp>
#include <ftxui/component/screen_interactive.hpp>
#include <ftxui/component/task.hpp>
#include <ftxui/dom/elements.hpp>
#include <memory>
#include <string>
#include "Ui.hpp"
#include "../Store.hpp"
#include "EventEmitter.h"
#include "../Events.hpp"

Component Ui::MakeMatchmaking(AppContext& ctx,
								std::atomic<int>& tick,
								Closure exitLoop) {
	(void)tick;
	Closure leaveMm = [exitLoop, &ctx](){
		g_store.apiClient->matchmakingUnsubscribe();
		ctx.curState = UiStates::GameSelection;
		ctx.gameType = GameTypes::Default;
		g_store.user->userInfos.inMmQueue = false;
		exitLoop();
	};
	auto unsub = Button("Leave MatchMaking", [leaveMm](){
		leaveMm();
	});
	auto container = Container::Vertical({
		unsub
	});
	auto intercepted = CatchEvent(container, [leaveMm](Event event) {
		if (event == Event::Escape) {
			leaveMm();
		}
		return (false);
	});
	g_store.emitter.on<TsdEvents::GameMmFound>([&ctx, exitLoop](TsdEvents::GameMmFound& g) {
		(void)g;
		ctx.gameType = GameTypes::Network;
		ctx.curState = UiStates::Game;
		g_store.user->userInfos.inMmQueue = false;
		exitLoop();
	});

	return Renderer(
		intercepted,
		std::function<Element()>([unsub]{
			Element title = text("MATCHMAKING QUEUE") | bold | hcenter | color(Color::Cyan2);
			Element queue = text("Players in queue: " + g_store.apiClient->getMathmakingQueueCount()) | hcenter | color(Color::Magenta1);
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
				queue,
				separator(),
				makeTile(unsub)
			}) | border | color(Color::Magenta1) | size(HEIGHT, ftxui::LESS_THAN, 25) | center;
			return vbox({
				vbox({text(""), title}),
				filler(),
				center(list)
			});
		})
	);
}
