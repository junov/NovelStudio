# Embedded Python runtime

Release builds bundle a standalone CPython here (fetched by `npm run fetch-python`, which
downloads a `python-build-standalone` "install_only" build for the current platform).
NovelStudio uses it to run SpecNovelist's `specnovel.py` so end users don't need Python installed.

In development this folder may contain only this README; the app then falls back to
`NOVELSTUDIO_PYTHON` or the system `py -3` / `python3` / `python`.
