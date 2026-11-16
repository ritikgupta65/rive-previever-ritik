# POPcorn — Rive previewer

Next.js (App Router) + SCSS port of the original single-file tool (`popcorntest.html`).
Behaviour, layout and styling match the original.

## Run

```bash
npm install
npm run dev      # http://localhost:3000
npm run build && npm start
```

## Layout

```
public/
  rive/rive.wasm        Rive WebGL2 renderer wasm (identical to @rive-app/webgl2@2.45.0)
  demos/*.riv           splash coin + 3 demo packages
  fonts/figtree-*.woff2 self-hosted Figtree
  images/               logo + demo thumbnails
src/
  app/                  layout, page, icon
  components/           React UI (header, splash, panels, stage, console, controls)
  lib/controller.ts     all Rive / app logic (load, state machines, data binding, layout, report)
  lib/riveModel.ts      view-model helpers + text report
  lib/logStore.ts       event-console store + console.error/warn mirroring
  styles/               SCSS partials (variables, mixins, one file per area)
```

The assets that were base64-inlined in the HTML now live in `public/` as real files and are
served locally, so the app still makes no CDN requests for the Rive runtime.
