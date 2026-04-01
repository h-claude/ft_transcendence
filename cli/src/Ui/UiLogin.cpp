#include <memory>
#include <string>
#include "Ui.hpp"
#include "EventEmitter.h"
#include "../Events.hpp"
#include "../User.hpp"
#include "../Store.hpp"
#include "../ApiClient.hpp"

Component Ui::MakeLoginScreen(AppContext& ctx,
						  Closure onSuccess,
						  std::atomic<int>& tick,
						  ScreenInteractive& screen) {
	auto username = std::make_shared<std::string>("");
	auto password = std::make_shared<std::string>("");
	auto errorMsg = std::make_shared<std::string>("");

	auto usernameInput = Input(username.get());
	auto passwordInput = Input(password.get(), {.password = true});

	std::function<void()> loginAction = [username, password, errorMsg, &ctx, onSuccess, &tick]() {
		(void)tick;
		ApiClient::Res_t res = g_store.user->login(*g_store.apiClient, *username, *password);
		if (res.status == 401) {
			ctx.errorMessage = "2FA login is not supported in the CLI version :(";
		} else if (res.ok) {
			ctx.loggedIn = true;
			ctx.username = *username;
			*errorMsg = "";
			std::string token = res.body.substr(res.body.find(">|<", 0) + 3, res.body.length());
			token = token.substr(0, token.length() - 2);
			g_store.user->setToken(token);
			g_store.apiClient->setToken(token);
			g_store.user->setId(g_store.apiClient->getId());
			std::stringstream url;
			url << "wss://" << g_store.hostname << ":" << g_store.port << "/api/ws";
			g_store.socketManager = std::make_unique<SocketManager>(url.str(), token, [](const ix::WebSocketMessagePtr& msg) {
				if (msg->type == ix::WebSocketMessageType::Message) {
					auto data = nlohmann::json::parse(msg->str);
					std::string event = data["type"];
					if (event == "game_mm_found") {
						TsdEvents::GameMmFound g;
						g_store.emitter.emit(g);
					} else if (event == "game_ai_started") {
						TsdEvents::GameAiStarted g;
						g.newGameId = data["matchId"];
						g.aiUserId = data["opponentId"];
						g_store.emitter.emit(g);
					}
				} else if (msg->type == ix::WebSocketMessageType::Open) {
					std::cout << "Connection opened" << std::endl;
				} else if (msg->type == ix::WebSocketMessageType::Close) {
					std::cout << "Connection closed" << std::endl;
				} else if (msg->type == ix::WebSocketMessageType::Error) {
					std::cerr << "Error: " << msg->errorInfo.reason << std::endl;
				}
			});
			g_store.isConnected = true;
			ctx.curState = UiStates::GameSelection;
			onSuccess();
		} else {
			ctx.errorMessage = nlohmann::json::parse(res.body)["error"];
		}
	};

	auto loginButton = Button("  LOGIN  ", loginAction);

	auto container = Container::Vertical({
		usernameInput,
		passwordInput,
		loginButton,
	});

	auto intercepted = CatchEvent(container, [loginAction, &screen](Event event) {
		if (event == Event::Return) {
			loginAction();
			return true;
		}
		if (event == Event::Escape) {
			screen.Exit();
		}
		return false;
	});

	return Renderer(
		intercepted,
		std::function<Element()>([usernameInput, passwordInput, loginButton, username, password, errorMsg, &tick, &ctx] {
			const int t = tick.load();
			const bool glow = (t / 3) % 2 == 0;

			Element title = text("🟣  TRANSCENDENCE") | bold | hcenter  | color(glow ? Color::Cyan2 : Color::Magenta1);
			Element subtitle = text("Vivement que ca se termine") | italic | hcenter  | color(Color::Cyan2);;

			bool unameFocused = usernameInput->Focused();
			bool passFocused  = passwordInput->Focused();
			bool btnFocused   = loginButton->Focused();

			auto makeInputBox = [&](Component input_comp, bool focused) {
				Element box = input_comp->Render() | size(WIDTH, EQUAL, INPUT_WIDTH);
				box = hbox({text(" "), box, text(" ")});
				if (focused) {
					box = box | border | color(Color::Cyan2) | bold;
				} else {
					box = box | border | color(Color::LightCyan3);
				}
				return box;
			};

			Element unameRow = hbox({
				(text("Username") | bold | color(unameFocused ? Color::Cyan2 : Color::LightCyan3)),
				filler(),
				makeInputBox(usernameInput, unameFocused)
			}) | size(WIDTH, EQUAL, PANEL_WIDTH) | center;

			Element passRow = hbox({
				(text("Password") | bold | color(passFocused ? Color::Cyan2 : Color::LightCyan3)),
				filler(),
				makeInputBox(passwordInput, passFocused)
			}) | size(WIDTH, EQUAL, PANEL_WIDTH) | center;

			Element loginEl = loginButton->Render() | size(WIDTH, EQUAL, 18);
			if (btnFocused) loginEl = loginEl | color(Color::Magenta1) | bold;
			else loginEl = loginEl | color(Color::LightCyan3);

			Element errorEl = text(ctx.errorMessage) | color(Color::Red) | hcenter;
			if (ctx.errorMessage.empty()) {
				errorEl = text("[Tab] switch fields • [Enter] submit • [Esc] quit") | color(Color::LightPink1) | hcenter;
			}

			Element panel = vbox({
				title,
				subtitle,
				separator(),
				text(""),
				unameRow,
				text(""),
				passRow,
				text(""),
				loginEl | hcenter,
				text(""),
				errorEl,
			}) | border | color(Color::Magenta1) | size(HEIGHT, LESS_THAN, 40);

			return vbox({
				filler(),
				center(panel),
				filler()
			});
		})
	);
}
