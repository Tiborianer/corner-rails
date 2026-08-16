# Per-train Blender approval workflow

Railjet establishes the production contract; it does not automatically approve or physically recalibrate any other train. Every remaining set advances separately.

## Approval sequence

1. The user supplies reference pictures and identifies the exact class, livery and intended consist.
2. Operator or manufacturer sources fill any missing dimensional or equipment views. Reference photographs are research material only and are never committed or shipped as textures without a suitable licence.
3. Build one editable Blender master, reusable vehicle modules, one complete formation GLB and a metric manifest. Blender owns train geometry; React Three Fiber owns track, platform, catenary, movement, lighting, weather and scenery.
4. Optimize and validate the candidate, then register it only in the private `?trainLab=...` review route. Capture stationary, stopping, pass-through, day, night, rain, desktop and mobile states.
5. Revise until the user explicitly approves the final appearance.
6. Promote the approved asset by changing that train's visual-registry entry from `legacy-v1` to `metric-v1`. Promotion is a reviewed code change, never a laboratory button.

## Version-control boundary

Use one `codex/<train-id>-blender` branch or pull request per train set. Keep the Blender master, scripts, manifest, optimized GLB, citations, screenshots and registry promotion together so approval, rollback and history remain isolated.

## Temporary compatibility rule

Unapproved trains keep their current GLB and `legacy-v1` transform. Compatibility work may fix obvious floating, lane offset or platform intersection in the shared metric scene, but must not remodel the asset, present it as physically accurate, or silently promote it.
