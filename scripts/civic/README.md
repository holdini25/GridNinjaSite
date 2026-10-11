# Generated civic artwork delivery

`civic-v1` is synthetic architectural artwork made with the built-in `image_gen.imagegen` tool. It is not an engineering diagram, real facility photograph, local Blender render, or evidence of delivered grid/community services. The tool did not report a model identity. Existing `editorial-v1` thumbnails retain their separate native Cycles/Metal provenance.

The authoritative private source record is `assets-source/civic/generation-record.json`. It preserves the exact tool arguments and prompts, original tool-output paths, edit reference, purpose and limitations. The approved source PNGs are `assets-source/civic/generated-v1/landscape.png` and `portrait.png`. Neither this directory nor the generation record is an HTTP asset. They must never appear in a Next deployment trace or `public/`.

Use repository Node 22. The finite packager accepts one **new** private output directory under `build/civic/`:

```sh
node scripts/civic/package.mjs build/civic/generated-package-01
```

The packager validates both source files and provenance before producing derivatives. The landscape record must omit image-reference mechanisms, and the portrait's explicit reference must be exactly the landscape's original tool output. It rejects invented model attribution, missing exact prompts, non-RGB/animated sources, upscaling, and aspect differences over 1%. It performs only centered aspect reconciliation, resizing and sRGB WebP encoding; it makes no creative changes to generated scene content. Landscape output is 640×360, 960×540 and 1280×720. Portrait output is 400×480, 640×768 and 800×960. Each file must fit within 204,800 bytes, with a finite quality search from 90 through 68. A failed output is retained; use a new directory after correcting its cause.

The manifest records the actual source dimensions, original PNG byte hashes and sizes, exact prompt hashes, the whole generation-record hash, conversion parameters, packager hash and actual Node/Sharp/WebP versions. Prompt hashes cover each `arguments.prompt` string's UTF-8 bytes without adding a newline. It contains no Metal device, sample-count, Blender-version or ray-tracing claim. The schema deliberately supports only this generated-source release; rejected native studies are preserved as private historical evidence outside this release path.

After both compositions and their derivative presentation are reviewed, copy only the six declared WebPs and `manifest.json` into a fresh `src/content/civic-releases/civic-v1/` directory. Pin the manifest SHA-256 in the civic registry and mark it available. Packaging alone never registers the release. Existing published manifests and files must remain immutable.

`npm run civic:validate` verifies the full byte allowlist and decoded dimensions. Build validation also verifies deployment tracing and rejects private-source or unregistered files. The asset route validates the registered complete bundle before GET, HEAD, ranges or conditional responses. Withheld/unknown releases return 404, withdrawn releases 410, and corrupt available bundles 503 with no-store errors. HTTP delivery permits the six WebPs only; manifests, source images and original prompts are not served.

The responsive HTML remains responsible for choosing the matching composition and preserving a single equivalent description and visible synthetic-art boundary. Source-art approval, derivative inspection, actual browser behavior and performance qualification are distinct records.
