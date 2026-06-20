const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const fs = require("fs/promises");
const path = require("path");

let mainWindow;
let currentXmlPath = null;
let currentProjectRoot = null;

const ignoredDirectories = new Set([
    ".git",
    ".pnpm",
    "node_modules",
    "bin",
    "cache",
    "build",
    "build_windows",
    "builds",
    "install"
]);

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1420,
        height: 900,
        minWidth: 980,
        minHeight: 680,
        backgroundColor: "#2d2d2d",
        title: "O3DE AutoGen Editor",
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
}

app.whenReady().then(() => {
    createWindow();

    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});

ipcMain.handle("schema:loadDefault", async () => {
    const autoComponentPath = path.join(__dirname, "..", "schemas", "multiplayer-autocomponent.xsd");
    const scriptCanvasPath = path.join(__dirname, "..", "schemas", "scriptcanvas-autogen.xsd");
    const autoPacketsPath = path.join(__dirname, "..", "schemas", "autopackets.xsd");
    return {
        filePath: autoComponentPath,
        text: await fs.readFile(autoComponentPath, "utf8"),
        schemas: {
            autocomponent: {
                filePath: autoComponentPath,
                text: await fs.readFile(autoComponentPath, "utf8")
            },
            scriptcanvas: {
                filePath: scriptCanvasPath,
                text: await fs.readFile(scriptCanvasPath, "utf8")
            },
            autopackets: {
                filePath: autoPacketsPath,
                text: await fs.readFile(autoPacketsPath, "utf8")
            }
        }
    };
});

ipcMain.handle("schema:open", async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        title: "Open Autogen XSD",
        properties: ["openFile"],
        filters: [{ name: "XSD schema", extensions: ["xsd"] }]
    });

    if (result.canceled || result.filePaths.length === 0) {
        return null;
    }

    const filePath = result.filePaths[0];
    return {
        filePath,
        text: await fs.readFile(filePath, "utf8")
    };
});

ipcMain.handle("project:open", async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        title: "Open O3DE Project or Gem Folder",
        properties: ["openDirectory"]
    });

    if (result.canceled || result.filePaths.length === 0) {
        return null;
    }

    currentProjectRoot = result.filePaths[0];
    return scanProject(currentProjectRoot);
});

ipcMain.handle("project:rescan", async () => {
    if (!currentProjectRoot) {
        return null;
    }

    return scanProject(currentProjectRoot);
});

ipcMain.handle("xml:open", async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        title: "Open Autogen XML",
        properties: ["openFile"],
        filters: [
            { name: "Autogen XML", extensions: ["xml"] },
            { name: "All files", extensions: ["*"] }
        ]
    });

    if (result.canceled || result.filePaths.length === 0) {
        return null;
    }

    currentXmlPath = result.filePaths[0];
    return {
        filePath: currentXmlPath,
        text: await fs.readFile(currentXmlPath, "utf8")
    };
});

ipcMain.handle("xml:read", async (_event, filePath) => {
    currentXmlPath = filePath;
    return {
        filePath,
        text: await fs.readFile(filePath, "utf8")
    };
});

ipcMain.handle("xml:save", async (_event, filePathOrXmlText, maybeXmlText) => {
    const hasExplicitPath = typeof maybeXmlText === "string";
    const filePath = hasExplicitPath ? filePathOrXmlText : currentXmlPath;
    const xmlText = hasExplicitPath ? maybeXmlText : filePathOrXmlText;

    if (!filePath) {
        return saveXmlAs(xmlText);
    }

    await fs.writeFile(filePath, xmlText, "utf8");
    currentXmlPath = filePath;
    return { filePath };
});

ipcMain.handle("xml:saveAs", async (_event, xmlText) => {
    return saveXmlAs(xmlText);
});

ipcMain.handle("path:choose", async (_event, request) => {
    const context = resolvePathContext(request || {});
    const result = await dialog.showOpenDialog(mainWindow, {
        title: "Select File",
        defaultPath: context.defaultPath,
        properties: ["openFile"],
        filters: [
            { name: "Common source files", extensions: ["h", "hpp", "cpp", "inl", "xml", "jinja", "azasset", "png", "svg"] },
            { name: "All files", extensions: ["*"] }
        ]
    });

    if (result.canceled || result.filePaths.length === 0) {
        return null;
    }

    return {
        filePath: result.filePaths[0],
        value: toDialogRelativePath(context.baseDirectory, result.filePaths[0])
    };
});

ipcMain.handle("path:create", async (_event, request) => {
    const context = resolvePathContext(request || {});
    const result = await dialog.showSaveDialog(mainWindow, {
        title: "Create File",
        defaultPath: context.defaultPath,
        filters: [
            { name: "Common source files", extensions: ["h", "hpp", "cpp", "inl", "xml", "jinja"] },
            { name: "All files", extensions: ["*"] }
        ]
    });

    if (result.canceled || !result.filePath) {
        return null;
    }

    await fs.mkdir(path.dirname(result.filePath), { recursive: true });
    try {
        await fs.writeFile(result.filePath, "", { encoding: "utf8", flag: "wx" });
    } catch (error) {
        if (error.code !== "EEXIST") {
            throw error;
        }
    }

    return {
        filePath: result.filePath,
        value: toDialogRelativePath(context.baseDirectory, result.filePath)
    };
});

ipcMain.handle("component:create", async (_event, request) => {
    if (!currentProjectRoot) {
        throw new Error("Open a project folder first.");
    }

    const componentKind = normalizeCreateKind(request.componentKind);
    const componentName = sanitizeAutogenName(request.componentName || defaultAutogenName(componentKind), componentKind);
    const scan = await scanProject(currentProjectRoot);
    const targetCmake = chooseTargetCmake(scan, request.targetCmakePath);

    if (!targetCmake) {
        throw new Error("No CMake file with autogen XML entries was found.");
    }

    const relativeDirectory = chooseAutoComponentDirectory(targetCmake, scan);
    const relativePath = path.posix.join(relativeDirectory, autogenFileName(componentName, componentKind));
    const filePath = path.resolve(path.dirname(targetCmake.path), toPlatformPath(relativePath));

    try {
        await fs.access(filePath);
        throw new Error(`${relativePath} already exists.`);
    } catch (error) {
        if (error.code !== "ENOENT") {
            throw error;
        }
    }

    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, createAutogenXml(componentName, componentKind, inferNamespace(targetCmake, scan)), "utf8");
    await addCmakeReference(targetCmake.path, relativePath);
    return {
        ...(await scanProject(currentProjectRoot)),
        createdPath: path.normalize(filePath)
    };
});

ipcMain.handle("component:delete", async (_event, filePath) => {
    if (!currentProjectRoot) {
        throw new Error("Open a project folder first.");
    }

    await fs.rm(filePath, { force: true });
    const scan = await scanProject(currentProjectRoot);
    const cmakeFiles = await collectFiles(currentProjectRoot, isCmakeFile);
    for (const cmakePath of cmakeFiles) {
        await removeCmakeReference(cmakePath, filePath);
    }
    return scanProject(currentProjectRoot);
});

async function saveXmlAs(xmlText) {
    const result = await dialog.showSaveDialog(mainWindow, {
        title: "Save Autogen XML",
        defaultPath: "NewComponent.AutoComponent.xml",
        filters: [{ name: "Autogen XML", extensions: ["xml"] }]
    });

    if (result.canceled || !result.filePath) {
        return null;
    }

    currentXmlPath = result.filePath;
    await fs.writeFile(currentXmlPath, xmlText, "utf8");
    return { filePath: currentXmlPath };
}

async function scanProject(projectRoot) {
    const scanErrors = [];
    const allInterestingFiles = await collectFiles(projectRoot, isInterestingProjectFile, scanErrors);
    const cmakeFiles = allInterestingFiles.filter(isCmakeFile);
    const xmlFiles = allInterestingFiles.filter(isAutogenXml);
    const jinjaFiles = allInterestingFiles.filter(isAutogenJinja);
    const itemsByPath = new Map();
    const cmakeSummaries = new Map();

    for (const cmakePath of cmakeFiles) {
        const references = await parseCmakeAutoComponentReferences(cmakePath, scanErrors);

        cmakeSummaries.set(cmakePath, {
            path: cmakePath,
            relativePath: toProjectRelative(projectRoot, cmakePath),
            count: references.length
        });

        for (const reference of references) {
            const item = await getOrCreateComponentItem(itemsByPath, reference.filePath, projectRoot);
            item.references.push({
                cmakePath,
                cmakeRelativePath: toProjectRelative(projectRoot, cmakePath),
                xmlRelativePath: reference.relativePath
            });
        }
    }

    for (const xmlPath of xmlFiles) {
        await getOrCreateComponentItem(itemsByPath, xmlPath, projectRoot);
    }

    const components = Array.from(itemsByPath.values())
        .map((item) => ({
            ...item,
            referenced: item.references.length > 0
        }))
        .sort((a, b) => a.relativePath.localeCompare(b.relativePath));

    return {
        projectRoot,
        components,
        cmakeFiles: Array.from(cmakeSummaries.values()).sort((a, b) => b.count - a.count || a.relativePath.localeCompare(b.relativePath)),
        jinjaFiles: jinjaFiles.map((filePath) => ({
            path: filePath,
            relativePath: toProjectRelative(projectRoot, filePath)
        })).sort((a, b) => a.relativePath.localeCompare(b.relativePath)),
        stats: {
            cmakeFileCount: cmakeFiles.length,
            autoComponentXmlCount: xmlFiles.filter(isAutoComponentXml).length,
            scriptCanvasXmlCount: xmlFiles.filter(isScriptCanvasAutogenXml).length,
            autoPacketsXmlCount: xmlFiles.filter(isAutoPacketsXml).length,
            autoComponentJinjaCount: jinjaFiles.length,
            skippedDirectoryCount: scanErrors.filter((error) => error.type === "directory").length
        },
        scanErrors
    };
}

async function collectFiles(root, predicate, scanErrors = []) {
    const results = [];
    const visitedDirectories = new Set();

    async function walk(directory) {
        let realDirectory;
        try {
            realDirectory = await fs.realpath(directory);
        } catch (error) {
            scanErrors.push({
                type: "directory",
                path: directory,
                message: error.message
            });
            return;
        }

        const normalizedRealDirectory = path.normalize(realDirectory).toLowerCase();
        if (visitedDirectories.has(normalizedRealDirectory)) {
            return;
        }
        visitedDirectories.add(normalizedRealDirectory);

        let entries;
        try {
            entries = await fs.readdir(directory, { withFileTypes: true });
        } catch (error) {
            scanErrors.push({
                type: "directory",
                path: directory,
                message: error.message
            });
            return;
        }

        for (const entry of entries) {
            const entryPath = path.join(directory, entry.name);
            if (entry.isDirectory() || entry.isSymbolicLink()) {
                if (!shouldIgnoreDirectory(entry.name)) {
                    await walk(entryPath);
                }
                continue;
            }

            if (entry.isFile() && predicate(entryPath)) {
                results.push(entryPath);
            }
        }
    }

    await walk(root);
    return results;
}

function shouldIgnoreDirectory(directoryName) {
    const lowerName = directoryName.toLowerCase();
    return ignoredDirectories.has(lowerName) || lowerName.endsWith(".build");
}

function isInterestingProjectFile(filePath) {
    return isCmakeFile(filePath) || isAutogenXml(filePath) || isAutogenJinja(filePath);
}

function isCmakeFile(filePath) {
    const fileName = path.basename(filePath);
    return fileName === "CMakeLists.txt" || fileName.toLowerCase().endsWith(".cmake");
}

function isAutoComponentXml(filePath) {
    return filePath.toLowerCase().endsWith(".autocomponent.xml");
}

function isScriptCanvasAutogenXml(filePath) {
    const lowerPath = filePath.toLowerCase();
    return lowerPath.endsWith(".scriptcanvasnodeable.xml")
        || lowerPath.endsWith(".scriptcanvasfunction.xml")
        || lowerPath.endsWith(".scriptcanvasgrammar.xml");
}

function isAutoPacketsXml(filePath) {
    return filePath.toLowerCase().endsWith(".autopackets.xml");
}

function isAutogenXml(filePath) {
    return isAutoComponentXml(filePath) || isScriptCanvasAutogenXml(filePath) || isAutoPacketsXml(filePath);
}

function isAutogenJinja(filePath) {
    const fileName = path.basename(filePath).toLowerCase();
    return fileName.endsWith(".jinja") && (fileName.includes("autocomponent") || fileName.includes("scriptcanvas") || fileName.includes("autopacket"));
}

async function parseCmakeAutoComponentReferences(cmakePath, scanErrors = []) {
    let text;
    try {
        text = await fs.readFile(cmakePath, "utf8");
    } catch (error) {
        scanErrors.push({
            type: "cmake",
            path: cmakePath,
            message: error.message
        });
        return [];
    }

    const references = [];
    const seen = new Set();
    const regex = /([A-Za-z0-9_./\\-]+\.(?:AutoComponent|AutoPackets|ScriptCanvasNodeable|ScriptCanvasFunction|ScriptCanvasGrammar)\.xml)/gi;
    let match;

    while ((match = regex.exec(text)) !== null) {
        const relativePath = normalizeCmakePath(match[1]);
        if (relativePath.includes("*") || seen.has(relativePath)) {
            continue;
        }

        seen.add(relativePath);
        references.push({
            relativePath,
            filePath: path.resolve(path.dirname(cmakePath), toPlatformPath(relativePath))
        });
    }

    return references;
}

async function getOrCreateComponentItem(itemsByPath, filePath, projectRoot) {
    const normalizedPath = path.normalize(filePath);
    if (itemsByPath.has(normalizedPath)) {
        return itemsByPath.get(normalizedPath);
    }

    const metadata = await readComponentMetadata(normalizedPath);
    const item = {
        path: normalizedPath,
        relativePath: toProjectRelative(projectRoot, normalizedPath),
        fileName: path.basename(normalizedPath),
        name: metadata.name || autogenBaseName(normalizedPath),
        namespace: metadata.namespace,
        kind: metadata.kind || autogenKind(normalizedPath),
        exists: metadata.exists,
        references: []
    };
    itemsByPath.set(normalizedPath, item);
    return item;
}

async function readComponentMetadata(filePath) {
    try {
        const text = await fs.readFile(filePath, "utf8");
        return {
            exists: true,
            name: readXmlAttribute(text, "Name"),
            namespace: readXmlAttribute(text, "Namespace") || readXmlAttribute(text, "QualifiedName"),
            kind: autogenKind(filePath)
        };
    } catch {
        return {
            exists: false,
            name: "",
            namespace: "",
            kind: autogenKind(filePath)
        };
    }
}

function readXmlAttribute(xmlText, attributeName) {
    const match = xmlText.match(new RegExp(`${attributeName}\\s*=\\s*"([^"]*)"`));
    return match ? match[1] : "";
}

function autogenKind(filePath) {
    const lowerPath = filePath.toLowerCase();
    if (lowerPath.endsWith(".autocomponent.xml")) {
        return "autocomponent";
    }
    if (lowerPath.endsWith(".autopackets.xml")) {
        return "autopackets";
    }
    if (lowerPath.endsWith(".scriptcanvasfunction.xml")) {
        return "scriptcanvas-function";
    }
    if (lowerPath.endsWith(".scriptcanvasgrammar.xml")) {
        return "scriptcanvas-grammar";
    }
    if (lowerPath.endsWith(".scriptcanvasnodeable.xml")) {
        return "scriptcanvas-nodeable";
    }
    return "xml";
}

function autogenBaseName(filePath) {
    return path.basename(filePath)
        .replace(/\.AutoComponent\.xml$/i, "")
        .replace(/\.AutoPackets\.xml$/i, "")
        .replace(/\.ScriptCanvasNodeable\.xml$/i, "")
        .replace(/\.ScriptCanvasFunction\.xml$/i, "")
        .replace(/\.ScriptCanvasGrammar\.xml$/i, "");
}

function chooseTargetCmake(scan, requestedPath) {
    if (requestedPath) {
        const requested = scan.cmakeFiles.find((cmake) => path.normalize(cmake.path) === path.normalize(requestedPath));
        if (requested) {
            return requested;
        }
    }

    return scan.cmakeFiles[0] || null;
}

function chooseAutoComponentDirectory(targetCmake, scan) {
    const directoryCounts = new Map();

    for (const component of scan.components) {
        for (const reference of component.references) {
            if (path.normalize(reference.cmakePath) === path.normalize(targetCmake.path)) {
                const directory = path.posix.dirname(reference.xmlRelativePath);
                directoryCounts.set(directory, (directoryCounts.get(directory) || 0) + 1);
            }
        }
    }

    return Array.from(directoryCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "Source/AutoGen";
}

function inferNamespace(targetCmake, scan) {
    for (const component of scan.components) {
        if (!component.namespace) {
            continue;
        }
        if (component.references.some((reference) => path.normalize(reference.cmakePath) === path.normalize(targetCmake.path))) {
            return component.namespace;
        }
    }
    return "";
}

async function addCmakeReference(cmakePath, relativePath) {
    const text = await fs.readFile(cmakePath, "utf8");
    if (text.includes(relativePath)) {
        return;
    }

    const lines = text.split(/\r?\n/);
    const newline = text.includes("\r\n") ? "\r\n" : "\n";
    let insertAt = -1;
    let indent = "    ";

    lines.forEach((line, index) => {
        if (containsAutogenXmlReference(line)) {
            insertAt = index + 1;
            indent = line.match(/^\s*/)?.[0] || indent;
        }
    });

    if (insertAt < 0) {
        const closeIndex = lines.findIndex((line) => line.trim() === ")");
        insertAt = closeIndex >= 0 ? closeIndex : lines.length;
    }

    lines.splice(insertAt, 0, `${indent}${relativePath}`);
    await fs.writeFile(cmakePath, lines.join(newline), "utf8");
}

function containsAutogenXmlReference(line) {
    return /\.(?:AutoComponent|AutoPackets|ScriptCanvasNodeable|ScriptCanvasFunction|ScriptCanvasGrammar)\.xml/i.test(line);
}

async function removeCmakeReference(cmakePath, componentPath) {
    const text = await fs.readFile(cmakePath, "utf8");
    const cmakeDirectory = path.dirname(cmakePath);
    const lines = text.split(/\r?\n/);
    const filtered = lines.filter((line) => {
        const refs = Array.from(line.matchAll(/([A-Za-z0-9_./\\-]+\.(?:AutoComponent|AutoPackets|ScriptCanvasNodeable|ScriptCanvasFunction|ScriptCanvasGrammar)\.xml)/gi));
        if (refs.length === 0) {
            return true;
        }
        return !refs.some((match) => path.normalize(path.resolve(cmakeDirectory, toPlatformPath(normalizeCmakePath(match[1])))) === path.normalize(componentPath));
    });

    if (filtered.length !== lines.length) {
        await fs.writeFile(cmakePath, filtered.join(text.includes("\r\n") ? "\r\n" : "\n"), "utf8");
    }
}

function createComponentXml(componentName, namespaceName) {
    return `<?xml version="1.0"?>\n\n<Component\n    Name="${componentName}"\n    Namespace="${namespaceName}"\n    OverrideComponent="false"\n    OverrideController="false"\n    OverrideInclude=""\n    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">\n</Component>\n`;
}

function createScriptCanvasNodeableXml(nodeableName, namespaceName) {
    const qualifiedName = namespaceName ? `${namespaceName}::${nodeableName}` : nodeableName;
    return `<?xml version="1.0"?>\n\n<ScriptCanvas xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">\n    <Class\n        Name="${nodeableName}"\n        QualifiedName="${qualifiedName}"\n        PreferredClassName="${nodeableName}"\n        Uuid="${generateUuid()}"\n        NodeableUuid="${generateUuid()}" />\n</ScriptCanvas>\n`;
}

function createAutoPacketsXml(packetGroupName) {
    return `<?xml version="1.0"?>\n\n<PacketGroup Name="${packetGroupName}" PacketStart="0">\n</PacketGroup>\n`;
}

function createAutogenXml(name, kind, namespaceName) {
    if (kind === "scriptcanvas-nodeable") {
        return createScriptCanvasNodeableXml(name, namespaceName);
    }
    if (kind === "autopackets") {
        return createAutoPacketsXml(name);
    }

    return createComponentXml(name, namespaceName);
}

function normalizeCreateKind(kind) {
    return ["autocomponent", "autopackets", "scriptcanvas-nodeable"].includes(kind) ? kind : "autocomponent";
}

function defaultAutogenName(kind) {
    if (kind === "autopackets") {
        return "NewPackets";
    }
    return kind === "scriptcanvas-nodeable" ? "NewNodeable" : "NewComponent";
}

function sanitizeAutogenName(name, kind) {
    const sanitized = name.replace(/[^A-Za-z0-9_]/g, "");
    if (!sanitized) {
        throw new Error("Name must contain letters, numbers, or underscores.");
    }
    if (kind === "autocomponent") {
        return sanitized.endsWith("Component") ? sanitized : `${sanitized}Component`;
    }
    return sanitized;
}

function autogenFileName(name, kind) {
    if (kind === "scriptcanvas-nodeable") {
        return `${name}.ScriptCanvasNodeable.xml`;
    }
    if (kind === "autopackets") {
        return `${name}.AutoPackets.xml`;
    }
    return `${name}.AutoComponent.xml`;
}

function generateUuid() {
    return `{${require("crypto").randomUUID().toUpperCase()}}`;
}

function normalizeCmakePath(cmakePath) {
    return cmakePath.replaceAll("\\", "/");
}

function toPlatformPath(cmakePath) {
    return cmakePath.replaceAll("/", path.sep);
}

function toProjectRelative(projectRoot, filePath) {
    return normalizeCmakePath(path.relative(projectRoot, filePath));
}

function resolvePathContext(request) {
    const currentFilePath = request.currentFilePath || currentXmlPath || currentProjectRoot || app.getPath("documents");
    const currentValue = request.currentValue || "";
    const startDirectory = directoryForPathContext(currentFilePath);
    const baseDirectory = inferPathBase(startDirectory, currentValue);
    const defaultPath = currentValue
        ? resolveMaybeRelativePath(baseDirectory, currentValue)
        : baseDirectory;

    return { baseDirectory, defaultPath };
}

function directoryForPathContext(filePath) {
    if (!filePath) {
        return currentProjectRoot || app.getPath("documents");
    }

    const parsed = path.parse(filePath);
    return parsed.ext ? path.dirname(filePath) : filePath;
}

function inferPathBase(startDirectory, currentValue) {
    if (!currentValue || path.isAbsolute(currentValue)) {
        return startDirectory;
    }

    let directory = startDirectory;
    while (true) {
        const candidate = resolveMaybeRelativePath(directory, currentValue);
        if (pathExistsSyncSafe(candidate)) {
            return directory;
        }

        if (!currentProjectRoot || path.normalize(directory).toLowerCase() === path.normalize(currentProjectRoot).toLowerCase()) {
            return startDirectory;
        }

        const parent = path.dirname(directory);
        if (parent === directory) {
            return startDirectory;
        }
        directory = parent;
    }
}

function resolveMaybeRelativePath(baseDirectory, filePath) {
    if (path.isAbsolute(filePath)) {
        return filePath;
    }
    return path.resolve(baseDirectory, toPlatformPath(filePath));
}

function pathExistsSyncSafe(filePath) {
    try {
        require("fs").accessSync(filePath);
        return true;
    } catch {
        return false;
    }
}

function toDialogRelativePath(baseDirectory, filePath) {
    const relativePath = normalizeCmakePath(path.relative(baseDirectory, filePath));
    if (!relativePath.startsWith("../") && relativePath !== "..") {
        return relativePath;
    }
    return normalizeCmakePath(filePath);
}
