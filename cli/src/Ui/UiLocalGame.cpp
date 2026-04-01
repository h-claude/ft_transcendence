
#include "Ui.hpp"
#include <ftxui/component/component.hpp>
#include <ftxui/component/screen_interactive.hpp>
#include <ftxui/component/task.hpp>
#include <ftxui/dom/elements.hpp>
#include <algorithm>
#include <memory>
#include <vector>
#include <string>

using namespace ftxui;

static const int PONG_MIN_WIDTH  = 20;
static const int PONG_MIN_HEIGHT = 10;

Component Ui::MakeLocalGame(AppContext& ctx,
                           std::atomic<int>& tick,
                           Closure exitLoop,
                           ScreenInteractive& screen) {
    // UI controls
    auto quitButton = Button(" QUIT ", [&ctx, exitLoop](){
		ctx.curState = UiStates::GameSelection;
		exitLoop();
	});

    auto score1    = std::make_shared<int>(0);
    auto score2    = std::make_shared<int>(0);
    auto ballX     = std::make_shared<int>(PONG_MIN_WIDTH / 2);
    auto ballY     = std::make_shared<int>(PONG_MIN_HEIGHT / 2);
    auto velX      = std::make_shared<int>(2); // +/-1
    auto velY      = std::make_shared<int>(2); // +/-1
    auto paddle1Y  = std::make_shared<int>(PONG_MIN_HEIGHT / 2);
    auto paddle2Y  = std::make_shared<int>(PONG_MIN_HEIGHT / 2);

    auto field_w = std::make_shared<int>(PONG_MIN_WIDTH);
    auto field_h = std::make_shared<int>(PONG_MIN_HEIGHT);

    auto container = Container::Vertical({ quitButton });

    auto intercepted = CatchEvent(container, [=, &ctx](Event e) -> bool {
        if (e == Event::Character('w')) {
            *paddle1Y = std::max(0, *paddle1Y - 1);
            return true;
        }
        if (e == Event::Character('s')) {
            *paddle1Y = std::min(std::max(0, *field_h - 1), *paddle1Y + 1);
            return true;
        }
        if (e == Event::ArrowUp) {
            *paddle2Y = std::max(0, *paddle2Y - 1);
            return true;
        }
        if (e == Event::ArrowDown) {
            *paddle2Y = std::min(std::max(0, *field_h - 1), *paddle2Y + 1);
            return true;
        }
        if (e == Event::Escape) {
			ctx.curState = UiStates::GameSelection;
            if (exitLoop) exitLoop();
            return true;
        }
        return false;
    });

    return Renderer(intercepted, [=, &tick, &screen] {
        const int t = tick.load();
        const bool glow = (t / 3) % 2 == 0;

        *field_w = screen.dimx() - 6;
        *field_h = screen.dimy() - 10;
        if (*field_w < PONG_MIN_WIDTH)  *field_w = PONG_MIN_WIDTH;
        if (*field_h < PONG_MIN_HEIGHT) *field_h = PONG_MIN_HEIGHT;

        *paddle1Y = std::clamp(*paddle1Y, 0, *field_h - 1);
        *paddle2Y = std::clamp(*paddle2Y, 0, *field_h - 1);
        *ballX    = std::clamp(*ballX, 0, *field_w - 1);
        *ballY    = std::clamp(*ballY, 0, *field_h - 1);

		*ballX += *velX;
		*ballY += *velY;

		if (*ballY <= 0) {
			*ballY = 0;
			*velY = -(*velY);
		} else if (*ballY >= *field_h - 1) {
			*ballY = *field_h - 1;
			*velY = -(*velY);
		}

		int paddle_half = std::max(1, (*field_h) / 8);

		if (*ballX <= 1) {
			if (std::abs(*ballY - *paddle1Y) <= paddle_half) {
				*velX = std::abs(*velX);
				int delta = (*ballY - *paddle1Y);
				if (delta != 0) *velY = (delta > 0 ? 1 : -1);
			} else {
				(*score2)++;
				*ballX = *field_w / 2;
				*ballY = *field_h / 2;
				*velX  = 1;
				*velY  = 0;
			}
		}

		if (*ballX >= *field_w - 2) {
			if (std::abs(*ballY - *paddle2Y) <= paddle_half) {
				*velX = -std::abs(*velX); // go left
				int delta = (*ballY - *paddle2Y);
				if (delta != 0) *velY = (delta > 0 ? 1 : -1);
			} else {
				(*score1)++;
				*ballX = *field_w / 2;
				*ballY = *field_h / 2;
				*velX  = -1;
				*velY  = 0;
			}
		}

        std::vector<std::vector<wchar_t>> grid(*field_h, std::vector<wchar_t>(*field_w, L' '));

        int paddle_size = std::max(1, (*field_h) / 8);
        for (int dy = -paddle_size; dy <= paddle_size; ++dy) {
            int y1 = *paddle1Y + dy;
            int y2 = *paddle2Y + dy;
            if (y1 >= 0 && y1 < *field_h) grid[y1][1] = L'█';
            if (y2 >= 0 && y2 < *field_h) grid[y2][(*field_w) - 2] = L'█';
        }

        int bx = std::clamp(*ballX, 0, *field_w - 1);
        int by = std::clamp(*ballY, 0, *field_h - 1);
        grid[by][bx] = L'●';

        Elements rows;
        for (int y = 0; y < *field_h; ++y) {
            Elements line;
            for (int x = 0; x < *field_w; ++x) {
                wchar_t ch = grid[y][x];
                std::wstring ws(1, ch);
                if (ch == L'█' && x <= 2) {
                    line.push_back(text(ws) | color(Color::Cyan2) | bold);
                } else if (ch == L'█' && x >= *field_w - 3) {
                    line.push_back(text(ws) | color(Color::Magenta1) | bold);
                } else if (ch == L'●') {
                    line.push_back(text(ws) | color(Color::GreenYellow) | bold);
                } else {
                    line.push_back(text(ws) | color(glow ? Color::Magenta1 : Color::LightPink1));
                }
            }
            rows.push_back(hbox(std::move(line)));
        }
        Element field = vbox(std::move(rows)) | border | color(Color::Magenta);

        Element scoreRow = hbox({
            text(" PLAYER 1: " + std::to_string(*score1)) | bold | color(Color::Cyan2),
            filler(),
            text(" PLAYER 2: " + std::to_string(*score2)) | bold | color(Color::Magenta1)
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
    });
}
