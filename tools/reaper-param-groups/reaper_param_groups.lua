--[[
  reaper_param_groups.lua — ABDAxionikVS

  Verifica, en un REAPER real, que el VST3 publica sus grupos de parámetros
  (un AudioProcessorParameterGroup por categoría del diccionario) y que el
  host los ve como secciones. Es la versión re-ejecutable de la sonda que se
  hizo a mano para el §4.4 del diccionario común:

    ABDShared/Docs/specs/COMMON_DATA_DICTIONARY_AND_INTEGRATION.md §4.4

  Qué hace
  --------
  1. Crea una pista desechable, inserta el FX y lo apaga (sin procesar audio).
  2. Recorre TrackFX_GetNumParams / _GetParamName / _GetParamSectionName.
  3. Comprueba que el recuento de parámetros con sección coincide con
     kNumTotalParameters de Source/Generated/ParameterRegistry.gen.h, que no
     falta ninguna de las secciones esperadas y que ningún parámetro del
     diccionario se queda sin grupo (los que no llevan sección tienen que ser
     pseudo-parámetros del host: Bypass, Program, Wet, Delta y MIDI CC).
  4. Escribe report.json junto a este script (o donde diga ABD_REAPER_REPORT)
     y lo resume en la consola de REAPER.
  5. Borra la pista que creó dentro de un bloque de undo: el proyecto queda
     como estaba.

  Cómo se ejecuta
  ---------------
  * Desde REAPER: Actions -> Load ReaScript... -> este fichero -> Run.
  * Desde la línea de comandos, para repetirlo tras cada cambio:
        run-reaper-param-groups.ps1
    (ver README.md: pasar un .lua a reaper.exe abre una sesión normal, así que
    el lanzador arranca una instancia con -newinst y la cierra él mismo).

  Variables de entorno
  --------------------
  ABD_REAPER_PLUGIN  nombre del FX a insertar (por defecto ABDAxionikVS).
  ABD_REAPER_REPORT  ruta del informe JSON (por defecto, junto al script).
  ABD_REAPER_QUIET   "1" = no abrir cuadros de diálogo (modo lanzador).
--]]

local DEFAULT_PLUGIN = "ABDAxionikVS"

-- Nombre con el que REAPER registra el VST3. Se prueban varios porque el
-- prefijo depende de si el plugin declara ser instrumento (VST3i) o efecto.
local PLUGIN_ALIASES = {
    "VST3i: " .. DEFAULT_PLUGIN,
    "VST3: " .. DEFAULT_PLUGIN,
    DEFAULT_PLUGIN,
}

-- Secciones que publica el AudioProcessorParameterGroup por categoría del
-- diccionario. Si una categoría cambia de nombre o desaparece, esta lista hay
-- que actualizarla a la vez que Source/PluginProcessor.cpp; las secciones
-- nuevas que aparezcan de más no se consideran fallo.
local EXPECTED_SECTIONS = {
    "Global",
    "Name",
    "Synth",
    "Resynator 1",
    "Resynator 2",
    "Master FX",
}

-- Pseudo-parámetros que REAPER añade a cualquier FX: no vienen del plugin y
-- por eso no tienen sección.
local HOST_PSEUDO_PARAMS = { "bypass", "program", "wet", "delta", "dry" }

-- ---------------------------------------------------------------------------
-- Utilidades
-- ---------------------------------------------------------------------------

local function trim(s)
    return (s:gsub("^%s+", ""):gsub("%s+$", ""))
end

local function scriptDir()
    local _, filename = reaper.get_action_context()
    if not filename or filename == "" then return "." end
    return filename:match("^(.*)[/\\][^/\\]+$") or "."
end

local function readFile(path)
    local fh = io.open(path, "rb")
    if not fh then return nil end
    local content = fh:read("*a")
    fh:close()
    return content
end

local function writeFile(path, content)
    local fh = io.open(path, "wb")
    if not fh then return false end
    fh:write(content)
    fh:close()
    return true
end

-- Recuento de parámetros del registro generado: la fuente de verdad del
-- número que debe llegar al host. Si el fichero no está, la comprobación de
-- recuento se omite y el informe lo dice.
local function registryParamCount()
    local path = scriptDir() .. "/../../Source/Generated/ParameterRegistry.gen.h"
    local content = readFile(path)
    if not content then return nil, path end
    local n = content:match("kNumTotalParameters%s*=%s*(%d+)")
    return tonumber(n), path
end

local function isHostPseudoParam(name)
    local lower = name:lower()
    if lower:match("^midi cc") then return true end
    for _, pseudo in ipairs(HOST_PSEUDO_PARAMS) do
        if lower == pseudo then return true end
    end
    return false
end

local function jsonEscape(s)
    s = s:gsub("\\", "\\\\"):gsub('"', '\\"')
    s = s:gsub("\n", "\\n"):gsub("\r", "\\r"):gsub("\t", "\\t")
    return s
end

-- ---------------------------------------------------------------------------
-- Comprobaciones
-- ---------------------------------------------------------------------------

local checks = {}

local function check(name, ok, detail)
    checks[#checks + 1] = { name = name, ok = ok, detail = detail or "" }
end

local function allOk()
    for _, c in ipairs(checks) do
        if not c.ok then return false end
    end
    return true
end

-- Informe mínimo para los fallos que ocurren antes de poder leer parámetros:
-- así el lanzador no espera el timeout completo y el motivo queda en disco.
local function writeFailureReport(reportPath, plugin, reasons)
    local items = {}
    for _, reason in ipairs(reasons) do
        items[#items + 1] = '    { "name": "' .. jsonEscape(reason) .. '", "ok": false, "detail": "" }'
    end
    local json = table.concat({
        "{",
        '  "plugin": "' .. jsonEscape(plugin) .. '",',
        '  "reaper": "' .. jsonEscape(reaper.GetAppVersion()) .. '",',
        '  "generated": "' .. os.date("!%Y-%m-%dT%H:%M:%SZ") .. '",',
        '  "expected": null,',
        '  "numParams": 0,',
        '  "sectioned": 0,',
        '  "pseudoParams": 0,',
        '  "sections": [],',
        '  "unclassified": [],',
        '  "checks": [',
        table.concat(items, ",\n"),
        "  ],",
        '  "ok": false',
        "}",
    }, "\n")
    writeFile(reportPath, json .. "\n")
end

-- ---------------------------------------------------------------------------
-- Programa
-- ---------------------------------------------------------------------------

local function main()
    local reportPath = os.getenv("ABD_REAPER_REPORT") or (scriptDir() .. "/report.json")
    local pluginName = os.getenv("ABD_REAPER_PLUGIN")

    if not reaper.APIExists("TrackFX_GetParamSectionName") then
        local reason = "esta build de REAPER no expone TrackFX_GetParamSectionName (hace falta 7.x)"
        writeFailureReport(reportPath, pluginName or DEFAULT_PLUGIN, { reason })
        if os.getenv("ABD_REAPER_QUIET") ~= "1" then
            reaper.ShowMessageBox(
                "Esta build de REAPER no expone TrackFX_GetParamSectionName.\n" ..
                "Hace falta REAPER 7.x; con builds antiguas el host no agrupa por sección.",
                "Verificar grupos de parámetros", 0)
        end
        return
    end

    local expectedCount, registryPath = registryParamCount()

    local numTracksBefore = reaper.GetNumTracks()
    reaper.Undo_BeginBlock()
    reaper.PreventUIRefresh(1)
    reaper.InsertTrackAtIndex(numTracksBefore, false)
    local track = reaper.GetTrack(0, numTracksBefore)

    -- Insertar el FX probando los alias conocidos.
    local fx = -1
    local fxName = ""
    local tried = {}
    -- Si se pide un plugin concreto, no se cae al de por defecto: un informe
    -- verde sobre el FX equivocado sería peor que un fallo.
    local candidates = {}
    local aliases = PLUGIN_ALIASES
    if pluginName and pluginName ~= "" and pluginName ~= DEFAULT_PLUGIN then
        aliases = { "VST3i: " .. pluginName, "VST3: " .. pluginName, pluginName }
    end
    for _, alias in ipairs(aliases) do
        candidates[#candidates + 1] = alias
    end

    for _, alias in ipairs(candidates) do
        fx = reaper.TrackFX_AddByName(track, alias, false, -1)
        tried[#tried + 1] = alias
        if fx and fx >= 0 then break end
    end

    if not fx or fx < 0 then
        reaper.DeleteTrack(track)
        reaper.PreventUIRefresh(-1)
        reaper.Undo_EndBlock("Verificar secciones de parámetros (ABD)", -1)
        local msg =
            "No se pudo insertar " .. (pluginName or DEFAULT_PLUGIN) .. " en una pista nueva.\n\n" ..
            "Probado: " .. table.concat(tried, ", ") .. "\n\n" ..
            "Comprueba que el VST3 esté compilado y en una ruta VST de REAPER\n" ..
            "(Options -> Preferences -> Plug-ins -> VST -> Edit path list),\n" ..
            "y haz Rescan. El binario esperado está en:\n" ..
            "build/ABDAxionikVS_artefacts/Release/VST3/ABDAxionikVS.vst3"
        writeFailureReport(reportPath, pluginName or DEFAULT_PLUGIN,
            { "no se pudo insertar el FX (probado: " .. table.concat(tried, ", ") .. ")" })
        if os.getenv("ABD_REAPER_QUIET") ~= "1" then
            reaper.ShowMessageBox(msg, "Verificar grupos de parámetros", 0)
        end
        io.stderr:write(msg .. "\n")
        return
    end

    local _, resolvedName = reaper.TrackFX_GetFXName(track, fx, "")
    fxName = resolvedName or ""
    -- Bypass, no offline: con el FX offline REAPER solo enumera 3 parámetros
    -- (Bypass/Program/Wet) y no hay forma de leer las secciones.
    reaper.TrackFX_SetEnabled(track, fx, false)

    local numParams = reaper.TrackFX_GetNumParams(track, fx)
    check("el FX expone parámetros", numParams > 0, "numParams = " .. tostring(numParams))

    local sectionOrder = {}
    local sectionCount = {}
    local sectioned = 0
    local unclassified = {}
    local emptyNames = 0

    for p = 0, numParams - 1 do
        local _, pname = reaper.TrackFX_GetParamName(track, fx, p, "")
        pname = pname or ""
        if trim(pname) == "" then
            emptyNames = emptyNames + 1
        end

        local section = reaper.TrackFX_GetParamSectionName(track, fx, p) or ""
        section = trim(section)

        if section == "" then
            if not isHostPseudoParam(pname) then
                if #unclassified < 20 then
                    unclassified[#unclassified + 1] = pname
                end
            end
        else
            sectioned = sectioned + 1
            if sectionCount[section] == nil then
                sectionCount[section] = 0
                sectionOrder[#sectionOrder + 1] = section
            end
            sectionCount[section] = sectionCount[section] + 1
        end
    end

    check("hay parámetros con sección", sectioned > 0, "con sección = " .. sectioned)
    check("ningún parámetro sin nombre", emptyNames == 0, "sin nombre = " .. emptyNames)

    if expectedCount then
        check("recuento del registro coincide",
            sectioned == expectedCount,
            string.format("%d con sección vs %d en el registro", sectioned, expectedCount))
    end

    if #unclassified > 0 then
        check("ningún parámetro del diccionario sin sección", false,
            table.concat(unclassified, ", "))
    else
        check("ningún parámetro del diccionario sin sección", true, "")
    end

    -- Las secciones esperadas solo se exigen para el sintetizador de este repo;
    -- con otro plugin (ABD_REAPER_PLUGIN) la lista no aplica.
    local checkExpectedSections = (pluginName == nil or pluginName == "" or pluginName == DEFAULT_PLUGIN)
    if checkExpectedSections then
        local missing = {}
        for _, expected in ipairs(EXPECTED_SECTIONS) do
            local count = sectionCount[expected]
            if not count or count == 0 then
                missing[#missing + 1] = expected
            end
        end
        check("están todas las secciones esperadas",
            #missing == 0,
            #missing == 0 and "" or ("faltan: " .. table.concat(missing, ", ")))
    end

    -- Resumen por sección, ordenado alfabéticamente para que el diff del
    -- informe sea estable entre ejecuciones.
    local sortedSections = {}
    for _, name in ipairs(sectionOrder) do
        sortedSections[#sortedSections + 1] = { name = name, count = sectionCount[name] }
    end
    table.sort(sortedSections, function(a, b) return a.name < b.name end)

    reaper.DeleteTrack(track)
    reaper.PreventUIRefresh(-1)
    reaper.Undo_EndBlock("Verificar secciones de parámetros (ABD)", -1)

    -- -----------------------------------------------------------------------
    -- Informe
    -- -----------------------------------------------------------------------

    local ok = allOk()

    local json = {}
    json[#json + 1] = "{"
    json[#json + 1] = '  "plugin": "' .. jsonEscape(fxName) .. '",'
    json[#json + 1] = '  "reaper": "' .. jsonEscape(reaper.GetAppVersion():match("^[^/]+/[^ ]*") or reaper.GetAppVersion()) .. '",'
    json[#json + 1] = '  "generated": "' .. os.date("!%Y-%m-%dT%H:%M:%SZ") .. '",'
    json[#json + 1] = '  "registry": "' .. jsonEscape(registryPath or "") .. '",'
    json[#json + 1] = '  "expected": ' .. (expectedCount and tostring(expectedCount) or "null") .. ","
    json[#json + 1] = '  "numParams": ' .. numParams .. ","
    json[#json + 1] = '  "sectioned": ' .. sectioned .. ","
    json[#json + 1] = '  "pseudoParams": ' .. (numParams - sectioned) .. ","

    json[#json + 1] = '  "sections": ['
    for i, s in ipairs(sortedSections) do
        local sep = (i < #sortedSections) and "," or ""
        json[#json + 1] = '    { "name": "' .. jsonEscape(s.name) .. '", "count": ' .. s.count .. " }" .. sep
    end
    json[#json + 1] = "  ],"

    json[#json + 1] = '  "unclassified": ['
    for i, name in ipairs(unclassified) do
        local sep = (i < #unclassified) and "," or ""
        json[#json + 1] = '    "' .. jsonEscape(name) .. '"' .. sep
    end
    json[#json + 1] = "  ],"

    json[#json + 1] = '  "checks": ['
    for i, c in ipairs(checks) do
        local sep = (i < #checks) and "," or ""
        json[#json + 1] = '    { "name": "' .. jsonEscape(c.name) .. '", "ok": ' ..
            (c.ok and "true" or "false") .. ', "detail": "' .. jsonEscape(c.detail) .. '" }' .. sep
    end
    json[#json + 1] = "  ],"
    json[#json + 1] = '  "ok": ' .. (ok and "true" or "false")
    json[#json + 1] = "}"

    local written = writeFile(reportPath, table.concat(json, "\n") .. "\n")

    -- -----------------------------------------------------------------------
    -- Consola
    -- -----------------------------------------------------------------------

    local out = {}
    out[#out + 1] = "== Grupos de parámetros en REAPER =="
    out[#out + 1] = "FX: " .. fxName
    out[#out + 1] = string.format("Parámetros: %d (con sección %d, del host %d)",
        numParams, sectioned, numParams - sectioned)
    if expectedCount then
        out[#out + 1] = string.format("Registro: %d parámetros", expectedCount)
    else
        out[#out + 1] = "Registro: no encontrado (" .. tostring(registryPath) .. "); sin comprobación de recuento"
    end
    out[#out + 1] = ""
    for _, s in ipairs(sortedSections) do
        out[#out + 1] = string.format("  %-16s %4d", s.name, s.count)
    end
    out[#out + 1] = ""
    for _, c in ipairs(checks) do
        out[#out + 1] = string.format("  [%s] %s%s", c.ok and "OK   " or "FALLO", c.name,
            (c.detail ~= "" and not c.ok) and (" — " .. c.detail) or "")
    end
    out[#out + 1] = ""
    out[#out + 1] = ok and "RESULTADO: OK" or "RESULTADO: FALLO"
    out[#out + 1] = written and ("Informe: " .. reportPath) or ("No se pudo escribir el informe en " .. reportPath)

    local text = table.concat(out, "\n")
    reaper.ShowConsoleMsg(text .. "\n")

    if os.getenv("ABD_REAPER_QUIET") ~= "1" then
        reaper.ShowMessageBox(text, "Grupos de parámetros en REAPER", 0)
    end
end

main()
