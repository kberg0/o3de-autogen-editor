const state = {
    schema: null,
    schemas: {},
    schemaPath: "",
    project: null,
    selectedPath: "",
    document: null,
    unknownXmlNotes: [],
    filterText: "",
    selectedCmakePath: "",
    mode: "editor",
    rawXmlText: ""
};

const editorBuild = "renderer-2026-06-20-azcore-type-suggestions";

const STANDARD_TYPE_SUGGESTIONS = [
    "bool",
    "char",
    "int8_t",
    "uint8_t",
    "int16_t",
    "uint16_t",
    "int32_t",
    "uint32_t",
    "int64_t",
    "uint64_t",
    "float",
    "double",
    "AZ::s8",
    "AZ::u8",
    "AZ::s16",
    "AZ::u16",
    "AZ::s32",
    "AZ::u32",
    "AZ::s64",
    "AZ::u64",
    "AZStd::string",
    "AZStd::vector",
    "AZStd::array",
    "AZStd::unordered_map",
    "AZ::Crc32",
    "AZ::Name",
    "AZ::Uuid",
    "AZ::EntityId",
    "AZ::VectorFloat",
    "AZ::Vector2",
    "AZ::Vector3",
    "AZ::Vector4",
    "AZ::Quaternion",
    "AZ::Transform",
    "AZ::Matrix3x3",
    "AZ::Matrix3x4",
    "AZ::Matrix4x4",
    "AZ::Plane",
    "AZ::Aabb",
    "AZ::Obb",
    "AZ::Sphere",
    "AZ::Color",
    "AzNetworking::ConnectionId",
    "AzNetworking::PacketId",
    "Multiplayer::NetEntityId",
    "Multiplayer::HostId",
    "Multiplayer::NetworkInputId",
    "Multiplayer::NetworkEntityHandle"
];

const api = window.autogenApi || window.autoComponentApi || {
    loadDefaultSchema: async () => {
        const response = await fetch("../../schemas/multiplayer-autocomponent.xsd");
        return {
            filePath: "multiplayer-autocomponent.xsd",
            text: await response.text()
        };
    },
    openSchema: async () => null,
    openProject: async () => null,
    rescanProject: async () => null,
    openXml: async () => null,
    readXml: async () => null,
    saveXml: async () => null,
    saveXmlAs: async () => null,
    choosePath: async () => null,
    createPath: async () => null,
    createComponent: async () => null,
    deleteComponent: async () => null
};

const elements = {
    openProjectButton: document.getElementById("openProjectButton"),
    newComponentButton: document.getElementById("newComponentButton"),
    openSchemaButton: document.getElementById("openSchemaButton"),
    rescanButton: document.getElementById("rescanButton"),
    saveButton: document.getElementById("saveButton"),
    addListButton: document.getElementById("addListButton"),
    deleteListButton: document.getElementById("deleteListButton"),
    deleteComponentButton: document.getElementById("deleteComponentButton"),
    copyXmlButton: document.getElementById("copyXmlButton"),
    editorTabButton: document.getElementById("editorTabButton"),
    xmlTabButton: document.getElementById("xmlTabButton"),
    projectLabel: document.getElementById("projectLabel"),
    componentFilter: document.getElementById("componentFilter"),
    cmakeTargetSelect: document.getElementById("cmakeTargetSelect"),
    componentList: document.getElementById("componentList"),
    issuesBar: document.getElementById("issuesBar"),
    editorPanel: document.getElementById("editorPanel"),
    rawXmlPanel: document.getElementById("rawXmlPanel"),
    rawXmlEditor: document.getElementById("rawXmlEditor"),
    emptyPanel: document.getElementById("emptyPanel"),
    documentName: document.getElementById("documentName"),
    statusText: document.getElementById("statusText"),
    issueCount: document.getElementById("issueCount"),
    issues: document.getElementById("issues"),
    createComponentDialog: document.getElementById("createComponentDialog"),
    createComponentName: document.getElementById("createComponentName"),
    createComponentKind: document.getElementById("createComponentKind"),
    confirmCreateComponentButton: document.getElementById("confirmCreateComponentButton"),
    cancelCreateComponentButton: document.getElementById("cancelCreateComponentButton")
};

window.addEventListener("DOMContentLoaded", initialize);

async function initialize() {
    wireActions();
    ensureTypeSuggestionList();

    try {
        const result = await api.loadDefaultSchema();
        loadDefaultSchemas(result);
        render();
        setStatus(`Open a project folder (${editorBuild})`);
    } catch (error) {
        setStatus(`Unable to load schema: ${error.message}`);
    }
}

function wireActions() {
    elements.openProjectButton.addEventListener("click", openProject);
    elements.newComponentButton.addEventListener("click", createComponent);
    elements.addListButton.addEventListener("click", createComponent);
    elements.openSchemaButton.addEventListener("click", openSchema);
    elements.rescanButton.addEventListener("click", rescanProject);
    elements.saveButton.addEventListener("click", saveXml);
    elements.deleteComponentButton.addEventListener("click", deleteComponent);
    elements.deleteListButton.addEventListener("click", deleteComponent);
    elements.copyXmlButton.addEventListener("click", copyXml);
    elements.editorTabButton.addEventListener("click", () => switchMode("editor"));
    elements.xmlTabButton.addEventListener("click", () => switchMode("xml"));
    elements.rawXmlEditor.addEventListener("input", () => {
        state.rawXmlText = elements.rawXmlEditor.value;
    });
    elements.componentFilter.addEventListener("input", () => {
        state.filterText = elements.componentFilter.value.trim().toLowerCase();
        renderComponentList();
    });
    elements.cmakeTargetSelect.addEventListener("change", changeCmakeScope);
}

function loadSchema(schemaText, filePath) {
    state.schema = parseSchema(schemaText);
    state.schemaPath = filePath;
}

function loadDefaultSchemas(result) {
    if (result.schemas) {
        state.schemas.autocomponent = parseSchema(result.schemas.autocomponent.text);
        state.schemas.scriptcanvas = parseSchema(result.schemas.scriptcanvas.text);
        state.schemas.autopackets = parseSchema(result.schemas.autopackets.text);
        state.schema = state.schemas.autocomponent;
        state.schemaPath = result.schemas.autocomponent.filePath;
        return;
    }

    loadSchema(result.text, result.filePath);
    state.schemas.autocomponent = state.schema;
}

async function openSchema() {
    const result = await api.openSchema();
    if (!result) {
        return;
    }

    try {
        loadSchema(result.text, result.filePath);
        if (state.selectedPath) {
            await selectComponent(state.selectedPath);
        } else {
            render();
        }
        setStatus(`Schema loaded: ${basename(result.filePath)}`);
    } catch (error) {
        setStatus(`Schema error: ${error.message}`);
    }
}

async function openProject() {
    try {
        setStatus("Scanning project...");
        const result = await api.openProject();
        if (!result) {
            setStatus("Project open canceled");
            return;
        }

        await loadProject(result);
    } catch (error) {
        setStatus(`Project scan failed: ${error.message}`);
    }
}

async function rescanProject() {
    try {
        setStatus("Rescanning project...");
        const result = await api.rescanProject();
        if (!result) {
            setStatus("Open a project first");
            return;
        }

        await loadProject(result, state.selectedPath);
    } catch (error) {
        setStatus(`Project scan failed: ${error.message}`);
    }
}

async function loadProject(project, preferredPath = "") {
    state.project = project;
    elements.projectLabel.textContent = `${basename(project.projectRoot)} - ${project.components.length} autogen files`;
    if (state.selectedCmakePath && !project.cmakeFiles.some((cmakeFile) => cmakeFile.path === state.selectedCmakePath)) {
        state.selectedCmakePath = "";
    }
    state.selectedPath = "";
    state.document = null;
    renderProjectControls();
    renderComponentList();

    const visibleComponents = filteredComponents();
    const selected = visibleComponents.find((component) => component.path === preferredPath)
        || visibleComponents[0]
        || (state.selectedCmakePath ? null : project.components.find((component) => component.path === preferredPath))
        || (state.selectedCmakePath ? null : project.components[0]);
    if (selected) {
        await selectComponent(selected.path);
    } else {
        state.selectedPath = "";
        state.document = null;
        render();
        setStatus(scanSummary(project, "No autogen XML found"));
    }
}

async function changeCmakeScope() {
    state.selectedCmakePath = elements.cmakeTargetSelect.value;
    const visibleComponents = filteredComponents();
    const selectedIsVisible = visibleComponents.some((component) => component.path === state.selectedPath);

    if (!state.selectedCmakePath || selectedIsVisible) {
        render();
        return;
    }

    if (visibleComponents[0]) {
        await selectComponent(visibleComponents[0].path);
        return;
    }

    state.selectedPath = "";
    state.document = null;
    render();
}

async function selectComponent(filePath) {
    if (!state.schema) {
        return;
    }

    const component = findComponent(filePath);
    if (!component || !component.exists) {
        setStatus("The selected autogen XML file is missing");
        return;
    }

    try {
        const result = await api.readXml(filePath);
        state.selectedPath = result.filePath;
        state.schema = schemaForComponent(component);
        state.document = parseXml(result.text, state.schema);
        state.rawXmlText = serializeDocument();
        state.mode = "editor";
        render();
        setStatus(scanSummary(state.project, component.relativePath));
    } catch (error) {
        setStatus(`XML error: ${error.message}`);
    }
}

async function createComponent() {
    if (!state.project) {
        setStatus("Open a project first");
        return;
    }

    const targetCmakePath = selectedTargetCmakePath();
    if (!targetCmakePath) {
        setStatus("Choose a CMake file before adding an AutoComponent.");
        return;
    }

    const request = await askForComponentRequest();
    if (!request) {
        return;
    }

    try {
        const response = await api.createComponent({
            componentName: request.name,
            componentKind: request.kind,
            targetCmakePath
        });
        const project = response.project || response;
        await loadProject(project, "");
        const created = response.createdPath
            ? project.components.find((component) => component.path === response.createdPath)
            : findCreatedComponent(project, request);
        if (created) {
            await selectComponent(created.path);
        }
        setStatus(`${kindLabel(request.kind)} created and added to CMake`);
    } catch (error) {
        setStatus(`Create failed: ${error.message}`);
    }
}

function selectedTargetCmakePath() {
    return state.selectedCmakePath || elements.cmakeTargetSelect.value || "";
}

function askForComponentRequest() {
    return new Promise((resolve) => {
        const dialog = elements.createComponentDialog;
        const input = elements.createComponentName;
        const kindSelect = elements.createComponentKind;
        const confirmButton = elements.confirmCreateComponentButton;
        const cancelButton = elements.cancelCreateComponentButton;
        let settled = false;

        const cleanup = () => {
            dialog.hidden = true;
            confirmButton.removeEventListener("click", confirm);
            cancelButton.removeEventListener("click", cancel);
            dialog.removeEventListener("click", clickOutside);
            input.removeEventListener("keydown", handleKeyDown);
            kindSelect.removeEventListener("change", changeKind);
        };

        const finish = (value) => {
            if (settled) {
                return;
            }
            settled = true;
            cleanup();
            resolve(value);
        };

        const confirm = () => {
            const name = input.value.trim();
            finish(name ? { name, kind: kindSelect.value } : null);
        };
        const cancel = () => finish(null);
        const clickOutside = (event) => {
            if (event.target === dialog) {
                cancel();
            }
        };
        const handleKeyDown = (event) => {
            if (event.key === "Enter") {
                event.preventDefault();
                confirm();
            } else if (event.key === "Escape") {
                event.preventDefault();
                cancel();
            }
        };
        const changeKind = () => {
            input.value = componentNameSuggestion(kindSelect.value);
            input.focus();
            input.select();
        };

        kindSelect.value = createKindSuggestion();
        input.value = componentNameSuggestion(kindSelect.value);
        dialog.hidden = false;
        confirmButton.addEventListener("click", confirm);
        cancelButton.addEventListener("click", cancel);
        dialog.addEventListener("click", clickOutside);
        input.addEventListener("keydown", handleKeyDown);
        kindSelect.addEventListener("change", changeKind);
        input.focus();
        input.select();
    });
}

function createKindSuggestion() {
    const selected = findComponent(state.selectedPath);
    return selected?.kind?.startsWith("scriptcanvas")
        ? "scriptcanvas-nodeable"
        : selected?.kind === "autopackets"
            ? "autopackets"
        : "autocomponent";
}

function componentNameSuggestion(kind) {
    const selected = findComponent(state.selectedPath);
    if (!selected?.name) {
        if (kind === "scriptcanvas-nodeable") {
            return "NewNodeable";
        }
        if (kind === "autopackets") {
            return "NewPackets";
        }
        return "NewNetworkComponent";
    }

    const baseName = selected.name.replace(/Component$/i, "").replace(/Nodeable$/i, "").replace(/Packets$/i, "") || selected.name;
    if (kind === "autopackets") {
        return `${baseName}Packets`;
    }
    return kind === "scriptcanvas-nodeable" ? `${baseName}Nodeable` : `${baseName}Component`;
}

function findCreatedComponent(project, request) {
    const sanitizedName = request.name.replace(/[^A-Za-z0-9_]/g, "");
    const expectedFileName = {
        autopackets: `${sanitizedName}.AutoPackets.xml`,
        "scriptcanvas-nodeable": `${sanitizedName}.ScriptCanvasNodeable.xml`,
        autocomponent: `${sanitizedName.replace(/Component$/i, "")}Component.AutoComponent.xml`
    }[request.kind];
    return project.components.find((component) => component.fileName === expectedFileName) || null;
}

async function deleteComponent() {
    const component = findComponent(state.selectedPath);
    if (!component) {
        return;
    }

    const confirmed = confirm(`Delete ${component.fileName} and remove it from CMake lists?`);
    if (!confirmed) {
        return;
    }

    try {
        const project = await api.deleteComponent(component.path);
        await loadProject(project);
        setStatus("AutoComponent deleted");
    } catch (error) {
        setStatus(`Delete failed: ${error.message}`);
    }
}

async function saveXml() {
    if (!state.document || !state.selectedPath) {
        setStatus("No autogen XML selected");
        return;
    }

    let xmlText = serializeDocument();
    if (state.mode === "xml") {
        try {
            state.document = parseXml(state.rawXmlText, state.schema);
            xmlText = state.rawXmlText;
        } catch (error) {
            setStatus(`Raw XML error: ${error.message}`);
            renderPreviewAndIssues();
            return;
        }
    }

    const result = await api.saveXml(state.selectedPath, xmlText);
    if (!result) {
        return;
    }

    await rescanProject();
    setStatus("Saved");
}

async function copyXml() {
    if (!state.document) {
        return;
    }

    await navigator.clipboard.writeText(state.mode === "xml" ? state.rawXmlText : serializeDocument());
    setStatus("XML copied");
}

function switchMode(mode) {
    if (!state.document) {
        return;
    }

    if (state.mode === "xml" && mode === "editor") {
        try {
            state.document = parseXml(state.rawXmlText, state.schema);
        } catch (error) {
            setStatus(`Raw XML error: ${error.message}`);
            return;
        }
    }

    if (mode === "xml") {
        state.rawXmlText = serializeDocument();
    }

    state.mode = mode;
    render();
}

function render() {
    renderHeader();
    renderProjectControls();
    renderComponentList();
    renderEditor();
    renderPreviewAndIssues();
}

function renderHeader() {
    const component = findComponent(state.selectedPath);
    elements.documentName.textContent = component?.fileName || "No autogen XML selected";
    elements.deleteComponentButton.disabled = !component;
    elements.deleteListButton.disabled = !component;
    elements.saveButton.disabled = !component;
    elements.copyXmlButton.disabled = !state.document;
    elements.editorTabButton.disabled = !state.document;
    elements.xmlTabButton.disabled = !state.document;
    const canAddAutoComponent = Boolean(state.project && state.selectedCmakePath);
    elements.newComponentButton.disabled = !canAddAutoComponent;
    elements.addListButton.disabled = !canAddAutoComponent;
}

function renderProjectControls() {
    clear(elements.cmakeTargetSelect);

    const cmakeFiles = state.project?.cmakeFiles || [];
    if (cmakeFiles.length === 0) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "No CMake target";
        elements.cmakeTargetSelect.appendChild(option);
        return;
    }

    const allOption = document.createElement("option");
    allOption.value = "";
    allOption.textContent = `All CMake files (${state.project?.components?.length || 0})`;
    elements.cmakeTargetSelect.appendChild(allOption);

    for (const cmakeFile of cmakeFiles) {
        const option = document.createElement("option");
        option.value = cmakeFile.path;
        option.textContent = `${cmakeFile.relativePath} (${cmakeFile.count})`;
        elements.cmakeTargetSelect.appendChild(option);
    }

    elements.cmakeTargetSelect.value = state.selectedCmakePath || "";
}

function renderComponentList() {
    clear(elements.componentList);

    const components = filteredComponents();
    if (!state.project) {
        const empty = document.createElement("div");
        empty.className = "list-empty";
        empty.textContent = "Open a project folder";
        elements.componentList.appendChild(empty);
        return;
    }

    if (components.length === 0) {
        const empty = document.createElement("div");
        empty.className = "list-empty";
        empty.textContent = state.project.components.length === 0
            ? `No autogen XML found. Scanned ${state.project.stats?.cmakeFileCount || 0} CMake files and ${state.project.stats?.autoComponentJinjaCount || 0} autogen Jinja templates.`
            : state.selectedCmakePath
                ? "No autogen XML is associated with this CMake file"
            : "No matching autogen XML";
        elements.componentList.appendChild(empty);
        return;
    }

    for (const component of components) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `component-row${component.path === state.selectedPath ? " active" : ""}${!component.exists || !component.referenced ? " warning" : ""}`;
        button.addEventListener("click", () => selectComponent(component.path));

        const title = document.createElement("span");
        title.className = "component-title";
        title.textContent = component.name || component.fileName;

        const meta = document.createElement("span");
        meta.className = "component-meta";
        meta.textContent = `${kindLabel(component.kind)}${component.namespace ? ` - ${component.namespace}` : ""}`;

        const pathText = document.createElement("span");
        pathText.className = "component-path";
        pathText.textContent = component.referenced ? component.relativePath : `${component.relativePath} - not in CMake`;

        button.append(title, meta, pathText);
        elements.componentList.appendChild(button);
    }
}

function kindLabel(kind) {
    const labels = {
        autocomponent: "AutoComponent",
        "scriptcanvas-nodeable": "ScriptCanvas Nodeable",
        "scriptcanvas-function": "ScriptCanvas Function",
        "scriptcanvas-grammar": "ScriptCanvas Grammar",
        autopackets: "AutoPackets"
    };
    return labels[kind] || "Autogen XML";
}

function scanSummary(project, prefix) {
    if (!project?.stats) {
        return prefix;
    }

    const errors = project.scanErrors?.length || 0;
    const suffix = `${project.stats.autoComponentXmlCount} AutoComponent XML, ${project.stats.scriptCanvasXmlCount || 0} ScriptCanvas XML, ${project.stats.autoPacketsXmlCount || 0} AutoPackets XML, ${project.stats.cmakeFileCount} CMake, ${project.stats.autoComponentJinjaCount} autogen Jinja${errors ? `, ${errors} scan skips/errors` : ""}`;
    return `${prefix} (${suffix})`;
}

function filteredComponents() {
    let components = state.project?.components || [];
    if (state.selectedCmakePath) {
        components = components.filter((component) =>
            component.references?.some((reference) => reference.cmakePath === state.selectedCmakePath));
    }

    if (!state.filterText) {
        return components;
    }

    return components.filter((component) => {
        const haystack = `${component.name} ${component.namespace} ${component.relativePath}`.toLowerCase();
        return haystack.includes(state.filterText);
    });
}

function renderEditor() {
    clear(elements.editorPanel);

    const hasDocument = Boolean(state.document && state.schema);
    elements.issuesBar.hidden = !hasDocument;
    elements.emptyPanel.hidden = hasDocument;
    elements.editorPanel.hidden = !hasDocument || state.mode !== "editor";
    elements.rawXmlPanel.hidden = !hasDocument || state.mode !== "xml";
    elements.editorTabButton.classList.toggle("active", state.mode === "editor");
    elements.xmlTabButton.classList.toggle("active", state.mode === "xml");

    if (!hasDocument) {
        return;
    }

    if (state.mode === "xml") {
        elements.rawXmlEditor.value = state.rawXmlText || serializeDocument();
        return;
    }

    elements.editorPanel.appendChild(renderRootSection(state.schema, state.document));

    for (const childSchema of state.schema.children) {
        elements.editorPanel.appendChild(renderCollectionSection(childSchema, state.document.children[childSchema.name]));
    }
}

function renderRootSection(schemaElement, data) {
    if (schemaElement.name === "ScriptCanvas") {
        return renderScriptCanvasRootSection(schemaElement, data);
    }
    if (schemaElement.name === "PacketGroup") {
        return renderAutoPacketsRootSection(schemaElement, data);
    }
    return renderComponentSection(schemaElement, data);
}

function schemaForComponent(component) {
    if (component?.kind?.startsWith("scriptcanvas")) {
        return state.schemas.scriptcanvas || state.schema;
    }
    if (component?.kind === "autopackets") {
        return state.schemas.autopackets || state.schema;
    }

    return state.schemas.autocomponent || state.schema;
}

function renderNodeSection(schemaElement, data, title, allowRemove, onRemove) {
    const section = document.createElement("section");
    section.className = "form-section";

    const header = document.createElement("div");
    header.className = "section-header";
    header.innerHTML = `<div><h2>${title}</h2><p class="section-meta">${schemaElement.attributes.length} fields</p></div>`;

    if (allowRemove) {
        const removeButton = document.createElement("button");
        removeButton.className = "danger-button";
        removeButton.type = "button";
        removeButton.textContent = "Remove";
        removeButton.addEventListener("click", onRemove);
        header.appendChild(removeButton);
    }

    section.appendChild(header);
    section.appendChild(renderFields(schemaElement, data));
    return section;
}

function renderCollectionSection(schemaElement, collection) {
    const section = document.createElement("section");
    section.className = "form-section";

    const header = document.createElement("div");
    header.className = "section-header";
    header.innerHTML = `<div><h2>${schemaElement.name}</h2><p class="section-meta">${collection.length} items</p></div>`;
    applyElementHelp(header, schemaElement.name);

    const addButton = document.createElement("button");
    addButton.className = "action-button";
    addButton.type = "button";
    addButton.textContent = `Add ${schemaElement.name}`;
    addButton.addEventListener("click", () => {
        collection.push(createNodeData(schemaElement));
        render();
    });
    header.appendChild(addButton);
    section.appendChild(header);

    const list = document.createElement("div");
    list.className = "item-list";

    if (collection.length === 0) {
        const empty = document.createElement("div");
        empty.className = "empty-state";
        empty.textContent = `No ${schemaElement.name} items`;
        list.appendChild(empty);
    }

    collection.forEach((item, index) => {
        list.appendChild(renderCollectionItem(schemaElement, item, index, () => {
            collection.splice(index, 1);
            render();
        }));
    });

    section.appendChild(list);
    return section;
}

function renderCollectionItem(schemaElement, item, index, onRemove) {
    switch (schemaElement.name) {
        case "Include":
            return renderIncludeItem(schemaElement, item, index, onRemove);
        case "ComponentRelation":
            return renderComponentRelationItem(schemaElement, item, index, onRemove);
        case "ArchetypeProperty":
            return renderArchetypePropertyItem(schemaElement, item, index, onRemove);
        case "NetworkProperty":
            return renderNetworkPropertyItem(schemaElement, item, index, onRemove);
        case "NetworkInput":
            return renderNetworkInputItem(schemaElement, item, index, onRemove);
        case "RemoteProcedure":
            return renderRemoteProcedureItem(schemaElement, item, index, onRemove);
        case "Class":
            return renderScriptCanvasClassItem(schemaElement, item, index, onRemove);
        case "Library":
            return renderScriptCanvasLibraryItem(schemaElement, item, index, onRemove);
        case "Input":
        case "Output":
        case "In":
        case "Out":
        case "OutLatent":
        case "Branch":
            return renderScriptCanvasSlotGroupItem(schemaElement, item, index, onRemove);
        case "Property":
            return renderScriptCanvasPropertyItem(schemaElement, item, index, onRemove);
        case "SerializedProperty":
            return renderSerializedPropertyItem(schemaElement, item, index, onRemove);
        case "PropertyInterface":
            return renderScriptCanvasPropertyInterfaceItem(schemaElement, item, index, onRemove);
        case "PropertyData":
            return renderScriptCanvasPropertyDataItem(schemaElement, item, index, onRemove);
        case "EditProperty":
            return renderScriptCanvasEditPropertyItem(schemaElement, item, index, onRemove);
        case "EditAttribute":
            return renderScriptCanvasEditAttributeItem(schemaElement, item, index, onRemove);
        case "Function":
            return renderScriptCanvasFunctionItem(schemaElement, item, index, onRemove);
        case "Packet":
            return renderAutoPacketsPacketItem(schemaElement, item, index, onRemove);
        case "Member":
            return renderAutoPacketsMemberItem(schemaElement, item, index, onRemove);
        case "Param":
            return renderParamItem(schemaElement, item, index, onRemove);
        case "Parameter":
        case "Return":
            return renderScriptCanvasParameterItem(schemaElement, item, index, onRemove);
        default:
            break;
    }

    const article = document.createElement("article");
    article.className = "schema-item";

    const header = document.createElement("div");
    header.className = "item-header";

    const title = document.createElement("h3");
    title.className = "item-title";
    title.textContent = item.attributes.Name || item.attributes.File || `${schemaElement.name} ${index + 1}`;

    const removeButton = document.createElement("button");
    removeButton.className = "danger-button";
    removeButton.type = "button";
    removeButton.textContent = "Remove";
    removeButton.addEventListener("click", onRemove);

    header.append(title, removeButton);
    article.appendChild(header);
    article.appendChild(renderFields(schemaElement, item));

    for (const childSchema of schemaElement.children) {
        article.appendChild(renderNestedCollection(childSchema, item.children[childSchema.name]));
    }

    return article;
}

function renderNestedCollection(schemaElement, collection) {
    const wrapper = document.createElement("div");
    wrapper.className = "nested-section";

    const header = document.createElement("div");
    header.className = "nested-header";
    header.innerHTML = `<h3>${schemaElement.name}</h3>`;
    applyElementHelp(header, schemaElement.name);

    const addButton = document.createElement("button");
    addButton.className = "action-button";
    addButton.type = "button";
    addButton.textContent = `Add ${schemaElement.name}`;
    addButton.addEventListener("click", () => {
        collection.push(createNodeData(schemaElement));
        render();
    });

    header.appendChild(addButton);
    wrapper.appendChild(header);

    if (collection.length === 0) {
        const empty = document.createElement("div");
        empty.className = "empty-state";
        empty.textContent = `No ${schemaElement.name} items`;
        wrapper.appendChild(empty);
        return wrapper;
    }

    const list = document.createElement("div");
    list.className = "item-list";
    collection.forEach((item, index) => {
        list.appendChild(renderCollectionItem(schemaElement, item, index, () => {
            collection.splice(index, 1);
            render();
        }));
    });
    wrapper.appendChild(list);
    return wrapper;
}

function renderFields(schemaElement, data) {
    const grid = document.createElement("div");
    grid.className = "field-grid";

    for (const attribute of schemaElement.attributes) {
        grid.appendChild(renderAttributeField(attribute, data, schemaElement.name));
    }

    return grid;
}

function renderComponentSection(schemaElement, data) {
    const section = document.createElement("section");
    section.className = "form-section component-section";

    const header = document.createElement("div");
    header.className = "section-header";
    header.innerHTML = "<div><h2>Component</h2><p class=\"section-meta\">Identity and override settings</p></div>";
    applyElementHelp(header, schemaElement.name);
    section.appendChild(header);

    const body = document.createElement("div");
    body.className = "component-editor";
    appendNamedField(body, schemaElement, data, "Name", "component-name-field");
    appendNamedField(body, schemaElement, data, "Namespace", "component-namespace-field");
    appendNamedField(body, schemaElement, data, "OverrideInclude", "component-include-field");

    const flags = createFlagGroup("Overrides", "component-flags", "Choose which top-level generated pieces are replaced by hand-written code.");
    for (const flagName of ["OverrideComponent", "OverrideController"]) {
        const attribute = findAttribute(schemaElement, flagName);
        if (attribute) {
            flags.appendChild(renderCompactBoolean(attribute, data, schemaElement.name));
        }
    }
    body.appendChild(flags);
    section.appendChild(body);
    return section;
}

function renderScriptCanvasRootSection(schemaElement, data) {
    const section = document.createElement("section");
    section.className = "form-section component-section";

    const header = document.createElement("div");
    header.className = "section-header";
    header.innerHTML = "<div><h2>ScriptCanvas</h2><p class=\"section-meta\">Autogen source file</p></div>";
    applyElementHelp(header, schemaElement.name);
    section.appendChild(header);

    const body = document.createElement("div");
    body.className = "scriptcanvas-root-editor";
    appendNamedField(body, schemaElement, data, "Include", "file-field");
    section.appendChild(body);
    return section;
}

function renderAutoPacketsRootSection(schemaElement, data) {
    const section = document.createElement("section");
    section.className = "form-section component-section";

    const header = document.createElement("div");
    header.className = "section-header";
    header.innerHTML = "<div><h2>Packet Group</h2><p class=\"section-meta\">Packet id range and group identity</p></div>";
    applyElementHelp(header, schemaElement.name);
    section.appendChild(header);

    const body = document.createElement("div");
    body.className = "autopackets-root-editor";
    appendNamedField(body, schemaElement, data, "Name", "name-field");
    appendNamedField(body, schemaElement, data, "PacketStart", "packet-start-field");
    section.appendChild(body);
    return section;
}

function renderIncludeItem(schemaElement, item, index, onRemove) {
    const article = createCompactArticle("include-item");
    article.appendChild(renderCompactTitle(item.attributes.File || `Include ${index + 1}`, onRemove));

    const row = document.createElement("div");
    row.className = "include-row";
    appendNamedField(row, schemaElement, item, "File", "file-field");
    article.appendChild(row);
    return article;
}

function renderComponentRelationItem(schemaElement, item, index, onRemove) {
    const article = createCompactArticle("relation-item");
    article.appendChild(renderCompactTitle(item.attributes.Name || `ComponentRelation ${index + 1}`, onRemove));

    const primary = document.createElement("div");
    primary.className = "relation-primary";
    appendNamedField(primary, schemaElement, item, "Name", "name-field");
    appendNamedField(primary, schemaElement, item, "Namespace", "namespace-field");
    appendNamedField(primary, schemaElement, item, "Constraint", "constraint-field");

    const hasController = findAttribute(schemaElement, "HasController");
    if (hasController) {
        const flags = createFlagGroup("Related", "inline-flags", "Options describing the related component.");
        flags.appendChild(renderCompactBoolean(hasController, item, schemaElement.name));
        primary.appendChild(flags);
    }

    article.appendChild(primary);

    const details = document.createElement("div");
    details.className = "single-detail-row";
    appendNamedField(details, schemaElement, item, "Include", "file-field");
    article.appendChild(details);
    return article;
}

function renderArchetypePropertyItem(schemaElement, item, index, onRemove) {
    return renderAutoComponentPropertyItem(schemaElement, item, index, onRemove, {
        fallbackTitle: "ArchetypeProperty",
        className: "archetype-property-item",
        flags: ["IsPublic", "ExposeToEditor", "ExposeToScript"],
        flagsHelp: "Generated API and reflection exposure for this property."
    });
}

function renderNetworkPropertyItem(schemaElement, item, index, onRemove) {
    return renderAutoComponentPropertyItem(schemaElement, item, index, onRemove, {
        fallbackTitle: "NetworkProperty",
        className: "network-property-item",
        includeReplication: true,
        flags: ["IsRewindable", "IsPredictable", "IsPublic", "ExposeToEditor", "ExposeToScript", "GenerateEventBindings"],
        flagsHelp: "Prediction, rewind, public API, reflection, and event binding behavior for this replicated value."
    });
}

function renderAutoComponentPropertyItem(schemaElement, item, index, onRemove, options) {
    const article = createCompactArticle(`autocomponent-property-item ${options.className}`);
    article.appendChild(renderCompactTitle(item.attributes.Name || `${options.fallbackTitle} ${index + 1}`, onRemove));

    const primary = document.createElement("div");
    primary.className = "autocomponent-property-primary";
    appendNamedField(primary, schemaElement, item, "Name", "name-field");
    appendNamedField(primary, schemaElement, item, "Type", "type-field");
    appendNamedField(primary, schemaElement, item, "Init", "init-field");
    primary.appendChild(renderStorageGroup(schemaElement, item));

    if (options.includeReplication) {
        primary.appendChild(renderReplicationGroup(schemaElement, item));
    }
    article.appendChild(primary);

    const flags = createFlagGroup("Flags", "", options.flagsHelp);
    for (const flagName of options.flags) {
        const attribute = findAttribute(schemaElement, flagName);
        if (attribute) {
            flags.appendChild(renderCompactBoolean(attribute, item, schemaElement.name));
        }
    }
    article.appendChild(flags);

    const handled = new Set(["Name", "Type", "Init", "Container", "Count", ...options.flags]);
    if (options.includeReplication) {
        handled.add("ReplicateFrom");
        handled.add("ReplicateTo");
    }
    article.appendChild(renderDetails(schemaElement, item, handled));
    return article;
}

function renderStorageGroup(schemaElement, item) {
    const group = createPropertyGroup("Storage", "storage-group", "Generated storage shape and count for Array or Vector containers.");
    group.classList.toggle("has-count", usesCount(item));
    appendNamedField(group, schemaElement, item, "Container", "container-field");
    appendContainerCountField(group, schemaElement, item);
    return group;
}

function renderReplicationGroup(schemaElement, item) {
    const group = createPropertyGroup("Replication", "replicate-group", "Network role that sends this property and the role that receives it.", true);
    appendNamedField(group, schemaElement, item, "ReplicateFrom", "endpoint-field", "From", { suppressRequired: true });
    appendNamedField(group, schemaElement, item, "ReplicateTo", "endpoint-field", "To", { suppressRequired: true });
    return group;
}

function renderNetworkInputItem(schemaElement, item, index, onRemove) {
    const article = createCompactArticle("network-input-item");
    article.appendChild(renderCompactTitle(item.attributes.Name || `NetworkInput ${index + 1}`, onRemove));

    const primary = document.createElement("div");
    primary.className = "network-input-primary";
    appendNamedField(primary, schemaElement, item, "Name", "name-field");
    appendNamedField(primary, schemaElement, item, "Type", "type-field");
    appendNamedField(primary, schemaElement, item, "Init", "init-field");

    const exposeToScript = findAttribute(schemaElement, "ExposeToScript");
    if (exposeToScript) {
        const flags = createFlagGroup("Exposure", "inline-flags", "Script exposure for this network input.");
        flags.appendChild(renderCompactBoolean(exposeToScript, item, schemaElement.name));
        primary.appendChild(flags);
    }

    article.appendChild(primary);
    return article;
}

function renderRemoteProcedureItem(schemaElement, item, index, onRemove) {
    const article = createCompactArticle("remote-procedure-item");
    article.appendChild(renderCompactTitle(item.attributes.Name || `RemoteProcedure ${index + 1}`, onRemove));

    const primary = document.createElement("div");
    primary.className = "remote-procedure-primary";
    appendNamedField(primary, schemaElement, item, "Name", "name-field");
    appendNamedField(primary, schemaElement, item, "InvokeFrom", "endpoint-field");

    const arrow = document.createElement("div");
    arrow.className = "replication-arrow";
    arrow.textContent = "to";
    primary.appendChild(arrow);

    appendNamedField(primary, schemaElement, item, "HandleOn", "endpoint-field");
    article.appendChild(primary);

    const flags = createFlagGroup("RPC Options", "", "Generated API, delivery, and event binding behavior for this remote procedure.");
    for (const flagName of ["IsPublic", "IsReliable", "GenerateEventBindings"]) {
        const attribute = findAttribute(schemaElement, flagName);
        if (attribute) {
            flags.appendChild(renderCompactBoolean(attribute, item, schemaElement.name));
        }
    }
    article.appendChild(flags);

    article.appendChild(renderDetails(schemaElement, item, new Set(["Name", "InvokeFrom", "HandleOn", "IsPublic", "IsReliable", "GenerateEventBindings"])));

    const paramSchema = schemaElement.children.find((child) => child.name === "Param");
    if (paramSchema) {
        article.appendChild(renderParamEditor(paramSchema, item.children.Param));
    }

    return article;
}

function renderParamEditor(paramSchema, collection) {
    const wrapper = document.createElement("div");
    wrapper.className = "param-editor";

    const header = document.createElement("div");
    header.className = "param-header";
    header.innerHTML = `<h3>Params</h3><span>${collection.length}</span>`;

    const addButton = document.createElement("button");
    addButton.className = "action-button";
    addButton.type = "button";
    addButton.textContent = "Add Param";
    addButton.addEventListener("click", () => {
        collection.push(createNodeData(paramSchema));
        render();
    });
    header.appendChild(addButton);
    wrapper.appendChild(header);

    const list = document.createElement("div");
    list.className = "param-list";
    if (collection.length === 0) {
        const empty = document.createElement("div");
        empty.className = "empty-state compact-empty";
        empty.textContent = "No params";
        list.appendChild(empty);
    }

    collection.forEach((param, index) => {
        list.appendChild(renderParamItem(paramSchema, param, index, () => {
            collection.splice(index, 1);
            render();
        }));
    });
    wrapper.appendChild(list);
    return wrapper;
}

function renderParamItem(schemaElement, item, index, onRemove) {
    const article = createCompactArticle("param-item");
    const row = document.createElement("div");
    row.className = "param-row";
    appendNamedField(row, schemaElement, item, "Type", "type-field");
    appendNamedField(row, schemaElement, item, "Name", "name-field");

    const removeButton = document.createElement("button");
    removeButton.className = "danger-button";
    removeButton.type = "button";
    removeButton.textContent = "Remove";
    removeButton.addEventListener("click", onRemove);
    row.appendChild(removeButton);

    article.appendChild(row);
    return article;
}

function renderScriptCanvasClassItem(schemaElement, item, index, onRemove) {
    const article = createCompactArticle("scriptcanvas-class-item");
    article.appendChild(renderCompactTitle(item.attributes.PreferredClassName || item.attributes.Name || `Class ${index + 1}`, onRemove));

    const primary = document.createElement("div");
    primary.className = "scriptcanvas-class-primary";
    appendNamedField(primary, schemaElement, item, "Name", "name-field");
    appendNamedField(primary, schemaElement, item, "PreferredClassName", "preferred-name-field");
    appendNamedField(primary, schemaElement, item, "QualifiedName", "qualified-name-field");
    appendNamedField(primary, schemaElement, item, "Category", "category-field");
    article.appendChild(primary);

    const flags = createFlagGroup("Generation", "", "Generated class behavior and extension hooks.");
    for (const flagName of ["BaseClass", "GraphEntryPoint", "DynamicSlotOrdering", "ExtendReflectionSerialize", "ExtendReflectionEdit", "ExtendReflectionBehavior", "ExtendConfigureSlots", "HideProperty", "Deprecated"]) {
        const attribute = findAttribute(schemaElement, flagName);
        if (attribute) {
            flags.appendChild(renderCompactBoolean(attribute, item, schemaElement.name));
        }
    }
    article.appendChild(flags);

    article.appendChild(renderDetails(schemaElement, item, new Set([
        "Name",
        "PreferredClassName",
        "QualifiedName",
        "Category",
        "BaseClass",
        "GraphEntryPoint",
        "DynamicSlotOrdering",
        "ExtendReflectionSerialize",
        "ExtendReflectionEdit",
        "ExtendReflectionBehavior",
        "ExtendConfigureSlots",
        "HideProperty",
        "Deprecated"
    ])));

    for (const childSchema of schemaElement.children) {
        article.appendChild(renderNestedCollection(childSchema, item.children[childSchema.name]));
    }

    return article;
}

function renderScriptCanvasLibraryItem(schemaElement, item, index, onRemove) {
    const article = createCompactArticle("scriptcanvas-library-item");
    article.appendChild(renderCompactTitle(item.attributes.Namespace || `Library ${index + 1}`, onRemove));

    const primary = document.createElement("div");
    primary.className = "scriptcanvas-library-primary";
    appendNamedField(primary, schemaElement, item, "Include", "file-field");
    appendNamedField(primary, schemaElement, item, "Namespace", "namespace-field");
    appendNamedField(primary, schemaElement, item, "Category", "category-field");
    article.appendChild(primary);

    for (const childSchema of schemaElement.children) {
        article.appendChild(renderNestedCollection(childSchema, item.children[childSchema.name]));
    }

    return article;
}

function renderScriptCanvasSlotGroupItem(schemaElement, item, index, onRemove) {
    const article = createCompactArticle("scriptcanvas-slot-group-item");
    article.appendChild(renderCompactTitle(item.attributes.Name || `${schemaElement.name} ${index + 1}`, onRemove));

    const primary = document.createElement("div");
    primary.className = "scriptcanvas-slot-primary";
    appendNamedField(primary, schemaElement, item, "Name", "name-field");
    appendNamedField(primary, schemaElement, item, "Type", "type-field");
    appendNamedField(primary, schemaElement, item, "DisplayGroup", "display-group-field");
    appendNamedField(primary, schemaElement, item, "OutputName", "output-name-field");
    article.appendChild(primary);

    article.appendChild(renderDetails(schemaElement, item, new Set(["Name", "Type", "DisplayGroup", "OutputName"])));

    for (const childSchema of schemaElement.children) {
        article.appendChild(renderNestedCollection(childSchema, item.children[childSchema.name]));
    }

    return article;
}

function renderScriptCanvasPropertyItem(schemaElement, item, index, onRemove) {
    const article = createCompactArticle("scriptcanvas-property-item");
    article.appendChild(renderCompactTitle(item.attributes.Name || `Property ${index + 1}`, onRemove));

    const primary = document.createElement("div");
    primary.className = "scriptcanvas-property-primary";
    appendNamedField(primary, schemaElement, item, "Name", "name-field");
    appendNamedField(primary, schemaElement, item, "Type", "type-field");
    appendNamedField(primary, schemaElement, item, "DisplayGroup", "display-group-field");
    article.appendChild(primary);

    const flags = createFlagGroup("Slots", "", "How this property appears as generated ScriptCanvas slots.");
    for (const flagName of ["IsInput", "IsOutput"]) {
        const attribute = findAttribute(schemaElement, flagName);
        if (attribute) {
            flags.appendChild(renderCompactBoolean(attribute, item, schemaElement.name));
        }
    }
    article.appendChild(flags);
    article.appendChild(renderDetails(schemaElement, item, new Set(["Name", "Type", "DisplayGroup", "IsInput", "IsOutput"])));

    for (const childSchema of schemaElement.children) {
        article.appendChild(renderNestedCollection(childSchema, item.children[childSchema.name]));
    }
    return article;
}

function renderScriptCanvasPropertyInterfaceItem(schemaElement, item, index, onRemove) {
    const article = createCompactArticle("scriptcanvas-property-interface-item");
    article.appendChild(renderCompactTitle(item.attributes.Name || `PropertyInterface ${index + 1}`, onRemove));

    const primary = document.createElement("div");
    primary.className = "scriptcanvas-property-primary";
    appendNamedField(primary, schemaElement, item, "Name", "name-field");
    appendNamedField(primary, schemaElement, item, "Property", "property-field");
    appendNamedField(primary, schemaElement, item, "Type", "type-field");
    article.appendChild(primary);
    article.appendChild(renderDetails(schemaElement, item, new Set(["Name", "Property", "Type"])));
    return article;
}

function renderSerializedPropertyItem(schemaElement, item, index, onRemove) {
    const article = createCompactArticle("serialized-property-item");
    article.appendChild(renderCompactTitle(item.attributes.Name || `SerializedProperty ${index + 1}`, onRemove));

    const row = document.createElement("div");
    row.className = "include-row";
    appendNamedField(row, schemaElement, item, "Name", "name-field");
    article.appendChild(row);
    return article;
}

function renderScriptCanvasEditPropertyItem(schemaElement, item, index, onRemove) {
    const article = createCompactArticle("scriptcanvas-edit-property-item");
    article.appendChild(renderCompactTitle(item.attributes.Name || item.attributes.FieldName || `EditProperty ${index + 1}`, onRemove));

    const primary = document.createElement("div");
    primary.className = "scriptcanvas-edit-property-primary";
    appendNamedField(primary, schemaElement, item, "Name", "name-field");
    appendNamedField(primary, schemaElement, item, "FieldName", "field-name-field");
    appendNamedField(primary, schemaElement, item, "UiHandler", "ui-handler-field");
    article.appendChild(primary);

    article.appendChild(renderDetails(schemaElement, item, new Set(["Name", "FieldName", "UiHandler"])));

    for (const childSchema of schemaElement.children) {
        article.appendChild(renderNestedCollection(childSchema, item.children[childSchema.name]));
    }

    return article;
}

function renderScriptCanvasPropertyDataItem(schemaElement, item, index, onRemove) {
    const article = createCompactArticle("scriptcanvas-property-data-item");
    article.appendChild(renderCompactTitle(item.attributes.Name || `PropertyData ${index + 1}`, onRemove));

    const primary = document.createElement("div");
    primary.className = "scriptcanvas-property-data-primary";
    appendNamedField(primary, schemaElement, item, "Name", "name-field");
    appendNamedField(primary, schemaElement, item, "UIHandler", "ui-handler-field");

    const serialize = findAttribute(schemaElement, "Serialize");
    if (serialize) {
        const flags = createFlagGroup("Reflection", "inline-flags", "Serialization and edit reflection settings for this property data.");
        flags.appendChild(renderCompactBoolean(serialize, item, schemaElement.name));
        primary.appendChild(flags);
    }

    article.appendChild(primary);
    article.appendChild(renderDetails(schemaElement, item, new Set(["Name", "UIHandler", "Serialize"])));

    for (const childSchema of schemaElement.children) {
        article.appendChild(renderNestedCollection(childSchema, item.children[childSchema.name]));
    }

    return article;
}

function renderScriptCanvasEditAttributeItem(schemaElement, item, index, onRemove) {
    const article = createCompactArticle("scriptcanvas-edit-attribute-item");
    const row = document.createElement("div");
    row.className = "scriptcanvas-edit-attribute-row";
    appendNamedField(row, schemaElement, item, "Key", "key-field");
    appendNamedField(row, schemaElement, item, "Value", "value-field");

    const removeButton = document.createElement("button");
    removeButton.className = "danger-button";
    removeButton.type = "button";
    removeButton.textContent = "Remove";
    removeButton.addEventListener("click", onRemove);
    row.appendChild(removeButton);

    article.appendChild(row);
    return article;
}

function renderScriptCanvasFunctionItem(schemaElement, item, index, onRemove) {
    const article = createCompactArticle("scriptcanvas-function-item");
    article.appendChild(renderCompactTitle(item.attributes.Name || `Function ${index + 1}`, onRemove));

    const primary = document.createElement("div");
    primary.className = "scriptcanvas-function-primary";
    appendNamedField(primary, schemaElement, item, "Name", "name-field");
    appendNamedField(primary, schemaElement, item, "Branch", "branch-field");
    appendNamedField(primary, schemaElement, item, "BranchWithValue", "branch-value-field");
    article.appendChild(primary);

    for (const childSchema of schemaElement.children) {
        article.appendChild(renderNestedCollection(childSchema, item.children[childSchema.name]));
    }

    return article;
}

function renderAutoPacketsPacketItem(schemaElement, item, index, onRemove) {
    const article = createCompactArticle("autopackets-packet-item");
    article.appendChild(renderCompactTitle(item.attributes.Name || `Packet ${index + 1}`, onRemove));

    const primary = document.createElement("div");
    primary.className = "autopackets-packet-primary";
    appendNamedField(primary, schemaElement, item, "Name", "name-field");

    const handshakePacket = findAttribute(schemaElement, "HandshakePacket");
    if (handshakePacket) {
        const flags = createFlagGroup("Dispatch", "inline-flags", "Marks the packet as part of connection handshaking.");
        flags.appendChild(renderCompactBoolean(handshakePacket, item, schemaElement.name));
        primary.appendChild(flags);
    }

    article.appendChild(primary);
    article.appendChild(renderDetails(schemaElement, item, new Set(["Name", "HandshakePacket"])));

    for (const childSchema of schemaElement.children) {
        article.appendChild(renderNestedCollection(childSchema, item.children[childSchema.name]));
    }

    return article;
}

function renderAutoPacketsMemberItem(schemaElement, item, index, onRemove) {
    const article = createCompactArticle("autopackets-member-item");

    const row = document.createElement("div");
    row.className = "autopackets-member-row";
    appendNamedField(row, schemaElement, item, "Type", "type-field");
    appendNamedField(row, schemaElement, item, "Name", "name-field");
    appendNamedField(row, schemaElement, item, "Init", "init-field");
    appendNamedField(row, schemaElement, item, "Container", "container-field");
    appendContainerCountField(row, schemaElement, item);
    appendNamedField(row, schemaElement, item, "Min", "range-field", "Min");
    appendNamedField(row, schemaElement, item, "Max", "range-field", "Max");

    const removeButton = document.createElement("button");
    removeButton.className = "danger-button";
    removeButton.type = "button";
    removeButton.textContent = "Remove";
    removeButton.addEventListener("click", onRemove);
    row.appendChild(removeButton);

    article.appendChild(row);
    article.appendChild(renderDetails(schemaElement, item, new Set(["Type", "Name", "Init", "Container", "Count", "Min", "Max"])));
    return article;
}

function renderScriptCanvasParameterItem(schemaElement, item, index, onRemove) {
    const article = createCompactArticle("scriptcanvas-parameter-item");
    const row = document.createElement("div");
    row.className = "scriptcanvas-parameter-row";
    appendNamedField(row, schemaElement, item, "Type", "type-field");
    appendNamedField(row, schemaElement, item, "Name", "name-field");
    appendNamedField(row, schemaElement, item, "DefaultValue", "default-field");

    const shared = findAttribute(schemaElement, "Shared");
    if (shared) {
        const flags = createFlagGroup("Slot", "inline-flags", "Slot behavior for this parameter or return value.");
        flags.appendChild(renderCompactBoolean(shared, item, schemaElement.name));
        row.appendChild(flags);
    }

    const removeButton = document.createElement("button");
    removeButton.className = "danger-button";
    removeButton.type = "button";
    removeButton.textContent = "Remove";
    removeButton.addEventListener("click", onRemove);
    row.appendChild(removeButton);

    article.appendChild(row);
    article.appendChild(renderDetails(schemaElement, item, new Set(["Type", "Name", "DefaultValue", "Shared"])));
    return article;
}

function createCompactArticle(className) {
    const article = document.createElement("article");
    article.className = `schema-item compact-item ${className}`;
    return article;
}

function createFlagGroup(label, className = "", help = "") {
    const group = document.createElement("fieldset");
    group.className = `compact-flag-group${className ? ` ${className}` : ""}`;

    const legend = document.createElement("legend");
    legend.textContent = label;
    if (help) {
        legend.title = help;
    }
    group.appendChild(legend);
    return group;
}

function createFieldGroup(label, className = "", help = "") {
    const group = document.createElement("fieldset");
    group.className = `compact-field-group${className ? ` ${className}` : ""}`;

    const legend = document.createElement("legend");
    legend.textContent = label;
    if (help) {
        legend.title = help;
    }
    group.appendChild(legend);
    return group;
}

function createPropertyGroup(label, className = "", help = "", required = false) {
    const group = document.createElement("div");
    group.className = `property-mini-group${className ? ` ${className}` : ""}`;

    const header = document.createElement("div");
    header.className = "property-mini-group-header";
    const labelText = document.createElement("span");
    labelText.textContent = label;
    header.appendChild(labelText);

    if (required) {
        const requiredMark = document.createElement("span");
        requiredMark.className = "required-mark";
        requiredMark.textContent = "required";
        header.appendChild(requiredMark);
    }

    if (help) {
        header.title = help;
        appendHelpBadge(header, help);
    }

    group.appendChild(header);

    const controls = document.createElement("div");
    controls.className = "property-mini-controls";
    group.appendChild(controls);
    return group;
}

function renderCompactTitle(titleText, onRemove) {
    const titleRow = document.createElement("div");
    titleRow.className = "compact-item-title";

    const title = document.createElement("h3");
    title.className = "item-title";
    title.textContent = titleText;

    const removeButton = document.createElement("button");
    removeButton.className = "danger-button";
    removeButton.type = "button";
    removeButton.textContent = "Remove";
    removeButton.addEventListener("click", onRemove);

    titleRow.append(title, removeButton);
    return titleRow;
}

function renderDetails(schemaElement, data, handled) {
    const details = document.createElement("div");
    details.className = "compact-details";
    for (const attribute of schemaElement.attributes) {
        if (!handled.has(attribute.name)) {
            details.appendChild(renderAttributeField(attribute, data, schemaElement.name));
        }
    }
    return details;
}

function appendNamedField(parent, schemaElement, data, attributeName, className, labelOverride = "", options = {}) {
    const attribute = findAttribute(schemaElement, attributeName);
    if (!attribute) {
        return;
    }

    const field = renderAttributeField(attribute, data, schemaElement.name, labelOverride, options);
    field.classList.add(className);
    const controls = parent.classList.contains("property-mini-group")
        ? parent.querySelector(":scope > .property-mini-controls")
        : null;
    (controls || parent).appendChild(field);
}

function appendContainerCountField(parent, schemaElement, data) {
    if (!usesCount(data)) {
        return;
    }
    appendNamedField(parent, schemaElement, data, "Count", "count-field");
}

function usesCount(data) {
    return data.attributes.Container === "Array" || data.attributes.Container === "Vector";
}

function findAttribute(schemaElement, attributeName) {
    return schemaElement.attributes.find((attribute) => attribute.name === attributeName);
}

const ATTRIBUTE_HELP = {
    "*.Name": "The generated symbol or display name for this entry. Keep it stable once code depends on it.",
    "*.Type": "The C++ or ScriptCanvas data type used by generated code.",
    "*.Description": "Tooltip or documentation text emitted into generated editor/runtime metadata.",
    "*.DisplayGroup": "Groups related slots or fields together in the generated node/editor UI.",
    "*.DefaultValue": "Generated default expression or literal used when the value is not supplied.",
    "*.HideName": "Hides the visible slot name in the ScriptCanvas node UI.",
    "*.Hidden": "Creates the slot but keeps it hidden in the ScriptCanvas node UI.",
    "*.HideInputField": "Prevents ScriptCanvas from showing an editable inline value field for this slot.",
    "*.Shared": "Marks this data slot as shared with related slots in the same execution path.",
    "Component.Name": "The base name used for generated component, controller, and bus classes.",
    "Component.Namespace": "C++ namespace used for generated AutoComponent types.",
    "Component.OverrideInclude": "Custom include path used when generated code should include an existing component header.",
    "Component.OverrideComponent": "Use when the component implementation is hand-written instead of fully generated.",
    "Component.OverrideController": "Use when the controller implementation is hand-written instead of fully generated.",
    "ComponentRelation.Constraint": "Controls how strongly this component depends on the related component.",
    "ComponentRelation.HasController": "Indicates the related component also has a generated controller.",
    "ComponentRelation.Include": "Header include needed to reference the related component type.",
    "Include.File": "Extra header included by generated AutoComponent code.",
    "ArchetypeProperty.Init": "C++ initializer used for the generated archetype property.",
    "NetworkProperty.Init": "C++ initializer used for the replicated property.",
    "NetworkProperty.ReplicateFrom": "Network role that owns and sends this value.",
    "NetworkProperty.ReplicateTo": "Network role that receives this value.",
    "NetworkProperty.Container": "Generated storage shape: Object is one value, Array is fixed-size, Vector is variable-size up to Count.",
    "NetworkProperty.Count": "Maximum element count for Array or Vector containers.",
    "NetworkProperty.IsRewindable": "Includes this value in rewind state for correction and reconciliation flows.",
    "NetworkProperty.IsPredictable": "Marks this value as participating in client prediction.",
    "NetworkProperty.IsPublic": "Exposes generated accessors as public API.",
    "NetworkProperty.ExposeToEditor": "Reflects this property for editor exposure.",
    "NetworkProperty.ExposeToScript": "Reflects this property for script access.",
    "NetworkProperty.GenerateEventBindings": "Generates notification/event binding hooks for value changes.",
    "NetworkInput.Init": "C++ initializer used for the generated network input field.",
    "NetworkInput.ExposeToScript": "Reflects this input for script access.",
    "ArchetypeProperty.Container": "Generated storage shape: Object is one value, Array is fixed-size, Vector is variable-size up to Count.",
    "ArchetypeProperty.Count": "Maximum element count for Array or Vector containers.",
    "RemoteProcedure.InvokeFrom": "Network role allowed to call this RPC.",
    "RemoteProcedure.HandleOn": "Network role that receives and handles this RPC.",
    "RemoteProcedure.IsReliable": "Sends the RPC reliably instead of allowing it to be dropped.",
    "RemoteProcedure.IsPublic": "Exposes generated RPC helpers as public API.",
    "RemoteProcedure.GenerateEventBindings": "Generates event binding hooks for this RPC.",
    "ScriptCanvas.Include": "Header included by the generated ScriptCanvas autogen output.",
    "Class.Name": "Internal class name used by generated ScriptCanvas code.",
    "Class.QualifiedName": "Fully qualified C++ type name for the generated or reflected nodeable class.",
    "Class.PreferredClassName": "Human-facing class name used when generated code needs a nicer symbol.",
    "Class.Uuid": "Stable AZ UUID identifying this ScriptCanvas class. Generate a new one only for a new class.",
    "Class.NodeableUuid": "Stable AZ UUID for the generated nodeable type. Generate a new one only for a new nodeable.",
    "Class.Category": "Category path used to group the node in ScriptCanvas menus.",
    "Class.Namespace": "Optional C++ namespace override for generated ScriptCanvas code.",
    "Class.Base": "C++ base class to inherit from instead of the default ScriptCanvas nodeable base.",
    "Class.BaseClass": "Marks this as a base node class intended for inheritance rather than direct use.",
    "Class.Preset": "Applies a generation preset. Compact makes small operator-style nodes with hidden slot chrome.",
    "Class.GraphEntryPoint": "Marks this node as an entry point into a graph flow.",
    "Class.DynamicSlotOrdering": "Allows generated node slots to be reordered dynamically.",
    "Class.ExtendReflectionSerialize": "Leaves a hook for custom serialize reflection code.",
    "Class.ExtendReflectionEdit": "Leaves a hook for custom editor reflection code.",
    "Class.ExtendReflectionBehavior": "Leaves a hook for custom behavior-context reflection code.",
    "Class.ExtendConfigureSlots": "Leaves a hook for custom slot configuration code.",
    "Class.HideProperty": "Hides generated reflected properties from the visible editor UI.",
    "Class.Version": "Serialization version token. This can be a number or a C++ symbol such as Version::Current.",
    "Class.VersionConverter": "C++ converter function used to migrate serialized data between versions.",
    "Class.EventHandler": "Custom event handler type used by generated ScriptCanvas event nodes.",
    "Class.EditAttributes": "Additional edit-context attributes forwarded to generated reflection.",
    "Class.Deprecated": "Marks the generated node/class as deprecated.",
    "Class.Icon": "Icon path or style token used by the generated node UI.",
    "Input.OutputName": "Overrides the generated execution output slot name for this input.",
    "Input.Branch": "Execution branch produced by this input.",
    "Branch.Name": "Name of the execution branch shown on the node.",
    "In.Contracts": "ScriptCanvas connection contracts applied to this execution input slot.",
    "Out.Contracts": "ScriptCanvas connection contracts applied to this execution output slot.",
    "OutLatent.Contracts": "ScriptCanvas connection contracts applied to this latent output slot.",
    "SerializedProperty.Name": "Name of the backing C++ field serialized for this node.",
    "EditProperty.FieldName": "Backing C++ field exposed in the editor reflection data.",
    "EditProperty.UiHandler": "O3DE edit UI handler used to draw this property, such as Default or ComboBox.",
    "EditProperty.UIHandler": "O3DE edit UI handler used to draw this property, such as Default or ComboBox.",
    "Property.IsInput": "Creates an input data slot for this property.",
    "Property.IsOutput": "Creates an output data slot for this property.",
    "PropertyInterface.Property": "Name of the backing property this interface exposes.",
    "PropertyData.Serialize": "Includes this property data in serialization reflection.",
    "PropertyData.UIHandler": "O3DE edit UI handler used to draw this property data.",
    "EditAttribute.Key": "O3DE edit attribute key forwarded to reflection.",
    "EditAttribute.Value": "Value assigned to the edit attribute key.",
    "Function.Branch": "Name or mode used to create branch output behavior for this function.",
    "Function.BranchWithValue": "Passes a value along with the generated branch result.",
    "Parameter.Name": "Name of the generated input value.",
    "Return.Name": "Name of the generated output value.",
    "PacketGroup.Name": "Generated packet group and output file prefix.",
    "PacketGroup.PacketStart": "First packet type value reserved for this group.",
    "Packet.Name": "Generated packet class and packet type enum entry.",
    "Packet.Desc": "Comment or documentation text emitted for this packet.",
    "Packet.HandshakePacket": "Allows this packet to be dispatched during connection handshaking.",
    "Member.Type": "C++ type serialized into the packet payload.",
    "Member.Name": "Generated packet member field name.",
    "Member.Init": "C++ initializer used for the generated member.",
    "Member.Desc": "Comment or documentation text emitted for this member.",
    "Member.Min": "Optional minimum bound used by packet serialization/validation.",
    "Member.Max": "Optional maximum bound used by packet serialization/validation.",
    "Param.Name": "Name of the generated RPC parameter."
};

const ELEMENT_HELP = {
    Component: "Multiplayer AutoComponent root settings for generated component/controller code.",
    ComponentRelation: "Declares another component this AutoComponent depends on or conflicts with.",
    Include: "Adds extra headers needed by generated AutoComponent code.",
    ArchetypeProperty: "Static component configuration data that is not network replicated.",
    NetworkProperty: "Replicated component state synchronized between network roles.",
    NetworkInput: "Input data sent through the multiplayer prediction/input pipeline.",
    RemoteProcedure: "Generated network function call sent from one role and handled on another.",
    Param: "Parameter passed into a generated remote procedure.",
    ScriptCanvas: "Root settings for ScriptCanvas autogen XML files.",
    PacketGroup: "AutoPackets root settings for generated AzNetworking packet classes.",
    Packet: "Generated packet class and dispatch entry.",
    Member: "Serialized field carried by a generated packet.",
    Class: "Generated or reflected ScriptCanvas nodeable/class definition.",
    Library: "ScriptCanvas function library include, namespace, and category grouping.",
    Function: "Function exposed by a ScriptCanvas function library.",
    Input: "Execution input group for a generated ScriptCanvas nodeable.",
    Output: "Execution output group for a generated ScriptCanvas nodeable.",
    In: "Grammar-style execution input slot.",
    Out: "Grammar-style execution output slot.",
    OutLatent: "Grammar-style latent execution output slot.",
    Branch: "Named execution branch emitted from an input or class-level branch point.",
    Parameter: "Input data slot or generated function parameter.",
    Return: "Output data slot or generated function return value.",
    SerializedProperty: "Backing C++ field serialized for a ScriptCanvas node.",
    EditProperty: "Editor-reflected property backed by a C++ field.",
    Property: "ScriptCanvas data property that can become input/output slots or reflection data.",
    PropertyInterface: "Interface entry exposing a named property to ScriptCanvas.",
    PropertyData: "Edit/serialization metadata for a ScriptCanvas property.",
    EditAttribute: "Low-level O3DE edit-context metadata forwarded to reflection."
};

function renderAttributeField(attribute, data, ownerName = "", labelOverride = "", options = {}) {
    const field = document.createElement("div");
    field.className = attribute.kind === "boolean" ? "checkbox-field" : `field ${attribute.kind}-field`;
    const help = helpForAttribute(ownerName, attribute.name);

    if (attribute.kind === "boolean") {
        const input = document.createElement("input");
        input.type = "checkbox";
        input.checked = isBooleanTrue(data.attributes[attribute.name]);
        input.addEventListener("change", () => {
            data.attributes[attribute.name] = input.checked ? "true" : "false";
            renderPreviewAndIssues();
        });

        const label = document.createElement("label");
        label.textContent = labelOverride || attribute.name;
        if (help) {
            label.title = help;
        }
        label.prepend(input);
        appendHelpBadge(label, help);
        field.appendChild(label);
        return field;
    }

    const label = document.createElement("label");
    const labelText = document.createElement("span");
    labelText.textContent = labelOverride || attribute.name;
    label.appendChild(labelText);
    if (attribute.required && !options.suppressRequired) {
        const required = document.createElement("span");
        required.className = "required-mark";
        required.textContent = "required";
        label.appendChild(required);
    }
    if (help) {
        label.title = help;
    }
    appendHelpBadge(label, help);

    const control = createAttributeControl(attribute);
    if (attribute.kind === "enum") {
        for (const optionValue of attribute.enums) {
            const option = document.createElement("option");
            option.value = optionValue;
            option.textContent = optionValue || "None";
            control.appendChild(option);
        }
    }
    control.value = data.attributes[attribute.name] || "";
    const syncValue = () => {
        const normalizedValue = shouldDecodeEditorValue(attribute) ? decodeXmlEntities(control.value) : control.value;
        data.attributes[attribute.name] = normalizedValue;
        if (control.value !== normalizedValue) {
            control.value = normalizedValue;
        }
        renderHeader();
        renderComponentList();
        renderPreviewAndIssues();
        if (attribute.name === "Container") {
            if (!usesCount(data)) {
                data.attributes.Count = "";
            }
            render();
        }
    };
    control.addEventListener("input", syncValue);
    control.addEventListener("change", syncValue);

    if (attribute.kind === "uuid") {
        const wrapper = document.createElement("div");
        wrapper.className = "inline-control uuid-control";
        const generateButton = document.createElement("button");
        generateButton.className = "inline-icon-button uuid-generate-button";
        generateButton.type = "button";
        generateButton.title = "Generate UUID";
        generateButton.setAttribute("aria-label", "Generate UUID");
        generateButton.textContent = "+";
        generateButton.addEventListener("click", () => {
            control.value = generateUuid();
            syncValue();
        });
        wrapper.append(control, generateButton);
        field.append(label, wrapper);
        return field;
    }

    if (isPathAttribute(attribute)) {
        const wrapper = document.createElement("div");
        wrapper.className = "inline-control path-control";

        const browseButton = document.createElement("button");
        browseButton.className = "inline-icon-button";
        browseButton.type = "button";
        browseButton.title = "Select file";
        browseButton.setAttribute("aria-label", "Select file");
        browseButton.textContent = "...";
        browseButton.addEventListener("click", async () => {
            const result = await choosePathValue(attribute, data, "choose");
            if (result?.value !== undefined) {
                control.value = result.value;
                syncValue();
            }
        });

        const createButton = document.createElement("button");
        createButton.className = "inline-icon-button";
        createButton.type = "button";
        createButton.title = "Create file";
        createButton.setAttribute("aria-label", "Create file");
        createButton.textContent = "+";
        createButton.addEventListener("click", async () => {
            const result = await choosePathValue(attribute, data, "create");
            if (result?.value !== undefined) {
                control.value = result.value;
                syncValue();
            }
        });

        wrapper.append(control, browseButton, createButton);
        field.append(label, wrapper);
        return field;
    }

    field.append(label, control);
    return field;
}

async function choosePathValue(attribute, data, mode) {
    const request = {
        currentFilePath: state.selectedPath,
        currentValue: data.attributes[attribute.name] || "",
        attributeName: attribute.name
    };
    try {
        return mode === "create"
            ? api.createPath(request)
            : api.choosePath(request);
    } catch (error) {
        setStatus(`File path ${mode === "create" ? "create" : "select"} failed: ${error.message}`);
        return null;
    }
}

function isPathAttribute(attribute) {
    return ["File", "Include", "OverrideInclude", "Icon"].includes(attribute.name);
}

function shouldDecodeEditorValue(attribute) {
    return attribute.kind !== "enum" && attribute.kind !== "boolean";
}

function createAttributeControl(attribute) {
    if (attribute.kind === "enum") {
        return document.createElement("select");
    }
    if (attribute.name === "Description" || attribute.name === "Desc") {
        return document.createElement("textarea");
    }

    const input = document.createElement("input");
    if (attribute.kind === "integer" || attribute.kind === "number") {
        input.type = "number";
        input.step = attribute.kind === "integer" ? "1" : "any";
    } else {
        input.type = "text";
    }
    if (attribute.name === "Type") {
        input.setAttribute("list", "standardTypeSuggestions");
        input.autocomplete = "off";
    }
    return input;
}

function ensureTypeSuggestionList() {
    if (document.getElementById("standardTypeSuggestions")) {
        return;
    }

    const datalist = document.createElement("datalist");
    datalist.id = "standardTypeSuggestions";
    for (const typeName of STANDARD_TYPE_SUGGESTIONS) {
        const option = document.createElement("option");
        option.value = typeName;
        datalist.appendChild(option);
    }
    document.body.appendChild(datalist);
}

function renderCompactBoolean(attribute, data, ownerName = "") {
    const label = document.createElement("label");
    label.className = "toggle-chip";
    label.title = helpForAttribute(ownerName, attribute.name) || attribute.name;

    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = isBooleanTrue(data.attributes[attribute.name]);
    input.addEventListener("change", () => {
        data.attributes[attribute.name] = input.checked ? "true" : "false";
        renderPreviewAndIssues();
    });

    const text = document.createElement("span");
    text.textContent = compactFlagLabel(attribute.name);

    label.append(input, text);
    return label;
}

function appendHelpBadge(parent, help) {
    if (!help) {
        return;
    }
    const badge = document.createElement("span");
    badge.className = "field-help";
    badge.textContent = "?";
    badge.title = help;
    badge.setAttribute("aria-label", help);
    parent.appendChild(badge);
}

function helpForAttribute(ownerName, attributeName) {
    return ATTRIBUTE_HELP[`${ownerName}.${attributeName}`] || ATTRIBUTE_HELP[`*.${attributeName}`] || "";
}

function applyElementHelp(container, elementName) {
    const help = ELEMENT_HELP[elementName];
    if (!help) {
        return;
    }
    const heading = container.querySelector("h2, h3");
    if (!heading) {
        return;
    }
    heading.title = help;
    appendHelpBadge(heading, help);
}

function compactFlagLabel(attributeName) {
    const labels = {
        HasController: "Controller",
        OverrideComponent: "Component",
        OverrideController: "Controller",
        BaseClass: "Base Class",
        GraphEntryPoint: "Entry",
        DynamicSlotOrdering: "Dynamic",
        ExtendReflectionSerialize: "Serialize",
        ExtendReflectionEdit: "Edit",
        ExtendReflectionBehavior: "Behavior",
        ExtendConfigureSlots: "Slots",
        HideProperty: "Hide",
        Deprecated: "Deprecated",
        IsInput: "Input",
        IsOutput: "Output",
        Shared: "Shared",
        BranchWithValue: "Value",
        Serialize: "Serialize",
        IsReliable: "Reliable",
        IsRewindable: "Rewind",
        IsPredictable: "Predict",
        IsPublic: "Public",
        ExposeToEditor: "Editor",
        ExposeToScript: "Script",
        GenerateEventBindings: "Events"
    };
    return labels[attributeName] || attributeName;
}

function isBooleanTrue(value) {
    return String(value).toLowerCase() === "true";
}

function renderPreviewAndIssues() {
    if (!state.document || !state.schema) {
        elements.issueCount.textContent = "0";
        clear(elements.issues);
        return;
    }

    if (state.mode === "editor") {
        state.rawXmlText = serializeDocument();
    }

    const issues = validateNode(state.schema, state.document, state.schema.name);
    const component = findComponent(state.selectedPath);
    if (component && !component.referenced) {
        issues.push({ type: "warning", message: "This autogen XML file exists on disk but is not referenced by a CMake file." });
    }
    for (const note of state.unknownXmlNotes) {
        issues.push({ type: "warning", message: note });
    }
    if (issues.length === 0) {
        issues.push({ type: "ok", message: "No issues found." });
    }

    elements.issueCount.textContent = String(issues.filter((issue) => issue.type !== "ok").length);
    clear(elements.issues);
    for (const issue of issues) {
        const row = document.createElement("div");
        row.className = `issue ${issue.type === "error" ? "error" : issue.type === "ok" ? "ok" : ""}`;
        row.textContent = issue.message;
        elements.issues.appendChild(row);
    }
}

function findComponent(filePath) {
    if (!filePath) {
        return null;
    }
    return state.project?.components.find((component) => component.path === filePath) || null;
}

function parseSchema(schemaText) {
    const xml = parseXmlText(schemaText, "XSD");
    const simpleTypes = new Map();
    const complexTypes = new Map();

    for (const node of childrenByName(xml.documentElement, "simpleType")) {
        simpleTypes.set(node.getAttribute("name"), parseSimpleType(node, simpleTypes));
    }

    for (const node of childrenByName(xml.documentElement, "complexType")) {
        complexTypes.set(node.getAttribute("name"), node);
    }

    const rootElement = childrenByName(xml.documentElement, "element")[0];
    if (!rootElement) {
        throw new Error("No root xs:element found.");
    }

    return parseSchemaElement(rootElement, simpleTypes, complexTypes);
}

function parseSchemaElement(elementNode, simpleTypes, complexTypes) {
    const typeName = stripPrefix(elementNode.getAttribute("type") || "");
    const complexType = childByName(elementNode, "complexType") || complexTypes.get(typeName);
    const parsed = {
        name: elementNode.getAttribute("name") || typeName,
        minOccurs: elementNode.getAttribute("minOccurs") || "1",
        maxOccurs: elementNode.getAttribute("maxOccurs") || "1",
        attributes: [],
        children: []
    };

    if (!complexType) {
        return parsed;
    }

    parsed.attributes = childrenByName(complexType, "attribute").map((attributeNode) => {
        const inlineSimpleType = childByName(attributeNode, "simpleType");
        const namedType = stripPrefix(attributeNode.getAttribute("type") || "xs:string");
        const simpleType = inlineSimpleType
            ? parseSimpleType(inlineSimpleType, simpleTypes)
            : resolveSimpleType(namedType, simpleTypes);

        return {
            name: attributeNode.getAttribute("name"),
            type: namedType,
            required: attributeNode.getAttribute("use") === "required",
            defaultValue: attributeNode.getAttribute("default") || "",
            enums: simpleType.enums,
            kind: inferKind(namedType, simpleType.enums, attributeNode.getAttribute("name") || "")
        };
    });

    const compositor = childByAnyName(complexType, ["sequence", "choice", "all"]);
    if (compositor) {
        parsed.children = childrenByName(compositor, "element")
            .map((childElement) => parseSchemaElement(childElement, simpleTypes, complexTypes));
    }

    return parsed;
}

function parseSimpleType(simpleTypeNode, simpleTypes) {
    const restriction = childByName(simpleTypeNode, "restriction");
    if (!restriction) {
        return { enums: [], base: "string" };
    }

    const base = stripPrefix(restriction.getAttribute("base") || "xs:string");
    const parent = simpleTypes.get(base);
    const enums = childrenByName(restriction, "enumeration")
        .map((node) => node.getAttribute("value"))
        .filter((value) => value !== null);

    return {
        base,
        enums: enums.length > 0 ? enums : parent?.enums || []
    };
}

function resolveSimpleType(typeName, simpleTypes) {
    return simpleTypes.get(typeName) || { enums: [], base: typeName };
}

function inferKind(typeName, enums, attributeName = "") {
    const normalized = typeName.toLowerCase();
    const normalizedEnums = enums.map((value) => value.toLowerCase());
    if (normalizedEnums.includes("true") && normalizedEnums.includes("false")) {
        return "boolean";
    }
    if (normalized === "boolean" || normalized === "xs:boolean" || normalized.includes("boolean")) {
        return "boolean";
    }
    if (enums.length > 0) {
        return "enum";
    }
    if (normalized.includes("uuid") || normalized.includes("guid") || /(^|_)(uuid|guid)$/i.test(attributeName) || /(uuid|guid)$/i.test(attributeName)) {
        return "uuid";
    }
    if (["byte", "short", "int", "integer", "long", "unsignedbyte", "unsignedshort", "unsignedint", "unsignedlong", "nonnegativeinteger", "positiveinteger", "nonpositiveinteger", "negativeinteger"].includes(normalized)) {
        return "integer";
    }
    if (["decimal", "double", "float"].includes(normalized)) {
        return "number";
    }
    return "text";
}

function generateUuid() {
    const cryptoApi = globalThis.crypto;
    const value = cryptoApi?.randomUUID
        ? cryptoApi.randomUUID()
        : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (character) =>
            (Number(character) ^ (randomByte() & (15 >> (Number(character) / 4)))).toString(16));
    return `{${value.toUpperCase()}}`;
}

function randomByte() {
    if (globalThis.crypto?.getRandomValues) {
        return globalThis.crypto.getRandomValues(new Uint8Array(1))[0];
    }
    return Math.floor(Math.random() * 256);
}

function createNodeData(schemaElement) {
    const data = {
        name: schemaElement.name,
        attributes: {},
        extraAttributes: {},
        children: {}
    };

    for (const attribute of schemaElement.attributes) {
        if (attribute.kind === "boolean") {
            data.attributes[attribute.name] = attribute.defaultValue || "false";
        } else if (attribute.kind === "enum") {
            data.attributes[attribute.name] = attribute.defaultValue || attribute.enums[0] || "";
        } else {
            data.attributes[attribute.name] = attribute.defaultValue || "";
        }
    }

    for (const child of schemaElement.children) {
        data.children[child.name] = [];
    }

    return data;
}

function parseXml(xmlText, schemaElement) {
    const xml = parseXmlText(xmlText, "XML");
    const root = xml.documentElement;

    if (root.nodeName !== schemaElement.name) {
        throw new Error(`Expected root <${schemaElement.name}> but found <${root.nodeName}>.`);
    }

    state.unknownXmlNotes = [];
    return parseXmlElement(root, schemaElement, schemaElement.name);
}

function parseXmlElement(xmlElement, schemaElement, path) {
    const data = createNodeData(schemaElement);
    const knownAttributes = new Set(schemaElement.attributes.map((attribute) => attribute.name));

    for (const attribute of schemaElement.attributes) {
        if (xmlElement.hasAttribute(attribute.name)) {
            data.attributes[attribute.name] = decodeXmlEntities(xmlElement.getAttribute(attribute.name));
        }
    }

    for (const attribute of Array.from(xmlElement.attributes)) {
        if (!knownAttributes.has(attribute.name) && shouldPreserveExtraAttribute(attribute.name)) {
            data.extraAttributes[attribute.name] = decodeXmlEntities(attribute.value);
            continue;
        }

        if (!knownAttributes.has(attribute.name) && !attribute.name.startsWith("xmlns")) {
            state.unknownXmlNotes.push(`${path}: unknown attribute "${attribute.name}" was not loaded.`);
        }
    }

    const childSchemaByName = new Map(schemaElement.children.map((child) => [child.name, child]));
    for (const childNode of Array.from(xmlElement.children)) {
        const childSchema = childSchemaByName.get(childNode.nodeName);
        if (!childSchema) {
            state.unknownXmlNotes.push(`${path}: unknown child <${childNode.nodeName}> was not loaded.`);
            continue;
        }

        data.children[childSchema.name].push(parseXmlElement(childNode, childSchema, `${path}/${childSchema.name}`));
    }

    return data;
}

function validateNode(schemaElement, data, path) {
    const issues = [];

    for (const attribute of schemaElement.attributes) {
        const value = data.attributes[attribute.name] || "";
        if (attribute.required && value.trim() === "") {
            issues.push({ type: "error", message: `${path}: ${attribute.name} is required.` });
        }
        if (attribute.enums.length > 0 && value && !attribute.enums.includes(value)) {
            issues.push({ type: "error", message: `${path}: ${attribute.name} must be one of ${attribute.enums.join(", ")}.` });
        }
        if (attribute.kind === "uuid" && value && !isUuidString(value)) {
            issues.push({ type: "error", message: `${path}: ${attribute.name} must be a UUID like {00000000-0000-0000-0000-000000000000}.` });
        }
        if (attribute.kind === "integer" && value && !/^-?\d+$/.test(value.trim())) {
            issues.push({ type: "error", message: `${path}: ${attribute.name} must be a whole number.` });
        }
        if (attribute.kind === "number" && value && Number.isNaN(Number(value))) {
            issues.push({ type: "error", message: `${path}: ${attribute.name} must be a number.` });
        }
    }

    if (usesCount(data)) {
        const count = data.attributes.Count || "";
        if (count.trim() === "") {
            issues.push({ type: "error", message: `${path}: Count is required when Container is ${data.attributes.Container}.` });
        } else if (!/^\d+$/.test(count.trim()) || Number(count) < 1) {
            issues.push({ type: "error", message: `${path}: Count must be a positive whole number for ${data.attributes.Container}.` });
        }
    }

    for (const childSchema of schemaElement.children) {
        const collection = data.children[childSchema.name] || [];

        const seenNames = new Set();
        collection.forEach((child, index) => {
            const childPath = `${path}/${childSchema.name}[${index + 1}]`;
            const name = child.attributes.Name;
            if (name) {
                if (seenNames.has(name)) {
                    issues.push({ type: "warning", message: `${path}: duplicate ${childSchema.name} name "${name}".` });
                }
                seenNames.add(name);
            }
            issues.push(...validateNode(childSchema, child, childPath));
        });
    }

    return issues;
}

function isUuidString(value) {
    return /^\{[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\}$/.test(value.trim());
}

function serializeDocument() {
    if (!state.schema || !state.document) {
        return "";
    }
    return `<?xml version="1.0"?>\n\n${serializeNode(state.schema, state.document, 0, true)}\n`;
}

function serializeNode(schemaElement, data, indentLevel, isRoot = false) {
    const pad = "    ".repeat(indentLevel);
    const attrs = [];

    for (const attribute of schemaElement.attributes) {
        const value = data.attributes[attribute.name];
        if (value !== undefined && value !== "") {
            attrs.push(`${attribute.name}="${escapeXml(value)}"`);
        }
    }

    for (const [name, value] of Object.entries(data.extraAttributes || {})) {
        if (!schemaElement.attributes.some((attribute) => attribute.name === name) && value !== "") {
            attrs.push(`${name}="${escapeXml(value)}"`);
        }
    }

    if (isRoot) {
        if (!attrs.some((attributeText) => attributeText.startsWith("xmlns:xsi="))) {
            attrs.push('xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"');
        }
    }

    const childLines = [];
    for (const childSchema of schemaElement.children) {
        const collection = data.children[childSchema.name] || [];
        for (const child of collection) {
            childLines.push(serializeNode(childSchema, child, indentLevel + 1));
        }
    }

    const open = `${pad}<${schemaElement.name}${attrs.length ? ` ${attrs.join(" ")}` : ""}`;
    if (childLines.length === 0) {
        return `${open} />`;
    }

    return `${open}>\n${childLines.join("\n")}\n${pad}</${schemaElement.name}>`;
}

function shouldPreserveExtraAttribute(attributeName) {
    const preservedAttributes = new Set([
        "EditAttributes",
        "schemaLocation",
        "noNamespaceSchemaLocation",
        "xsi:schemaLocation",
        "xsi:noNamespaceSchemaLocation"
    ]);
    return attributeName.startsWith("xsi:")
        || attributeName.startsWith("xmlns")
        || preservedAttributes.has(attributeName);
}

function parseXmlText(text, label) {
    const parser = new DOMParser();
    const xml = parser.parseFromString(text, "application/xml");
    const error = xml.querySelector("parsererror");
    if (error) {
        throw new Error(`${label} parse failed.`);
    }
    return xml;
}

function childrenByName(node, name) {
    return Array.from(node.children).filter((child) => localName(child) === name);
}

function childByName(node, name) {
    return childrenByName(node, name)[0] || null;
}

function childByAnyName(node, names) {
    return Array.from(node.children).find((child) => names.includes(localName(child))) || null;
}

function localName(node) {
    return node.localName || node.nodeName.split(":").pop();
}

function stripPrefix(value) {
    return value.split(":").pop();
}

function clear(node) {
    while (node.firstChild) {
        node.removeChild(node.firstChild);
    }
}

function escapeXml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("\"", "&quot;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
}

function decodeXmlEntities(value) {
    let decoded = String(value ?? "");
    for (let pass = 0; pass < 3; pass++) {
        const next = decoded
            .replaceAll("&lt;", "<")
            .replaceAll("&gt;", ">")
            .replaceAll("&quot;", "\"")
            .replaceAll("&apos;", "'")
            .replaceAll("&amp;", "&");
        if (next === decoded) {
            break;
        }
        decoded = next;
    }
    return decoded;
}

function basename(filePath) {
    if (!filePath) {
        return "";
    }
    return filePath.split(/[\\/]/).pop();
}

function setStatus(message) {
    elements.statusText.textContent = message;
}
