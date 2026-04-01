#include <atomic>
#include <ftxui/component/task.hpp>
#include <ftxui/dom/node.hpp>
#include <ftxui/util/ref.hpp>
#include <functional>
#include <memory>
#include <string>

#include <ftxui/component/component.hpp>
#include <ftxui/component/component_base.hpp>
#include <ftxui/component/screen_interactive.hpp>
#include <ftxui/dom/elements.hpp>
#include "Ui.hpp"
#include "../Store.hpp"

Component Ui::MakeOpponentSelection(AppContext& ctx,
                                    std::atomic<int>& tick,
                                    Closure exitLoop) {
	auto t1 = Button("Looool", [](){});
	auto t2 = Button("ouiiiii", [](){});
	auto t3 = Button("Return", [exitLoop, &ctx]() {
		ctx.curState = UiStates::GameSelection;
		exitLoop();
	});

	auto userName = std::make_shared<std::string>("");
	auto userNameInput = Input(userName.get(), "User Name");

	auto container = Container::Vertical({
		t1, t2, t3, userNameInput
	});

	auto errorMsg = std::make_shared<std::string>("");

	auto opponentUserNameAction = [errorMsg, userName, &tick]() {
		try {
			int lol = g_store.apiClient->getUserIdByUsername(*userName);
			(void)lol;
			*errorMsg = "";
		} catch (const std::exception& e) {
			*errorMsg = e.what();
		}
		++tick;
	};

	auto intercepted = CatchEvent(container, [opponentUserNameAction, userNameInput, &ctx, exitLoop](Event event) {
		if (event == Event::Escape) {
			ctx.curState = UiStates::GameSelection;
			exitLoop();
			return true;
		} else if (event == Event::Return && userNameInput->Focused()) {
			opponentUserNameAction();
			return true;
		}
		return false;
	});

	return Renderer(intercepted, [errorMsg, userName, userNameInput, t1, t2, t3, &ctx, &tick]() {
		(void)ctx;
		const int t = tick.load();
		bool glow = (t / 4) % 2 == 0;
		Element title = text("ENTER THE NAME OF A PLAYER")
		| bold | center
		| color(glow ? Color::Magenta1 : Color::Cyan2);

		auto makeTile = [&](Component b) {
			Element tile = b->Render() | size(WIDTH, EQUAL, 28);
			if (b->Focused()) {
				tile = tile | color(Color::Cyan2) | bold;
			}
			else {
				tile = tile | color(Color::LightCyan3);
			}
			return tile | hcenter;
		};

		auto makeInputBox = [&](Component in) {
			Element box = in->Render() | size(WIDTH, EQUAL, INPUT_WIDTH);
			box = hbox({text(" "), box, text(" ")});
			if (in->Focused()) {
				box = box | border | color(Color::Cyan2) | bold;
			}
			else {
				box = box | border | color(Color::LightCyan3);
			}
			return box;
		};

		Element unameRow = hbox({
			(text("Username") | bold | color(userNameInput->Focused() ? Color::Cyan2 : Color::LightCyan3)),
			filler(),
			makeInputBox(userNameInput)
		}) | size(WIDTH, EQUAL, PANEL_WIDTH) | center;

		// Show error if non‐empty
		Element errElem = text("");
		if (!errorMsg->empty()) {
			errElem = text(*errorMsg) | color(Color::Red) | bold | hcenter;
		}

		Element list = vbox({
			makeTile(t1),
			makeTile(t2),
			makeTile(t3),
			errElem,
			unameRow
		}) | border | color(Color::Magenta1)
		| size(HEIGHT, LESS_THAN, 25)
		| center;

		return vbox({
			vbox({ text(""), title }),
			filler(),
			center(list),
			filler()
		});
	});
}
