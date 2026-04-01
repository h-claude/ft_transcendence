#include "Ui.hpp"
#include <cstdint>
#include <ftxui/component/component.hpp>
#include <ftxui/component/component_options.hpp>
#include <ftxui/dom/direction.hpp>
#include <ftxui/dom/elements.hpp>
#include <memory>
#include <string>
namespace x11{
#include <X11/Xlib.h>
#include <X11/XKBlib.h>
}
#include <X11/extensions/XKB.h>

void getKeyboardSettings(unsigned int* delay, unsigned int* repeatRate) {
    if (!delay || !repeatRate)
        return;
    x11::Display* dpy = x11::XOpenDisplay(nullptr);
    XkbGetAutoRepeatRate(dpy, XkbUseCoreKbd, delay, repeatRate);
	x11::XCloseDisplay(dpy);
}

void setKeyboardSettings(unsigned int delay, unsigned int repeatRate) {
    x11::Display* dpy = x11::XOpenDisplay(nullptr);
    if (!dpy)
        return;
	x11::XkbSetAutoRepeatRate(dpy, XkbUseCoreKbd, delay, repeatRate);
	x11::XCloseDisplay(dpy);
}

Component Ui::MakeSettings(AppContext& ctx, Closure exitLoop) {
    unsigned int dly, rptrate;
    getKeyboardSettings(&dly, &rptrate);

    auto delay = std::make_shared<int>(dly);
    auto repeatRate = std::make_shared<int>(rptrate);

	auto validationMessage = std::make_shared<std::string>("");

	auto delaySlider = Slider((SliderOption<int>){ .value = &(*delay), .min = 100, .max = 1000, .increment = 10, .direction = Direction::Right, .color_active = Color::Magenta1, .color_inactive = Color::Cyan3});
	auto rateSlider = Slider((SliderOption<int>){ .value = &(*repeatRate), .min = 1, .max = 50, .increment = 1, .direction = Direction::Right, .color_active = Color::Magenta1, .color_inactive = Color::Cyan3});

    auto applyButton = Button("Apply", [=] {
        setKeyboardSettings(*delay, *repeatRate);
		*validationMessage = "New settings applied";
    });

    auto resetButton = Button("Reset to Defaults", [=] {
        *delay = 500;
        *repeatRate = 30;
        setKeyboardSettings(*delay, *repeatRate);
		*validationMessage = "Settings reset";
    });

    auto quitButton = Button("Return", [exitLoop, &ctx] {
        ctx.curState = UiStates::GameSelection;
        exitLoop();
    });

    auto buttons = Container::Horizontal({
        applyButton,
        resetButton,
        quitButton,
    });

    auto container = Container::Vertical({
        delaySlider,
        rateSlider,
        buttons,
    });

    auto intercepted = CatchEvent(container, [&ctx, exitLoop](Event event) {
        if (event == Event::Escape) {
            ctx.curState = UiStates::GameSelection;
            exitLoop();
        }
        return false;
    });

    return Renderer(intercepted, [=] {
		auto validationText = text(*validationMessage);
        auto delayText = text("Delay: " + std::to_string(*delay) + " ms");
        auto rateText = text("Repeat Rate: " + std::to_string(*repeatRate) + " Hz");
		auto makeTile = [&](Component button_comp, int32_t width = 28) {
			Element tile = button_comp->Render() | size(WIDTH, EQUAL, width);
			if (button_comp->Focused()) {
				tile = tile | color(Color::Cyan2) | bold;
			} else {
				tile = tile | color(Color::Magenta1);
			}
			return tile | hcenter;
		};

		auto validation = vbox({
			validationText | color(Color::Green1),
		});

        auto sliders = vbox({
            delayText,
            delaySlider->Render(),
            separator(),
            rateText,
            rateSlider->Render(),
        }) | borderRounded | center;

        auto buttonsRow = hbox({
			makeTile(applyButton, 10),
            filler(),
			makeTile(resetButton, 18),
            filler(),
			makeTile(quitButton, 10),
        }) | center;

		std::shared_ptr<Node> final;
		if (*validationMessage == "") {
			final = vbox({
				text("Keyboard Settings") | bold | center,
				separator(),
				sliders,
				separator(),
				buttonsRow,
			}) | border | center | flex;
		} else {
			final = vbox({
				text("Keyboard Settings") | bold | center,
				separator(),
				validation | center | blink,
				separator(),
				sliders,
				separator(),
				buttonsRow,
			}) | border | center | flex;
		}

		return (final);
    });
}
