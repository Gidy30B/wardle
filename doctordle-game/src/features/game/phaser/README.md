# Phaser Gameplay Renderer

Deprecated: this directory contains the legacy Phaser gameplay renderer.

Wardle/DxLab is now React-first. New gameplay work should go through the React
surface in `src/features/game/react` and the shared `RoundViewModel` pipeline.

Do not extend Phaser for new product behavior unless you are deliberately
repairing the legacy fallback. The fallback is still kept in the build so old
rendering/debug flows can be selected explicitly with:

```txt
VITE_GAMEPLAY_RENDERER=phaser
```

The default renderer must remain React when this variable is unset or set to any
value other than `phaser`.
