-- Generated from src/gamemodes/zombieplague/gamemode/messaging/client/cl_message.ts. DO NOT EDIT; run npm run build.
local ____exports = {}
net.Receive(
    "SendMessage",
    function() return chat.AddText(
        net.ReadColor(),
        "[ZP] ",
        Color(255, 255, 255),
        net.ReadString()
    ) end
)
net.Receive(
    "SendConsoleMessage",
    function() return print(net.ReadString()) end
)
net.Receive(
    "SendPopupMessage",
    function() return notification.AddLegacy(
        net.ReadString(),
        NOTIFY_GENERIC,
        5
    ) end
)
net.Receive(
    "SendSound",
    function() return surface.PlaySound(net.ReadString()) end
)
local function showNotify(text, duration, color)
    local notice = vgui.Create("DNotify")
    notice:SetLife(duration)
    notice:SetSize(800, 40)
    notice:SetPos(
        ScrW() / 2 - 400,
        30
    )
    local label = vgui.Create("DLabel", notice)
    label:Dock(FILL)
    label:SetFont("GModNotify")
    label:SetContentAlignment(5)
    label:SetText(text)
    label:SetColor(color)
    notice:AddItem(label)
end
net.Receive(
    "SendNotifyMessage",
    function()
        local duration = net.ReadInt(8)
        local text = net.ReadString()
        local color = net.ReadColor()
        showNotify(text, duration, color)
    end
)
net.Receive(
    "SendLocalizedMessage",
    function()
        local kind = net.ReadString()
        local text = ZPClientData.LocalizedText(net.ReadTable())
        local color = net.ReadColor()
        local duration = net.ReadInt(8)
        if text == nil then
            return
        end
        if kind == "chat" then
            chat.AddText(
                color,
                "[ZP] ",
                Color(255, 255, 255),
                text
            )
        elseif kind == "console" then
            print(text)
        elseif kind == "popup" then
            notification.AddLegacy(text, NOTIFY_GENERIC, 5)
        elseif kind == "notify" then
            showNotify(text, duration, color)
        end
    end
)
return ____exports
