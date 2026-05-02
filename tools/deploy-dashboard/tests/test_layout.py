from tests.paths import LAUNCHER_PATH, PYTHON_LAUNCHER_PATH, README_PATH, TOOLS_ROOT


def test_root_keeps_only_readme_launcher_and_deploy_env_files():
    root_files = sorted(path.name for path in TOOLS_ROOT.iterdir() if path.is_file())

    assert root_files == [
        ".env.deploy",
        ".env.deploy.example",
        "EG Deploy Control Center.lnk",
        "README.md",
    ]


def test_root_exposes_readme_and_branded_launcher():
    assert README_PATH.is_file()
    assert LAUNCHER_PATH.is_file()
    assert PYTHON_LAUNCHER_PATH.is_file()
