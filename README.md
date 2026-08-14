# Cardio Pace & Race Calculator

A responsive web app for calculating pace, speed, time, and distance across Running, Cycling, Swimming, and Triathlon, in metric or imperial units. See [PROJECT_BIBLE.md](PROJECT_BIBLE.md) for full project context and decisions.

Plain HTML/CSS/JS — no build step, no dependencies.

## Running the project locally

Because the pages load `css/styles.css` and JS modules via relative paths, opening an HTML file directly (`file://…`) won't load them correctly in most browsers. Serve the project over HTTP instead.

A small zero-dependency static file server is included at `.claude/static-server.mjs`.

1. Start the server from the project root:

   ```bash
   node .claude/static-server.mjs
   ```

2. It serves the whole project at `http://localhost:5500`. Open a calculator page in your browser, e.g.:

   ```
   http://localhost:5500/running/index.html
   ```

3. Stop the server with `Ctrl+C`.

`.claude/launch.json` configures this same server for Claude Code's in-app browser preview tool, so it starts automatically in that workflow — the steps above are for running/viewing the site independently of that tool.
