from pathlib import Path
import runpy

from tests.paths import LAUNCHER_PATH, PYTHON_LAUNCHER_PATH


def _load_launcher():
    return runpy.run_path(str(PYTHON_LAUNCHER_PATH))


def test_root_launcher_shortcut_exists():
    assert LAUNCHER_PATH.is_file()
    assert LAUNCHER_PATH.suffix == ".lnk"


def test_launcher_exposes_content_height_resize_contract():
    launcher = _load_launcher()

    assert "UI_SCALE" in launcher
    assert "WINDOW_DEFAULT_HEIGHT" in launcher
    assert "calculate_initial_window_height" in launcher
    assert "select_port" in launcher
    assert "build_dashboard_url" in launcher
    assert "build_window_options" in launcher
    assert "build_launcher_css" in launcher
    assert "build_content_metrics_script" in launcher
    assert "calculate_target_window_height" in launcher
    assert "sync_launcher_layout" in launcher
    assert "configure_window" in launcher


def test_calculate_initial_window_height_starts_compact():
    launcher = _load_launcher()

    calculate_initial_window_height = launcher["calculate_initial_window_height"]
    default_height = launcher["WINDOW_DEFAULT_HEIGHT"]

    assert calculate_initial_window_height() == default_height


def test_calculate_initial_window_height_caps_to_default_height_when_work_area_is_taller():
    launcher = _load_launcher()

    calculate_initial_window_height = launcher["calculate_initial_window_height"]

    assert calculate_initial_window_height(2420) == 2000


def test_calculate_initial_window_height_still_respects_smaller_work_area_height():
    launcher = _load_launcher()

    calculate_initial_window_height = launcher["calculate_initial_window_height"]

    assert calculate_initial_window_height(1600) == 1600


def test_default_window_height_is_sized_for_dashboard():
    launcher = _load_launcher()

    assert launcher["WINDOW_DEFAULT_HEIGHT"] == 2000


def test_launcher_default_window_is_large_enough():
    launcher = _load_launcher()

    assert launcher["WINDOW_WIDTH"] == 2075
    assert launcher["WINDOW_MIN_HEIGHT"] >= 1200


def test_select_port_prefers_default_port_when_available():
    launcher = _load_launcher()

    select_port = launcher["select_port"]

    assert select_port(8420, lambda _: True) == 8420


def test_select_port_uses_fallback_when_default_port_is_busy():
    launcher = _load_launcher()

    select_port = launcher["select_port"]
    fallback_calls = []

    def _pick_free_port():
        fallback_calls.append(True)
        return 8531

    assert select_port(8420, lambda _: False, _pick_free_port) == 8531
    assert fallback_calls == [True]


def test_build_window_options_enables_text_selection():
    launcher = _load_launcher()

    build_window_options = launcher["build_window_options"]
    options = build_window_options("http://127.0.0.1:8420", 1800)

    assert options["text_select"] is True
    assert options["url"] == "http://127.0.0.1:8420"
    assert options["width"] == 2075
    assert options["height"] == 1800
    assert options["title"] == "EG Deploy Control Center"


def test_launcher_exposes_branded_icon_contract():
    launcher = _load_launcher()

    assert launcher["APP_TITLE"] == "EG Deploy Control Center"
    assert Path(launcher["ICON_PATH"]).is_file()
    assert Path(launcher["ICON_PATH"]).suffix == ".ico"


def test_build_launcher_css_scales_root_inside_launcher():
    launcher = _load_launcher()

    build_launcher_css = launcher["build_launcher_css"]
    css = build_launcher_css()

    assert "zoom:1.25" not in css
    assert "--launcher-scale:1.25" in css
    assert "transform:scale(var(--launcher-scale))" in css
    assert "width:calc(100% / var(--launcher-scale))" in css
    assert "height:calc(100% / var(--launcher-scale))" in css
    assert "#root > div{height:100% !important;min-height:0 !important;}" in css


def test_calculate_target_window_height_uses_scaled_content_and_window_chrome():
    launcher = _load_launcher()

    calculate_target_window_height = launcher["calculate_target_window_height"]

    target_height = calculate_target_window_height(
        {
            "appScrollHeight": 1680,
            "outerHeight": 2200,
            "innerHeight": 2160,
        }
    )

    assert target_height == 2140


def test_calculate_target_window_height_caps_to_content_height_when_work_area_is_taller():
    launcher = _load_launcher()

    calculate_target_window_height = launcher["calculate_target_window_height"]

    target_height = calculate_target_window_height(
        {
            "appScrollHeight": 1680,
            "outerHeight": 2200,
            "innerHeight": 2160,
        },
        work_area_height=2420,
    )

    assert target_height == 2140


def test_calculate_target_window_height_respects_smaller_work_area_height():
    launcher = _load_launcher()

    calculate_target_window_height = launcher["calculate_target_window_height"]

    target_height = calculate_target_window_height(
        {
            "appScrollHeight": 1680,
            "outerHeight": 2200,
            "innerHeight": 2160,
        },
        work_area_height=1900,
    )

    assert target_height == 1900


def test_sync_launcher_layout_loads_css_and_resizes_window_from_metrics():
    launcher = _load_launcher()

    sync_launcher_layout = launcher["sync_launcher_layout"]

    class _FakeWindow:
        def __init__(self):
            self.loaded_css = []
            self.scripts = []
            self.resizes = []

        def load_css(self, css):
            self.loaded_css.append(css)

        def evaluate_js(self, script):
            self.scripts.append(script)
            return '{"appScrollHeight": 1680, "outerHeight": 2200, "innerHeight": 2160}'

        def resize(self, width, height):
            self.resizes.append((width, height))

    window = _FakeWindow()
    target_height = sync_launcher_layout(window)

    assert target_height == 2140
    assert len(window.loaded_css) == 1
    assert "transform:scale(var(--launcher-scale))" in window.loaded_css[0]
    assert len(window.scripts) == 1
    assert "appScrollHeight" in window.scripts[0]
    assert window.resizes == [(2075, 2140)]


def test_sync_launcher_layout_clamps_window_height_below_available_work_area_when_content_is_shorter():
    launcher = _load_launcher()

    sync_launcher_layout = launcher["sync_launcher_layout"]

    class _FakeWindow:
        def __init__(self):
            self.loaded_css = []
            self.scripts = []
            self.resizes = []

        def load_css(self, css):
            self.loaded_css.append(css)

        def evaluate_js(self, script):
            self.scripts.append(script)
            return '{"appScrollHeight": 1680, "outerHeight": 2200, "innerHeight": 2160}'

        def resize(self, width, height):
            self.resizes.append((width, height))

    window = _FakeWindow()
    target_height = sync_launcher_layout(window, work_area_height=2420)

    assert target_height == 2140
    assert window.resizes == [(2075, 2140)]


def test_configure_window_registers_loaded_handler_without_resizing():
    launcher = _load_launcher()

    configure_window = launcher["configure_window"]

    class _FakeEvent:
        def __init__(self):
            self.handlers = []

        def __iadd__(self, handler):
            self.handlers.append(handler)
            return self

    class _FakeWindow:
        def __init__(self):
            self.loaded_css = []
            self.resizes = []
            self.events = type("Events", (), {"loaded": _FakeEvent()})()

        def load_css(self, css):
            self.loaded_css.append(css)

        def resize(self, width, height):
            self.resizes.append((width, height))

    window = _FakeWindow()
    configured = configure_window(window)

    assert configured is window
    assert len(window.events.loaded.handlers) == 1
    window.events.loaded.handlers[0](window)
    assert len(window.loaded_css) == 1
    assert "transform:scale(var(--launcher-scale))" in window.loaded_css[0]
    assert window.resizes == []
