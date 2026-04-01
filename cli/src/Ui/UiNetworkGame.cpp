#include <ftxui/component/component.hpp>
#include <ftxui/component/screen_interactive.hpp>
#include <ftxui/component/task.hpp>
#include <ftxui/dom/canvas.hpp>
#include <ftxui/dom/elements.hpp>
#include <algorithm>
#include <ftxui/dom/node.hpp>
#include <ftxui/screen/image.hpp>
#include <memory>
#include <vector>
#include <string>
#include "Ui.hpp"
#include "../GameData.hpp"
#include "../Store.hpp"

using namespace ftxui;
static const int PONG_MIN_WIDTH  = 20;
static const int PONG_MIN_HEIGHT = 10;

Component Ui::MakeNetworkGame(AppContext& ctx,
						  std::atomic<int>& tick,
						  Closure exitLoop,
						  ScreenInteractive& screen,
						  std::unique_ptr<GameData> gameData) {
    // UI controls
    auto quitButton = Button(" QUIT ", [&ctx, &gameData, exitLoop](){
		ctx.curState = UiStates::GameSelection;
		gameData->gameServerMessage.stopSocket();
		exitLoop();
	});
	auto countdownRemainingTxt = std::make_shared<std::string>("666");
	auto isInCountdownTxt = std::make_shared<bool>(true);
	auto isInPreCountdownTxt = std::make_shared<bool>(true);
	auto leftPaddleXTxt = std::make_shared<std::string>("");
	auto leftPaddleYTxt = std::make_shared<std::string>("");
	auto rightPaddleXTxt = std::make_shared<std::string>("");
	auto rightPaddleYTxt = std::make_shared<std::string>("");
	auto ballXTxt = std::make_shared<std::string>("");
	auto ballYTxt = std::make_shared<std::string>("");
	auto scoreLeftTxt = std::make_shared<std::string>("");
	auto scoreRightTxt = std::make_shared<std::string>("");
	auto gameOverTxt = std::make_shared<std::string>("");
	auto isLeftTxt = std::make_shared<std::string>("");
	auto sideTxt = std::make_shared<std::string>("");


	auto paddleLeftTxt = std::make_shared<std::string>("");
	auto paddleRightTxt = std::make_shared<std::string>("");
	auto ballTxt = std::make_shared<std::string>("");
	auto infoGameTxt = std::make_shared<std::string>("");
	auto roleTxt = std::make_shared<std::string>("");

    auto scoreLeft    = std::make_shared<int>(0);
    auto scoreRight    = std::make_shared<int>(0);
    auto ballX     = std::make_shared<int>(PONG_MIN_WIDTH / 2);
    auto ballY     = std::make_shared<int>(PONG_MIN_HEIGHT / 2);
    auto paddleLeftY  = std::make_shared<int>(PONG_MIN_HEIGHT / 2);
    auto paddleRightY  = std::make_shared<int>(PONG_MIN_HEIGHT / 2);

    auto fieldW = std::make_shared<int>(PONG_MIN_WIDTH);
    auto fieldH = std::make_shared<int>(PONG_MIN_HEIGHT);

	g_store.emitter.on<TsdEvents::GameWsPaddleLeft>([=](TsdEvents::GameWsPaddleLeft& pl) {
		*paddleLeftTxt = pl.test;
		*leftPaddleXTxt = std::to_string(pl.x);
		*leftPaddleYTxt = std::to_string(pl.y);
		*paddleLeftY = pl.y;
	});
	g_store.emitter.on<TsdEvents::GameWsPaddleRight>([=](TsdEvents::GameWsPaddleRight& pr) {
		*paddleRightTxt = pr.test;
		*rightPaddleXTxt = std::to_string(pr.x);
		*rightPaddleYTxt = std::to_string(pr.y);
		*paddleRightY = pr.y;
	});
	g_store.emitter.on<TsdEvents::GameWsBall>([=](TsdEvents::GameWsBall& b) {
		*ballTxt = b.test;
		*ballXTxt = std::to_string(b.x);
		*ballYTxt = std::to_string(b.y);
		*ballX = b.x;
		*ballY = b.y;
	});
	g_store.emitter.on<TsdEvents::GameWsInfoGame>([=, &ctx, &gameData, &screen](TsdEvents::GameWsInfoGame& ig) {
		*infoGameTxt = ig.test;
		*scoreLeftTxt = std::to_string(ig.scoreLeft);
		*scoreRightTxt = std::to_string(ig.scoreRight);
		*scoreLeft = ig.scoreLeft;
		*scoreRight = ig.scoreRight;
		*countdownRemainingTxt = std::to_string(ig.countdown);
		*gameOverTxt = std::to_string(ig.gameOver);
		if (!*isInPreCountdownTxt && ig.countdown == 0) {
			*isInCountdownTxt = false;
		} else if (*isInPreCountdownTxt && ig.countdown == 3) {
			*isInPreCountdownTxt = false;
		}
	});
	g_store.emitter.on<TsdEvents::GameWsRole>([=](TsdEvents::GameWsRole& r) {
		*roleTxt = r.test;
		*sideTxt = r.side;
		*isLeftTxt = r.isLeft ? "true" : "false";
	});
	auto container = Container::Vertical({quitButton});
	auto intercepted = CatchEvent(container, [=, &gameData, &ctx](Event e){
		if (e == Event::Escape) {
			ctx.curState = UiStates::GameSelection;
			exitLoop();
		} else if (e == Event::j || e == Event::ArrowDown) {
			gameData->gameServerMessage.sendMessage(MessageType::DOWN, *sideTxt);
		} else if (e == Event::k || e == Event::ArrowUp) {
			gameData->gameServerMessage.sendMessage(MessageType::UP, *sideTxt);
		}
		return (false);
	});
	return Renderer(
		intercepted, [=, &gameData, &ctx, &screen, &tick] {
			if (*gameOverTxt == "1") {
				ctx.curState = UiStates::GameSelection;
				ctx.gameType = GameTypes::Default;
				gameData->gameServerMessage.stopSocket();
				exitLoop();
			}
			if (*isInPreCountdownTxt) {
				Element plzWait = vbox({text("Match Found ! please Wait while our server cooks some incredible PONG GAME for you :0 ^^")}) | color(Color::Magenta1) | center | bold;
				return vbox({
					text(""),
					filler(),
					text(""),
					plzWait,
					filler(),
					text(""),
				});
			}
			if (*isInCountdownTxt) {
				Element plzWait = vbox({text("You thought it was OVER ? :O Wait some more: " + *countdownRemainingTxt)}) | color(Color::Magenta1) | center | bold;
				return vbox({
					text(""),
					filler(),
					text(""),
					plzWait,
					filler(),
					text(""),
				});
			} else {
				const int t = tick.load();
				const bool glow = (t / 3) % 2 == 0;

				*fieldW = screen.dimx() - 6;
				*fieldH = screen.dimy() - 10;

				if (*fieldW < PONG_MIN_WIDTH) *fieldW = PONG_MIN_WIDTH;
				if (*fieldH < PONG_MIN_HEIGHT) *fieldH = PONG_MIN_HEIGHT;

				const double scaleX = static_cast<double>(*fieldW) / 1200.0;
				const double scaleY = static_cast<double>(*fieldH) / 800.0;

				int paddleLeftYScaled  = static_cast<int>(*paddleLeftY  * scaleY) + 5;
				int paddleRightYScaled = static_cast<int>(*paddleRightY * scaleY) + 5;
				int ballXScaled = static_cast<int>(*ballX * scaleX);
				int ballYScaled = static_cast<int>(*ballY * scaleY);

				std::vector<std::vector<wchar_t>> grid(*fieldH, std::vector<wchar_t>(*fieldW, L' '));

				int paddleSize = std::max(1, (*fieldH) / 16);

				for (int dy = -paddleSize; dy <= paddleSize; ++dy) {
					int y1 = paddleLeftYScaled + dy;
					int y2 = paddleRightYScaled + dy;
					if (y1 >= 0 && y1 < *fieldH) grid[y1][1] = L'█';
					if (y2 >= 0 && y2 < *fieldH) grid[y2][(*fieldW) - 2] = L'█';
				}

				int bx = std::clamp(ballXScaled, 0, *fieldW - 1);
				int by = std::clamp(ballYScaled, 0, *fieldH - 1);
				grid[by][bx] = L'●';

				Elements rows;
				for (int y = 0; y < *fieldH; ++y) {
					Elements line;
					for (int x = 0; x < *fieldW; ++x) {
						wchar_t ch = grid[y][x];
						std::wstring ws(1, ch);
						if (ch == L'█' && x <= 2) {
							line.push_back(text(ws) | color(Color::Cyan2) | bold);
						}
						else if (ch == L'█' && x >= *fieldW - 3) {
							line.push_back(text(ws) | color(Color::Magenta1) | bold);
						}
						else if (ch == L'●') {
							line.push_back(text(ws) | color(Color::GreenYellow) | bold);
						}
						else {
							line.push_back(text(ws) | color(glow ? Color::Magenta1 : Color::LightPink1));
						}
					}
					rows.push_back(hbox(std::move(line)));
				}

				Element field = vbox(std::move(rows)) | border | color(Color::Magenta);

				Element scoreRow = hbox({
					text(" PLAYER 1: " + std::to_string(*scoreLeft)) | bold | color(Color::Cyan2),
					filler(),
					text(" PLAYER 2: " + std::to_string(*scoreRight)) | bold | color(Color::Magenta1)
				});

				Element quitEl = quitButton->Render() | size(WIDTH, EQUAL, 12);
				quitEl = quitEl | (quitButton->Focused()
				? (color(Color::Magenta1) | bold | border)
				: (color(Color::LightPink1) | border));

				return vbox({
					text("🟣  PONG") | bold | hcenter | color(glow ? Color::Magenta1 : Color::LightPink1),
					scoreRow | hcenter,
					separator(),
					center(field) | flex,
					separator(),
					quitEl | hcenter
				}) | border | color(Color::Magenta) | flex;
				auto c = Canvas(100, 100);
			}
		}
	);
}
