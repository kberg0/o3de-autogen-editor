const { contextBridge, ipcRenderer } = require("electron");

const autogenApi = {
    loadDefaultSchema: () => ipcRenderer.invoke("schema:loadDefault"),
    openSchema: () => ipcRenderer.invoke("schema:open"),
    openProject: () => ipcRenderer.invoke("project:open"),
    rescanProject: () => ipcRenderer.invoke("project:rescan"),
    openXml: () => ipcRenderer.invoke("xml:open"),
    readXml: (filePath) => ipcRenderer.invoke("xml:read", filePath),
    saveXml: (filePath, xmlText) => ipcRenderer.invoke("xml:save", filePath, xmlText),
    saveXmlAs: (xmlText) => ipcRenderer.invoke("xml:saveAs", xmlText),
    choosePath: (request) => ipcRenderer.invoke("path:choose", request),
    createPath: (request) => ipcRenderer.invoke("path:create", request),
    createComponent: (request) => ipcRenderer.invoke("component:create", request),
    deleteComponent: (filePath) => ipcRenderer.invoke("component:delete", filePath)
};

contextBridge.exposeInMainWorld("autogenApi", autogenApi);
contextBridge.exposeInMainWorld("autoComponentApi", autogenApi);
