# O3DE AutoGen Editor

A compact Electron editor for schema-driven O3DE autogen XML authoring.

The first bundled schema targets multiplayer `.AutoComponent.xml` files and covers component metadata, includes, component relations, archetype properties, network properties, network inputs, remote procedures, and RPC params.
The second bundled schema targets Script Canvas autogen XML, including `.ScriptCanvasNodeable.xml`, `.ScriptCanvasFunction.xml`, and `.ScriptCanvasGrammar.xml`.

## Run

On Windows, use the included launchers:

```powershell
.\install-windows.cmd
.\start-windows.cmd
```

The scripts use `pnpm` and `node.exe` if they are installed, or the bundled Codex Desktop runtime if available.

If pnpm previously reported `ERR_PNPM_IGNORED_BUILDS` for Electron, rerun `.\install-windows.cmd`. This project now explicitly allows Electron's setup script in `pnpm-workspace.yaml`.

If you have Node.js/npm on your PATH, the standard Electron commands also work:

```powershell
cd Tools\AutoGenEditor
npm install
npm start
```

## Workflow

- Use **Open Project** to load an O3DE project, gem, or engine folder.
- The left panel lists supported autogen XML files discovered through CMake file lists, plus unreferenced files found on disk.
- Select an autogen XML file in the left panel to edit it.
- Use **Add** to create a new AutoComponent beside the selected/list-targeted CMake entries. The editor creates the XML and inserts it into the selected CMake file list.
- Use **Delete** to remove the selected XML and remove its CMake references.
- Use **Open XSD** to point the editor at another autogen schema.
- Use the **Editor** tab for schema-generated fields or **Raw XML** for direct XML editing.
- Use **Save** to write the XML.

The app configures its form from the active XSD. The bundled schemas are intentionally readable so future autogen formats can be added without changing the renderer.

## License

This project follows the standard O3DE dual-license structure. See `LICENSE.txt`, `LICENSE_APACHE2.TXT`, and `LICENSE_MIT.TXT`.
